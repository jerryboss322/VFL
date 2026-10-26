"use client";

import React, { useState } from "react";
import { DocViewer, type RfcDocument } from "@/components/DocViewer";

const ALL_RFCS: RfcDocument[] = [
  {
    id: "rfc-001",
    number: "001",
    title: "Virtual Sports Distributed Simulation Architecture",
    status: "Standard",
    category: "Simulation Engine",
    authors: "Virtual Football Platform Architecture Working Group",
    abstract:
      "Specifies the stateless tick simulation, serverless wall-clock catchup mechanics, and deterministic PRNG seeding governing virtual European football matchday progression.",
    contentMarkdown: `## 1. Wall-Clock Convergence Invariant
Let T_start be the scheduled kickoff timestamp in UTC. For any query executed at wall-clock time t:
Δt_raw = max(0, (t - T_start) * M_speed)

The effective simulation match clock C_sim(t) in [0, 480] seconds:
C_sim(t) = 0 if Δt <= 0
C_sim(t) = Δt if 0 < Δt <= 240 (First Half)
C_sim(t) = 240 if 240 < Δt <= 250 (Half-Time Tactical Interval)
C_sim(t) = min(480, Δt - 10) if Δt > 250 (Second Half)

Regardless of whether backend ticks execute every second or resume after container cold-starts, C_sim(t) evaluates identically.`,
  },
  {
    id: "rfc-002",
    number: "002",
    title: "Double-Entry Financial Ledger Immutability & Solvency Architecture",
    status: "Standard",
    category: "Financial Ledger",
    authors: "Financial Engineering & Risk Compliance Working Group",
    abstract:
      "Mathematical proof of wallet conservation equations, zero-float minor unit arithmetic, row-level concurrency locking, and Tier-1 liquidity reserve ratio audits (>= 110%).",
    contentMarkdown: `## 1. Wallet Conservation Equation
For every user wallet W at any sequence step N:
AvailableBalance_N = Σ (ΔM_k)

BalanceAfter_k = BalanceAfter_(k-1) + ΔM_k
Any mutation where BalanceAfter_k != BalanceAfter_(k-1) + ΔM_k triggers an immediate system halt.

## 2. Solvency Ratio
R_solv = (Platform Treasury Assets) / (Total User Liabilities) >= 1.10 (110% minimum regulatory reserve)`,
  },
  {
    id: "rfc-003",
    number: "003",
    title: "Asian Handicap Mathematics & Permutation Hedging Engine",
    status: "Standard",
    category: "Trading & Odds",
    authors: "Sportsbook Quantitative Modeling Working Group",
    abstract:
      "Quarter split line fractional settlement formulas, permutation system betting matrices (Trixie, Yankee, Goliath), and Same-Game Multi correlation deflation copulas.",
    contentMarkdown: `## 1. Quarter Line Decomposition
Line(L) = 0.5 * Wager(L - 0.25) + 0.5 * Wager(L + 0.25)

Net Margin D = Goals_Home - Goals_Away + Handicap
- D = +0.25 -> HALF_WIN: floor(0.5 * S * Odds) + floor(0.5 * S)
- D = -0.25 -> HALF_LOSS: floor(0.5 * S) refunded
- D >= +0.50 -> FULL_WIN: floor(S * Odds)
- D <= -0.50 -> FULL_LOSS: 0 payout`,
  },
  {
    id: "rfc-004",
    number: "004",
    title: "Virtual Fantasy Football Scoring, Transfer Market & Valuation Engine",
    status: "Standard",
    category: "Fantasy Hub",
    authors: "Gamification & Virtual Sports Product Engineering",
    abstract:
      "FPL-compliant scoring matrix for 480s matchdays, dynamic player stock valuation curves, squad formation constraints, and automated bench substitutions.",
    contentMarkdown: `## 1. Scoring Matrix
- Appearance 60+ mins: +2 pts
- Goal: FWD (+4), MID (+5), DEF/GK (+6)
- Assist: +3 pts
- Clean Sheet: DEF/GK (+4), MID (+1)
- Penalty Saved: +5 pts
- Red Card: -3 pts, Yellow: -1 pt, Own Goal: -2 pts

## 2. Valuation Drift
V_(t+1) = clamp(V_t + ΔV_form + ΔV_demand, 4.0M, 15.5M)`,
  },
  {
    id: "rfc-005",
    number: "005",
    title: "Virtual European Champions Cup & Knockout Bracketology",
    status: "Standard",
    category: "Tournament Engine",
    authors: "Tournament Architecture & Sports Modeling Working Group",
    abstract:
      "Knockout progression state machine, modern UEFA aggregate rules (away goals abolished), extra time, Markov penalty shootouts, and Monte Carlo outright winner odds re-pricing.",
    contentMarkdown: `## 1. Modern UEFA Aggregate Conformance
Away goals rule is permanently abolished.
If Agg(Home) == Agg(Away) after 90 minutes of Leg 2:
- Extra Time: Two 15-minute simulation periods (30 simulation seconds)
- Penalty Shootout: 5 alternating rounds; Sudden Death if tied

## 2. Penalty Conversion Probability
P_score = clamp(0.76 + (Finishing - GoalkeeperReflexes) / 250, 0.55, 0.92)`,
  },
  {
    id: "rfc-006",
    number: "006",
    title: "Dixon-Coles Predictive Bivariate Poisson Goal Distribution",
    status: "Standard",
    category: "Predictive Analytics",
    authors: "Quantitative Sports Modeling & Pricing Architecture",
    abstract:
      "Bivariate goal distribution accounting for low-score correlation (0-0, 1-0, 0-1, 1-1), attacking and defensive relative ratings, and live in-play linear goal intensity decay.",
    contentMarkdown: `## 1. Dixon-Coles Correction Function
tau(x, y) = 1 - λ * μ * ρ  for (0, 0)
tau(x, y) = 1 + λ * ρ      for (0, 1)
tau(x, y) = 1 + μ * ρ      for (1, 0)
tau(x, y) = 1 - ρ          for (1, 1)
tau(x, y) = 1              otherwise

Empirical football correlation calibrated to ρ = -0.11.`,
  },
  {
    id: "rfc-007",
    number: "007",
    title: "Video Assistant Referee (VAR) & Semi-Automated Offside Technology (SAOT)",
    status: "Standard",
    category: "Officiating & Telemetry",
    authors: "Match Officiating Technology & Computer Vision Working Group",
    abstract:
      "IFAB 4-category review protocol, 120 FPS optical limb tracking, ball-release contact frame calibration, and subjective On-Field Review (OFR) probability models.",
    contentMarkdown: `## 1. SAOT Offside Determination
Anatomical points exclude hands and arms below the armpit line.
Margin_Δ = AttackerLimb_X - DefenderLimb_X
- Margin_Δ > 0 -> OFFSIDE (Factual disallow)
- Margin_Δ <= 0 -> ONSIDE (Goal confirmed)

Sensor confidence = 99.2% with millimeter line projection.`,
  },
  {
    id: "rfc-008",
    number: "008",
    title: "Stadium Microclimate Weather & Ball Physics Engine",
    status: "Standard",
    category: "Physics Simulation",
    authors: "Match Simulation Physics & Environmental Modeling Working Group",
    abstract:
      "Aerodynamic Rayleigh ball drag equations, turf moisture kinetic friction coefficients, wind vector deflection, and player thermal exhaustion multipliers.",
    contentMarkdown: `## 1. Turf Kinetic Friction
- Pristine Firm Ground: μ_k = 0.45
- Wet Slick Surface: μ_k = 0.32 (rapid transition passing)
- Waterlogged Pitch: μ_k = 0.68 (standing puddle deceleration)
- Frozen Snow: μ_k = 0.25 (extreme slippage)

## 2. Thermal Fatigue Factor
Depletes stamina 10.5% faster above 26°C, elevating late-game goal concession rates.`,
  },
  {
    id: "rfc-009",
    number: "009",
    title: "Anti-Fraud, Bot Velocity & Latency Arbitrage Detection Engine",
    status: "Standard",
    category: "Risk & Security",
    authors: "Information Security & Trading Risk Architecture",
    abstract:
      "Detection of sub-second courtsiding, high-frequency bot flooding (>5 bets/sec), syndicated IP clusters, composite Risk Index scoring, and automated delay gates.",
    contentMarkdown: `## 1. Risk Scoring Formula
Risk Index R = min(100, W_lat * S_lat + W_vel * S_vel + W_stake * S_stake + W_ip * S_ip)
- R < 40: Normal execution (< 50ms)
- 40 <= R < 70: 1.5s delay gate
- 70 <= R < 85: 3.5s delay gate + stake ceiling
- R >= 85: Immediate rejection (HTTP 403 SUSPICIOUS_ARBITRAGE)`,
  },
  {
    id: "rfc-010",
    number: "010",
    title: "Responsible Gaming, Player Safety & Regulatory Compliance Engine",
    status: "Standard",
    category: "Safer Play & Compliance",
    authors: "Regulatory Affairs & Player Safety Architecture",
    abstract:
      "UKGC/MGA player protection standards, deposit limits with mandatory 24-hour cooling-off delays for increases, reality check popups, time-out breaks, and self-exclusion.",
    contentMarkdown: `## 1. 24h Cooling-Off Rule
Decreasing a deposit limit takes effect instantaneously.
Increasing a deposit limit enters a mandatory 24-hour cooling-off lock.
At t + 24h, player must explicitly reconfirm. Unconfirmed requests lapse at t + 48h.

## 2. Reality Checks
Periodic modal interruption (15/30/45/60 mins) showing session net PnL and elapsed time.`,
  },
  {
    id: "rfc-011",
    number: "011",
    title: "Peer-to-Peer (P2P) Betting Exchange & Escrow Matching Architecture",
    status: "Standard",
    category: "P2P Exchange & Escrow",
    authors: "Exchange Matching & Derivatives Working Group",
    abstract:
      "Order book price-time matching, Backer stake vs Layer liability escrow collateral conservation, 2.0% net win fee model, and self-cross wash trading prevention.",
    contentMarkdown: `## 1. Escrow Collateral Equations
Backer Collateral: E_backer = S (stake in integer minor units)
Layer Collateral (Liability): E_layer = ceil(S * (Odds - 1.0))
Total Escrow Held: E_total = E_backer + E_layer = S * Odds

## 2. Post-Settlement Commission
Commission = floor(NetProfit * 0.02) if NetProfit > 0 else 0
Payout = E_total - Commission (credited to winner)
Commission credited to platform treasury reserve.`,
  },
  {
    id: "rfc-012",
    number: "012",
    title: "Fantasy Football Snake Draft & Free Agency Budget (FAB) Specification",
    status: "Standard",
    category: "Fantasy Draft & Waivers",
    authors: "Fantasy League Operations & Quantitative Modeling",
    abstract:
      "15-round serpentine snake draft rotation, Value-Over-Replacement Player (VORP) auto-pick metrics, and weekly blind-bid FAB waiver auctions.",
    contentMarkdown: `## 1. Serpentine Snake Pick Rotation
TeamIndex(R, k) = k if R is Odd, (N - k + 1) if R is Even.
Total picks = 15 * N across 15 rounds.

## 2. VORP Formulation
VORP(i) = ProjectedPoints(i) - ReplacementLevel(Position(i))
Optimizes positional advantage across GKP (2), DEF (5), MID (5), and FWD (3).

## 3. FAB Blind Bidding
Claims resolved in order of max(BidAmount_minor). Ties broken by rolling waiver priority rank.`,
  },
];

export default function DocsPage() {
  const [selectedRfcId, setSelectedRfcId] = useState<string>("rfc-001");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filteredRfcs = ALL_RFCS.filter((rfc) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      rfc.number.includes(q) ||
      rfc.title.toLowerCase().includes(q) ||
      rfc.category.toLowerCase().includes(q) ||
      rfc.abstract.toLowerCase().includes(q)
    );
  });

  const activeRfc = ALL_RFCS.find((r) => r.id === selectedRfcId) ?? ALL_RFCS[0]!;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse"></span>
            <span className="text-xs font-mono font-bold tracking-wider text-accent uppercase">
              Standards & Specifications
            </span>
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-white">
            Architecture RFCs & Technical Standards
          </h1>
          <p className="mt-1 text-sm text-fog max-w-2xl">
            Authoritative Requests for Comments (RFCs) governing the mathematical models, simulation
            mechanics, financial ledgers, and regulatory compliance of the Virtual Football Universe.
          </p>
        </div>

        {/* Total Standards Count */}
        <div className="flex items-center gap-3 bg-graphite border border-line rounded-lg px-4 py-2 self-start md:self-auto shadow-sm">
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Active RFCs</span>
            <span className="text-base font-bold text-accent font-mono">{ALL_RFCS.length} Standards</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Documentation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar RFC List */}
        <div className="lg:col-span-4 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Search specifications & formulas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded bg-graphite px-3 py-2 text-xs text-white placeholder-fog border border-line focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            />
          </div>

          <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
            {filteredRfcs.map((rfc) => {
              const isSelected = rfc.id === selectedRfcId;

              return (
                <button
                  key={rfc.id}
                  type="button"
                  onClick={() => setSelectedRfcId(rfc.id)}
                  className={`w-full text-left rounded-xl p-3.5 border transition flex flex-col gap-1.5 ${
                    isSelected
                      ? "bg-accent/15 border-accent/60 shadow-md shadow-accent/10"
                      : "bg-graphite border-line hover:border-line/80 hover:bg-line/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isSelected
                          ? "bg-accent text-ink"
                          : "bg-line text-fog"
                      }`}
                    >
                      RFC {rfc.number}
                    </span>
                    <span className="text-[10px] font-mono text-fog">{rfc.category}</span>
                  </div>

                  <h3
                    className={`text-xs font-bold leading-snug line-clamp-2 ${
                      isSelected ? "text-white" : "text-bone"
                    }`}
                  >
                    {rfc.title}
                  </h3>

                  <p className="text-[11px] text-fog line-clamp-2 leading-relaxed">
                    {rfc.abstract}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content Viewer */}
        <div className="lg:col-span-8">
          <DocViewer rfc={activeRfc} />
        </div>
      </div>
    </div>
  );
}
