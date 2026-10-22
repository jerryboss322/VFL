# AGENTS.md — Shared rules
- `docs/api-contract.md` is the single source of truth for HTTP contracts. Backend owns it; the frontend proposes changes via PR notes.
- Money is integer minor units. Odds are decimal numbers supplied by the backend with a version/id.
- Backend decides bet acceptance, payouts, balances, settlement. Ledger rules: `docs/financial-ledger.md`.
- Real-money flows are disabled in all development environments.
- Do not edit another agent's directory (`frontend/` vs `backend/`) without agreement.
