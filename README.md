# BalanceVault — Snovasys Fresher Hiring Challenge 2026

A runnable full-stack demo for secure account management and money movement with a double-entry ledger and audit trail.

## Stack
- React + Vite + Tailwind CSS
- Node.js + Express
- PostgreSQL + Prisma
- JWT authentication, bcrypt password hashing, Zod validation, Helmet, rate limiting

## Requirements
- Node.js 20+
- Docker Desktop (recommended) or PostgreSQL 15+
- npm

## Run locally (Windows / macOS / Linux)
1. Extract this ZIP.
2. Open the `BalanceVault_Full_Project` folder in VS Code.
3. Copy `backend/.env.example` to `backend/.env`.
4. From the project root run:

```bash
docker compose up -d
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

5. Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
6. Open http://localhost:5173

Demo admin:
- Email: `admin@balancevault.local`
- Password: `Admin@12345`

Create a normal user from the Register screen to test user permissions. Change the demo admin password before any shared deployment.

## Features
- Register and login
- Create and view accounts
- Transfer funds between accounts owned by the signed-in user
- Server-side amount validation and ownership checks
- Atomic debit + credit ledger entries inside a Prisma transaction
- Transaction history / ledger
- Admin-only audit log endpoint and screen
- Rate-limited authentication endpoints
- Password hashes only; JWT secret and database credentials from environment variables

## Important implementation notes
- This is a challenge/demo application, not a real banking product.
- The seeded admin credentials are for local demonstration only.
- Do not use real money or personal financial data.
- For production, add email verification, refresh-token rotation, CSRF strategy if cookie auth is adopted, stronger monitoring, backups, reconciliation jobs, and independent security review.
- The transfer route uses a database transaction and writes paired ledger entries. Do not update balances directly from the browser.

## Suggested evaluation walkthrough
1. Log in as admin and inspect dashboard and audit logs.
2. Register a normal user in another browser/private window.
3. Create two accounts for that user.
4. Fund the first account using the clearly labelled demo-only admin funding endpoint (or seed demo balances).
5. Transfer between accounts and verify both ledger entries.
6. Attempt an invalid amount / another user's account ID and verify the API rejects it.

## Deployment
- Backend: Render (set `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`)
- Database: Render PostgreSQL
- Frontend: Vercel (set `VITE_API_URL` to the deployed backend URL)
- Run `npx prisma migrate deploy` during backend deployment.
- Keep the GitHub repository private until the challenge deadline, as instructed in the challenge brief.
