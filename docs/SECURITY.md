# Security and threat notes

## Assets and threats
- Account balances and ledger integrity: prevent unauthorized balance edits and forged transfers.
- User credentials: store only adaptive password hashes; never return hashes from API.
- Sessions: short-lived signed JWT; require authentication for protected endpoints.
- Authorization: every account lookup is scoped to the authenticated user; admin routes use role checks.
- API abuse: auth endpoints are rate-limited; JSON request size is capped; Helmet sets security headers.
- Concurrent transfers: database transaction with serializable isolation; debit and credit entries commit together.

## Remaining hardening before production
- Add refresh-token rotation and token revocation.
- Add idempotency keys for client retries.
- Add account-level locking / retry policy for serialization conflicts.
- Add immutable external audit export and reconciliation jobs.
- Add monitoring, backups, secret rotation, dependency scanning, and independent penetration testing.
- Consider requiring MFA for administrators.
