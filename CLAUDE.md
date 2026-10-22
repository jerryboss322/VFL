# CLAUDE.md — Frontend rules
Scope: `frontend/` only. Never implement backend logic or edit `backend/`, `migrations/`.
- Next.js App Router, React, TypeScript strict, Tailwind. Avoid new dependencies without a stated reason.
- Follow `docs/design-system.md`. Use tokens from `tailwind.config.ts`; no ad-hoc colours.
- All HTTP goes through `frontend/lib/api/client.ts`. No `fetch` in components.
- The backend is authoritative for bet acceptance, payouts, balances, settlement. The UI only displays.
- Never substitute fake data on API failure; render loading/error/disconnected states.
- Fixtures live only in `frontend/lib/fixtures/` and must be imported from nowhere else.
- Real-money deposit/withdrawal UI is out of scope. Label funds as simulated.
- Before finishing a task: `npm run typecheck && npm run lint && npm test`.
