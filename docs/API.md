# API overview

Base URL: `http://localhost:4000`

Public:
- `GET /health`
- `POST /api/auth/register` — `{ name, email, password }`
- `POST /api/auth/login` — `{ email, password }`

Bearer token required:
- `GET /api/me`
- `GET /api/accounts`
- `POST /api/accounts` — `{ name, currency }`
- `GET /api/accounts/:id/ledger`
- `POST /api/transfers` — `{ fromAccountId, toAccountId, amount }`

Admin only:
- `GET /api/admin/audit-logs`
- `POST /api/admin/fund` — demo-only funding helper `{ accountId, amount }`

Errors use JSON `{ error }`; validation errors may include `details`.
