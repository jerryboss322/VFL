# Virtual Football Universe

A full-stack virtual football betting platform with a live match simulator, real-time odds, and a financial ledger. All money is in test tokens — **no real-money flows are enabled in any environment**.

## Stack

| Layer    | Technology                                                  |
| -------- | ----------------------------------------------------------- |
| Frontend | Next.js 15, React 19, TypeScript 5.7, Tailwind CSS 3.4      |
| Backend  | FastAPI (Python 3.12), SQLAlchemy 2.0, asyncpg, Alembic      |
| Database | PostgreSQL 16 (port **5433**)                               |
| Auth     | JWT (python-jose), bcrypt (passlib)                          |
| Tests    | pytest, pytest-asyncio, httpx                               |

## Project Layout

```
virtual-football/
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers (auth, bets, fixtures, etc.)
│   │   ├── core/           # Config, database, security
│   │   ├── models/         # SQLAlchemy models (12 tables)
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   └── services/       # Business logic (auth, betting, match engine)
│   ├── engine/             # Match simulator
│   └── tests/              # Backend test suite
├── frontend/               # Next.js app
├── migrations/             # Alembic migrations (repo root)
├── alembic.ini             # Alembic config (repo root)
└── pytest.ini              # Pytest config (repo root)
```

---

## Prerequisites

- Python 3.12
- Node.js 18+
- PostgreSQL 16 running on port **5433**

---

## Backend

> **Note:** All commands below assume you are in the repo root (`~/Projects/virtual-football`).

### 1. Install Python dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn sqlalchemy asyncpg alembic \
    pydantic pydantic-settings python-jose[cryptography] \
    passlib[bcrypt] httpx pytest pytest-asyncio
```

### 2. Create the database

```bash
psql -p 5433 -U postgres -c "CREATE DATABASE virtual_football;"
```

### 3. Set environment variables (optional — defaults work for local dev)

```bash
export DATABASE_URL="postgresql+asyncpg://postgres@localhost:5433/virtual_football"
export SECRET_KEY="dev-secret-change-me"
```

See `backend/app/core/config.py` for all settings and their defaults.

### 4. Run migrations

```bash
PYTHONPATH=backend:backend/engine:. .venv/bin/python -m alembic upgrade head
```

This creates all 12 tables.

### 5. Start the backend server

```bash
PYTHONPATH=backend:backend/engine:. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

If port 8000 is already in use, add `--port 8001` (or any free port).

The API is now available at [http://localhost:8000](http://localhost:8000). Interactive docs at [http://localhost:8000/docs](http://localhost:8000/docs).

### 6. Verify it's running

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

---

## Running Backend Tests

```bash
export PYTHONPATH=backend:backend/engine:.
.venv/bin/python -m pytest backend/tests/ -v
```

Or run a single file:

```bash
.venv/bin/python -m pytest backend/tests/test_auth.py -v
```

All tests use the PostgreSQL database on port 5433 and truncate tables between tests for isolation.

---

## Frontend

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Start the dev server

```bash
npm run dev
```

The frontend is available at [http://localhost:3000](http://localhost:3000).

### 3. Type-check

```bash
npm run typecheck
```

---

## API Endpoints

| Method | Path                              | Auth | Description                           |
| ------ | --------------------------------- | ---- | ------------------------------------- |
| POST   | `/auth/register`                  | No   | Create account (grants 10,000 tokens) |
| POST   | `/auth/login`                     | No   | Get JWT token                         |
| GET    | `/me`                             | Yes  | Current user profile                  |
| GET    | `/league/table`                   | No   | League standings                      |
| GET    | `/fixtures`                       | No   | List all fixtures                     |
| POST   | `/fixtures`                       | Yes  | Create a fixture                      |
| GET    | `/fixtures/{id}`                  | No   | Fixture detail (with clubs)           |
| GET    | `/matches/{id}/events`            | No   | Match event timeline                  |
| GET    | `/matches/{id}/state`             | No   | Live match state (score, clock)       |
| POST   | `/matches/{id}/simulate`          | Yes  | Run full simulation (admin)           |
| GET    | `/odds`                           | No   | Latest odds snapshot for a fixture    |
| POST   | `/bets`                           | Yes  | Place a bet                           |
| GET    | `/bets`                           | Yes  | List my bets                          |
| POST   | `/bets/{id}/settle`               | Yes  | Settle a bet (won/lost)               |
| GET    | `/wallet`                         | Yes  | Wallet balance                        |
| GET    | `/wallet/transactions`            | Yes  | Ledger transaction history            |

---

## Testing a Bet End-to-End (cURL)

```bash
# 1. Register
TOKEN=$(curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!","display_name":"Tester"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Create a fixture (requires seeded league/season/clubs — or use an existing fixture ID)
# For a quick test, seed via the test helpers or use fixtures from the simulator.

# 3. Place a bet
curl -s -X POST http://localhost:8000/bets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"selections":[{"odds_id":"<odds-id>","version":1}],"stake_minor":5000,"idempotency_key":"my-bet-1"}'

# 4. Check wallet
curl -s http://localhost:8000/wallet \
  -H "Authorization: Bearer $TOKEN"
```

---

## Financial Ledger Rules

- All amounts are **integer minor units** (e.g., 1000000 = 10,000.00 tokens).
- Ledger entries are **immutable** once written.
- Every wallet mutation has a matching ledger entry with a running `balance_after_minor`.
- Bet settlement is **idempotent** — repeated calls return the same result.
- No real-money flows are enabled in any development environment.

See `docs/financial-ledger.md` for full rules.

---

## Match Engine

- Match duration: 8 minutes (480 seconds wall-clock).
- One game-minute = 0.5 seconds wall-clock.
- Events are generated from weighted templates at initialization.
- Goals, cards, penalties, and substitutions are rolled per minute based on team strength.
- The engine can recover state after a server restart via `recover_after_restart`.

---

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| `ModuleNotFoundError: No module named 'app'` | Prefix command with `PYTHONPATH=backend:backend/engine:.` |
| `ModuleNotFoundError: No module named 'app'` (alembic) | Use `PYTHONPATH=backend:backend/engine:. .venv/bin/python -m alembic upgrade head` |
| `ConnectionRefusedError` on port 5433 | Make sure PostgreSQL is running: `pg_ctl -D /path/to/data -o "-p 5433" start` |
| `relation already exists` on migration | Run `PYTHONPATH=backend:backend/engine:. .venv/bin/python -m alembic downgrade base && PYTHONPATH=backend:backend/engine:. .venv/bin/python -m alembic upgrade head` |
| `Address already in use` on port 8000 | Use a different port: `--port 8001` or kill the existing process: `fuser -k 8000/tcp` |
| Tests fail with `asyncpg` loop errors | Make sure you're using the venv: `source .venv/bin/activate` |
| Frontend can't reach backend | Backend must be running; check CORS is enabled (it is by default) |
