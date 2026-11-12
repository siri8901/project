import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@balancevault.local';
  const passwordHash = await bcrypt.hash('Admin@12345', 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'BalanceVault Admin', email, passwordHash, role: 'ADMIN' }
  });

  const account = await prisma.account.findFirst({ where: { userId: admin.id, name: 'Admin Demo Wallet' } });
  if (!account) {
    const created = await prisma.account.create({
      data: { userId: admin.id, name: 'Admin Demo Wallet', currency: 'INR', balance: new Prisma.Decimal('10000.00') }
    });
    const opening = await prisma.transfer.create({
      data: { fromAccountId: created.id, toAccountId: created.id, amount: new Prisma.Decimal('10000.00'), reference: 'SEED-OPENING-BALANCE' }
    });
    await prisma.ledgerEntry.create({
      data: { accountId: created.id, transferId: opening.id, type: 'CREDIT', amount: new Prisma.Decimal('10000.00'), description: 'Demo opening balance' }
    });
  }
  console.log('Seed complete. Admin:', email, '/ password: Admin@12345');
}

main().catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => prisma.$disconnect());
