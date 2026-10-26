"use client";

import React, { useState } from "react";
import { VarReviewModal, type VarIncidentData } from "@/components/VarReviewModal";

const MOCK_VAR_INCIDENTS: VarIncidentData[] = [
  {
    id: "var-9901-mci-liv",
    matchId: "m-eng-01",
    homeTeam: "Manchester Blue",
    awayTeam: "Liverpool Red",
    minute: 74,
    incidentType: "GOAL_POSSIBLE_OFFSIDE",
    onFieldDecision: "Goal Awarded (Onside)",
    reviewOutcome: "OVERTURNED_GOAL_DISALLOWED",
    monitorReviewConducted: false,
    reviewDurationSeconds: 84,
    narrativeExplanation:
      "Semi-Automated Offside Technology (SAOT) 3D skeletal tracking confirmed the attacker's leading kneecap was 28.4mm beyond the last defender's boot at the exact millisecond of ball release.",
    telemetry: {
      attackerLimbXMm: 48284,
      defenderLimbXMm: 48256,
      marginMm: 28.4,
      isOffside: true,
      confidenceLevel: 0.992,
      calibratedFrame: 14890,
    },
  },
  {
    id: "var-9902-rm-bar",
    matchId: "m-esp-01",
    homeTeam: "Madrid Chamartín",
    awayTeam: "Barcelona Blau",
    minute: 38,
    incidentType: "PENALTY_POSSIBLE_FOUL",
    onFieldDecision: "Play On (No Penalty)",
    reviewOutcome: "OVERTURNED_PENALTY_AWARDED",
    monitorReviewConducted: true,
    reviewDurationSeconds: 112,
    narrativeExplanation:
      "Referee attended pitchside monitor (OFR). Replays clearly indicated direct studs contact on the attacker's ankle without ball contact inside the 18-yard box.",
  },
  {
    id: "var-9903-bay-dor",
    matchId: "m-ger-01",
    homeTeam: "Munich Red",
    awayTeam: "Dortmund Black-Yellow",
    minute: 88,
    incidentType: "POSSIBLE_RED_CARD",
    onFieldDecision: "Yellow Card Caution",
    reviewOutcome: "OVERTURNED_RED_CARD_AWARDED",
    monitorReviewConducted: true,
    reviewDurationSeconds: 95,
    narrativeExplanation:
      "Reckless challenge above the ankle with excessive force and endangered player safety. Original yellow upgraded to direct red card after on-field monitor review.",
  },
  {
    id: "var-9904-int-mil",
    matchId: "m-ita-01",
    homeTeam: "Milan Nerazzurri",
    awayTeam: "Milan Rossoneri",
    minute: 19,
    incidentType: "GOAL_POSSIBLE_HANDBALL",
    onFieldDecision: "Goal Awarded",
    reviewOutcome: "CONFIRMED_ORIGINAL_DECISION",
    monitorReviewConducted: false,
    reviewDurationSeconds: 52,
    narrativeExplanation:
      "Ball made contact with the attacking winger's upper shoulder region (above the armpit line), within legal IFAB anatomical guidelines. Goal stands.",
  },
  {
    id: "var-9905-ars-che",
    matchId: "m-eng-02",
    homeTeam: "London North",
    awayTeam: "London Blue",
    minute: 61,
    incidentType: "PENALTY_POSSIBLE_DIVING",
    onFieldDecision: "Penalty Awarded",
    reviewOutcome: "OVERTURNED_PENALTY_CANCELLED",
    monitorReviewConducted: true,
    reviewDurationSeconds: 78,
    narrativeExplanation:
      "Pitchside monitor showed no contact initiated by the defender. The forward initiated contact and dragged feet. Penalty revoked, simulation yellow card issued.",
  },
  {
    id: "var-9906-psg-mar",
    matchId: "m-fra-01",
    homeTeam: "Paris Red-Blue",
    awayTeam: "Marseille Phocéen",
    minute: 82,
    incidentType: "GOAL_POSSIBLE_OFFSIDE",
    onFieldDecision: "Flag Up (Offside)",
    reviewOutcome: "CONFIRMED_ORIGINAL_DECISION",
    monitorReviewConducted: false,
    reviewDurationSeconds: 65,
    narrativeExplanation:
      "SAOT lines confirmed attacker was ahead of the last defender by 142.1mm. Factual offside confirmed by booth.",
    telemetry: {
      attackerLimbXMm: 52142,
      defenderLimbXMm: 52000,
      marginMm: 142.1,
      isOffside: true,
      confidenceLevel: 0.999,
      calibratedFrame: 18210,
    },
  },
];

export default function VarCenterPage() {
  const [selectedIncident, setSelectedIncident] = useState<VarIncidentData | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");

  const filteredIncidents = MOCK_VAR_INCIDENTS.filter((inc) => {
    if (filterType === "ALL") return true;
    if (filterType === "OFFSIDE") return inc.incidentType === "GOAL_POSSIBLE_OFFSIDE";
    if (filterType === "PENALTY") return inc.incidentType.startsWith("PENALTY");
    if (filterType === "RED_CARD") return inc.incidentType === "POSSIBLE_RED_CARD";
    if (filterType === "OVERTURNED") return inc.reviewOutcome.startsWith("OVERTURNED");
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-xs font-mono font-bold tracking-wider text-red-400 uppercase">
              Official Hub
            </span>
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-white">
            VAR Central Match Operations & SAOT
          </h1>
          <p className="mt-1 text-sm text-fog max-w-2xl">
            Semi-Automated Offside Technology (SAOT), high-speed 3D limb telemetry, and on-field monitor
            review decisions across all European Virtual Football League fixtures.
          </p>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-3 bg-graphite border border-line rounded-lg px-4 py-2 self-start md:self-auto">
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Total Reviews</span>
            <span className="text-base font-bold text-white">248</span>
          </div>
          <div className="h-8 w-px bg-line"></div>
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Overturn Rate</span>
            <span className="text-base font-bold text-accent">68.2%</span>
          </div>
          <div className="h-8 w-px bg-line"></div>
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Avg Time</span>
            <span className="text-base font-bold text-white">74s</span>
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-fog mr-2 font-mono">FILTERS:</span>
        {[
          { id: "ALL", label: "All Incidents" },
          { id: "OFFSIDE", label: "Offside (SAOT)" },
          { id: "PENALTY", label: "Penalties" },
          { id: "RED_CARD", label: "Direct Red Cards" },
          { id: "OVERTURNED", label: "Overturned Only" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filterType === tab.id
                ? "bg-accent text-ink font-bold shadow-md shadow-accent/20"
                : "bg-graphite text-fog hover:text-white border border-line"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Incidents Feed */}
      <div className="space-y-4">
        {filteredIncidents.map((incident) => {
          const isOverturned = incident.reviewOutcome.startsWith("OVERTURNED");

          return (
            <div
              key={incident.id}
              className="rounded-xl border border-line bg-graphite p-5 transition hover:border-line/80 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-3">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-line px-2 py-0.5 text-xs font-mono font-bold text-bone">
                    MIN {incident.minute}&apos;
                  </span>
                  <span className="text-sm font-bold text-white">
                    {incident.homeTeam} vs {incident.awayTeam}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2.5 py-0.5 text-xs font-bold font-mono border ${
                      isOverturned
                        ? "bg-red-500/10 text-red-400 border-red-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    {isOverturned ? "DECISION OVERTURNED" : "DECISION CONFIRMED"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                <div className="lg:col-span-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="text-fog">
                      Incident: <strong className="text-white">{incident.incidentType.replace(/_/g, " ")}</strong>
                    </span>
                    <span className="text-fog">
                      On-field Call: <strong className="text-amber-400">{incident.onFieldDecision}</strong>
                    </span>
                    <span className="text-fog">
                      Review Duration: <strong className="text-white">{incident.reviewDurationSeconds}s</strong>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {incident.narrativeExplanation}
                  </p>

                  {incident.telemetry && (
                    <div className="flex items-center gap-4 text-[11px] font-mono text-fog pt-1">
                      <span>
                        Delta Margin:{" "}
                        <strong className="text-red-400">
                          {incident.telemetry.marginMm > 0 ? `+${incident.telemetry.marginMm}mm` : `${incident.telemetry.marginMm}mm`}
                        </strong>
                      </span>
                      <span>
                        Limb Tracking: <strong className="text-white">Active (120 FPS)</strong>
                      </span>
                      <span>
                        Confidence:{" "}
                        <strong className="text-accent">
                          {Math.round(incident.telemetry.confidenceLevel * 100)}%
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end lg:border-l lg:border-line/60 lg:pl-4">
                  <button
                    type="button"
                    onClick={() => setSelectedIncident(incident)}
                    className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition shadow-sm"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View SAOT Replay
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Protocol Explanation Footer */}
      <div className="rounded-xl border border-line bg-charcoal p-6 text-xs text-fog space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          IFAB VAR & Semi-Automated Offside Protocol (Virtual Sports Edition)
        </h3>
        <p className="leading-relaxed">
          VAR operates under the principle of <em>&ldquo;minimum interference, maximum benefit&rdquo;</em>. Reviews are
          strictly restricted to four game-changing match situations: Goal / No Goal, Penalty / No Penalty,
          Direct Red Card, and Mistaken Identity.
        </p>
        <p className="leading-relaxed">
          Semi-Automated Offside Technology utilizes synchronized 120 FPS optical tracking with 29 anatomical points
          per player to construct 3D skeletal meshes in real-time, delivering millimeter accuracy for offside calls.
        </p>
      </div>

      {/* Replay Modal */}
      <VarReviewModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
      />
    </div>
  );
}
