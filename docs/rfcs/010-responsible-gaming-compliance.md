# RFC 010: Responsible Gaming, Player Safety & Regulatory Compliance Engine

- **Status**: Standard / Authoritative
- **Authors**: Regulatory Affairs & Player Safety Architecture
- **Applies to**: `backend/app/services/responsible_gaming.py`, `backend/tests/test_responsible_gaming.py`, `app/responsible-gaming/page.tsx`
- **Related Documents**: `docs/product-spec.md`, `docs/financial-ledger.md`

---

## 1. Abstract & Scope

Operating a tier-1 sports wagering and trading platform necessitates strict, tamper-proof player protection frameworks conforming to the United Kingdom Gambling Commission (UKGC), Malta Gaming Authority (MGA), and European regulatory standards. 

RFC 010 defines the authoritative state machines, cooling-off delays, time-out intervals, and reality check timers governing the Responsible Gaming subsystem of the Virtual Football Universe (VFL).

---

## 2. Core Player Protection Features

```
+-----------------------------------------------------------------------------------+
|                         RESPONSIBLE GAMING CONTROL SUITE                          |
+-----------------------------------------------------------------------------------+
        |                           |                          |
        v                           v                          v
 FINANCIAL CEILINGS           TEMPORAL CONTROLS          IRREVERSIBLE LOCKS
 - Daily Deposit Limit        - Session Reality Check    - 24h to 30d Time-Out
 - Weekly Deposit Limit       - Max Session Duration     - 6m to Permanent Exclusion
 - Monthly Deposit Limit      - 24h Cooling-Off Delays   - Immediate Wallet Freeze
 - Daily Loss Limit
```

---

## 3. Limit Adjustment State Machine & 24h Cooling-Off Rule

To prevent impulsive chase-losses during heightened emotional states:
1. **Decreasing a Limit**:
   Takes effect **immediately** ($t_{eff} = t_{now}$).
2. **Increasing or Removing a Limit**:
   - Enters a mandatory **24-hour Cooling-Off Pending State**:
     $$t_{effective} = t_{request} + 86,400\text{ seconds}$$
   - At the expiration of 24 hours, the user must explicitly confirm the limit increase. If unconfirmed within 48 hours, the request automatically expires.

```
+--------------------+        User requests limit increase        +----------------------------+
|   ACTIVE LIMIT     | -----------------------------------------> |  PENDING 24H COOLING-OFF   |
|   (e.g. 5,000 XTS) |                                            |  (Existing limit enforces) |
+--------------------+                                            +----------------------------+
          ^                                                                     |
          |                      User declines or 48h timeout                   | 24h elapses &
          +---------------------------------------------------------------------+ User reconfirms
                                                                                v
                                                                  +----------------------------+
                                                                  |      NEW ACTIVE LIMIT      |
                                                                  |     (e.g. 10,000 XTS)      |
                                                                  +----------------------------+
```

---

## 4. Reality Check Timers

Active users receive compulsory modal interruptions at predetermined intervals (15, 30, 45, or 60 minutes of active browser engagement):
- **Display Data**:
  - Total elapsed session time.
  - Total stake wagered during session.
  - Total returns received.
  - Net Profit / Loss in minor units.
- **Mandatory User Action**:
  User must acknowledge by selecting either:
  1. *"Continue Session"*
  2. *"Log Out & Take a Break"*

---

## 5. Time-Out & Self-Exclusion Mechanics

### 5.1 Time-Out (Short-Term Rest)
- Durations: 24 Hours, 48 Hours, 7 Days, 30 Days.
- User is immediately logged out.
- Any attempt to authenticate returns HTTP 403 `ACCOUNT_IN_COOLING_OFF`.
- Active bets remain in play and settle normally; funds remain secure in wallet.

### 5.2 Self-Exclusion (Statutory Protection)
- Durations: 6 Months, 1 Year, 5 Years, or Permanent.
- Irreversible during the chosen period under regulatory mandate.
- All promotional communications, notifications, and marketing emails are permanently suppressed.
- Existing wallet balances are queued for immediate withdrawal settlement.
