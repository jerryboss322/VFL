# API Contract (Authoritative)

Base URL: `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`).
Serialization: All JSON payloads accept **both** `camelCase` and `snake_case` inputs, and emit `camelCase` fields (with backward-compatible aliases where needed).
Authentication: Supports **both** `httpOnly` cookie (`vfu_session`) for browser clients with `credentials: "include"` AND `Authorization: Bearer <token>` header for API/CLI clients.

## Endpoints

| Area | Method & Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST /auth/register` | No | Register user, create wallet with `1,000,000` minor units (`initial_grant`), set session cookie, return `User` + `accessToken` |
| **Auth** | `POST /auth/login` | No | Authenticate user, set session cookie, return `User` + `accessToken` |
| **Auth** | `POST /auth/logout` | No | Clear session cookie (`204 No Content`) |
| **Auth** | `GET /auth/me` & `GET /me` | Yes | Return current authenticated `User` |
| **League** | `GET /league` | No | List leagues and active season metadata |
| **League** | `GET /league/table` | No | Compute full 12-club standings (including 0-game clubs and form guide) |
| **Fixtures** | `GET /fixtures?status=&matchday=` | No | List fixtures with nested `home` and `away` club objects |
| **Fixtures** | `GET /fixtures/{id}` | No | Get fixture detail with nested `home` and `away` clubs |
| **Odds** | `GET /fixtures/{id}/odds` | No | Get active odds markets (`match_winner`, `over_under_2_5`, `both_teams_to_score`) |
| **Matches** | `GET /matches/{id}/state` | No | Get current match state (`status`, `clockSeconds`, `homeGoals`, `awayGoals`, `currentEvents`) |
| **Matches** | `GET /matches/{id}/events` | No | Get committed match events up to current match clock |
| **Matches** | `GET /matches/stream` | No | Server-Sent Events (SSE) live stream of match ticks, goals, and settlements |
| **Matches** | `POST /matches/{id}/start` | No* | Initialize and start a match simulation |
| **Matches** | `POST /matches/{id}/simulate` | No* | Fast-forward or advance a match simulation & trigger settlement |
| **Bets** | `POST /bets` | Yes | Place a single or accumulator bet (`selections`, `stakeMinor`, `idempotencyKey`) |
| **Bets** | `GET /bets?status=` | Yes | List current user's bets |
| **Wallet** | `GET /wallet` | Yes | Get current user's wallet (`availableMinor`, `reservedMinor`, `currency`, `simulated`) |
| **Wallet** | `GET /wallet/transactions` | Yes | List immutable ledger entries for current user |

## Error Envelope
All errors return HTTP $4\text{xx}/5\text{xx}$ with JSON:
```json
{
  "code": "ODDS_CHANGED | MARKET_SUSPENDED | INSUFFICIENT_FUNDS | STAKE_OUT_OF_RANGE | DUPLICATE_MATCH_SELECTION | DUPLICATE_BET | UNAUTHORIZED | NOT_FOUND | VALIDATION_ERROR",
  "message": "Human-readable explanation",
  "detail": "Human-readable explanation (FastAPI compatibility)",
  "details": {}
}
```
