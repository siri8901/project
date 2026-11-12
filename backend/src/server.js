import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { Prisma } from '@prisma/client';
import { authenticate, requireAdmin } from './middleware.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and contain at least 32 characters. Copy .env.example to .env.');
}

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '20kb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(120),
  password: z.string().min(10).max(72)
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(72) });
const accountSchema = z.object({ name: z.string().trim().min(2).max(40), currency: z.enum(['INR', 'USD']).default('INR') });
const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.coerce.number().positive().finite().max(10000000)
});

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '2h' });
}
function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
async function audit(tx, actorId, action, entityType, entityId, metadata = {}) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'balancevault-api' }));

app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email is already registered' });
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({ data: { name: input.name, email, passwordHash } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: 'USER_REGISTERED', entityType: 'USER', entityId: user.id } });
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (e) { next(e); }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }
    await prisma.auditLog.create({ data: { actorId: user.id, action: 'USER_LOGIN', entityType: 'USER', entityId: user.id } });
    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (e) { next(e); }
});

app.use('/api', authenticate);

app.get('/api/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

app.get('/api/accounts', async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: req.user.sub }, orderBy: { createdAt: 'desc' }
    });
    res.json({ accounts });
  } catch (e) { next(e); }
});

app.post('/api/accounts', async (req, res, next) => {
  try {
    const input = accountSchema.parse(req.body);
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.account.create({ data: { ...input, userId: req.user.sub } });
      await audit(tx, req.user.sub, 'ACCOUNT_CREATED', 'ACCOUNT', created.id, { name: created.name });
      return created;
    });
    res.status(201).json({ account });
  } catch (e) { next(e); }
});

app.get('/api/accounts/:id/ledger', async (req, res, next) => {
  try {
    const account = await prisma.account.findFirst({ where: { id: req.params.id, userId: req.user.sub } });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    const entries = await prisma.ledgerEntry.findMany({
      where: { accountId: account.id }, include: { transfer: true }, orderBy: { createdAt: 'desc' }, take: 100
    });
    res.json({ entries });
  } catch (e) { next(e); }
});

app.post('/api/transfers', async (req, res, next) => {
  try {
    const input = transferSchema.parse(req.body);
    if (input.fromAccountId === input.toAccountId) return res.status(400).json({ error: 'Choose two different accounts' });
    const amount = input.amount.toFixed(2);
    const result = await prisma.$transaction(async (tx) => {
      const from = await tx.account.findFirst({ where: { id: input.fromAccountId, userId: req.user.sub } });
      const to = await tx.account.findFirst({ where: { id: input.toAccountId, userId: req.user.sub } });
      if (!from || !to) throw Object.assign(new Error('Both accounts must belong to your user'), { status: 403 });
      if (from.currency !== to.currency) throw Object.assign(new Error('Accounts must use the same currency'), { status: 400 });
      if (Number(from.balance) < Number(amount)) throw Object.assign(new Error('Insufficient funds'), { status: 400 });
      const reference = `BV-${crypto.randomUUID()}`;
      const transfer = await tx.transfer.create({
        data: { fromAccountId: from.id, toAccountId: to.id, amount: new Prisma.Decimal(amount), reference }
      });
      await tx.account.update({ where: { id: from.id }, data: { balance: { decrement: new Prisma.Decimal(amount) } } });
      await tx.account.update({ where: { id: to.id }, data: { balance: { increment: new Prisma.Decimal(amount) } } });
      await tx.ledgerEntry.createMany({ data: [
        { accountId: from.id, transferId: transfer.id, type: 'DEBIT', amount: new Prisma.Decimal(amount), description: `Transfer to ${to.name}` },
        { accountId: to.id, transferId: transfer.id, type: 'CREDIT', amount: new Prisma.Decimal(amount), description: `Transfer from ${from.name}` }
      ] });
      await audit(tx, req.user.sub, 'TRANSFER_COMPLETED', 'TRANSFER', transfer.id, { reference, amount, currency: from.currency });
      return transfer;
    }, { isolationLevel: 'Serializable' });
    res.status(201).json({ transfer: result });
  } catch (e) { next(e); }
});

app.get('/api/admin/audit-logs', requireAdmin, async (_req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' }, take: 100
    });
    res.json({ logs });
  } catch (e) { next(e); }
});

// Demo-only funding helper: admin can credit a user's account for local evaluation.
app.post('/api/admin/fund', requireAdmin, async (req, res, next) => {
  try {
    const schema = z.object({ accountId: z.string().min(1), amount: z.coerce.number().positive().max(1000000) });
    const { accountId, amount: rawAmount } = schema.parse(req.body);
    const amount = rawAmount.toFixed(2);
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { id: accountId } });
      if (!account) throw Object.assign(new Error('Account not found'), { status: 404 });
      const updated = await tx.account.update({ where: { id: accountId }, data: { balance: { increment: new Prisma.Decimal(amount) } } });
      const transfer = await tx.transfer.create({
        data: { fromAccountId: accountId, toAccountId: accountId, amount, reference: `FUND-${crypto.randomUUID()}` }
      });
      await tx.ledgerEntry.create({ data: { accountId, transferId: transfer.id, type: 'CREDIT', amount: new Prisma.Decimal(amount), description: 'Admin demo funding' } });
      await audit(tx, req.user.sub, 'DEMO_ACCOUNT_FUNDED', 'ACCOUNT', accountId, { amount });
      return updated;
    });
    res.json({ account: result });
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: err.issues.map(i => `${i.path.join('.')}: ${i.message}`) });
  if (err.code === 'P2002') return res.status(409).json({ error: 'A record with this value already exists' });
  if (err.code === 'P2034') return res.status(409).json({ error: 'Concurrent update detected. Please retry.' });
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`BalanceVault API ready at http://localhost:${port}`));
