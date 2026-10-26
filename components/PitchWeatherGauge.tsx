"use client";

import React, { useMemo } from "react";

export interface WeatherData {
  condition: "CLEAR" | "OVERCAST" | "LIGHT_RAIN" | "HEAVY_RAIN" | "SNOW" | "FOG";
  temperature: number;
  humidity: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  turf: "DRY_FIRM" | "SLICK_FAST" | "WET_SLOW" | "WATERLOGGED" | "FROZEN";
  ballFriction: number;
  passingErrorMult: number;
}

interface PitchWeatherGaugeProps {
  country?: string;
  weather?: WeatherData;
}

export function PitchWeatherGauge({ country = "England", weather }: PitchWeatherGaugeProps) {
  // Generate realistic default weather profile if not provided
  const activeWeather = useMemo<WeatherData>(() => {
    if (weather) return weather;

    const countryDefaults: Record<string, Partial<WeatherData>> = {
      Spain: { condition: "CLEAR", temperature: 24, humidity: 48, windSpeedKmh: 14, turf: "DRY_FIRM", ballFriction: 0.50, passingErrorMult: 1.0 },
      Germany: { condition: "OVERCAST", temperature: 14, humidity: 65, windSpeedKmh: 18, turf: "DRY_FIRM", ballFriction: 0.52, passingErrorMult: 1.05 },
      England: { condition: "LIGHT_RAIN", temperature: 12, humidity: 82, windSpeedKmh: 24, turf: "SLICK_FAST", ballFriction: 0.42, passingErrorMult: 1.12 },
      Italy: { condition: "CLEAR", temperature: 22, humidity: 52, windSpeedKmh: 12, turf: "DRY_FIRM", ballFriction: 0.50, passingErrorMult: 1.0 },
      France: { condition: "OVERCAST", temperature: 16, humidity: 60, windSpeedKmh: 16, turf: "DRY_FIRM", ballFriction: 0.51, passingErrorMult: 1.02 },
      Netherlands: { condition: "LIGHT_RAIN", temperature: 11, humidity: 85, windSpeedKmh: 28, turf: "SLICK_FAST", ballFriction: 0.40, passingErrorMult: 1.15 },
    };

    const d = countryDefaults[country] ?? {
      condition: "LIGHT_RAIN" as const,
      temperature: 12,
      humidity: 82,
      windSpeedKmh: 24,
      turf: "SLICK_FAST" as const,
      ballFriction: 0.42,
      passingErrorMult: 1.12,
    };
    return {
      condition: d.condition || "CLEAR",
      temperature: d.temperature || 18,
      humidity: d.humidity || 60,
      windSpeedKmh: d.windSpeedKmh || 15,
      windDirectionDeg: 215,
      turf: d.turf || "DRY_FIRM",
      ballFriction: d.ballFriction || 0.5,
      passingErrorMult: d.passingErrorMult || 1.0,
    };
  }, [country, weather]);

  const conditionIcon = {
    CLEAR: "☀️",
    OVERCAST: "☁️",
    LIGHT_RAIN: "🌧️",
    HEAVY_RAIN: "⛈️",
    SNOW: "❄️",
    FOG: "🌫️",
  }[activeWeather.condition] || "☀️";

  const isAdverse = activeWeather.condition !== "CLEAR" && activeWeather.condition !== "OVERCAST";

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 shadow-lg space-y-3">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{conditionIcon}</span>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-200">
              Stadium Weather & Turf Physics
            </h4>
            <span className="text-[10px] text-neutral-400 font-mono">
              {country} • {activeWeather.condition.replace(/_/g, " ")} • {activeWeather.turf.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="text-right font-mono text-xs">
          <span className="font-bold text-neutral-100">{activeWeather.temperature}°C</span>
          <span className="text-[10px] text-neutral-500 block">Humidity: {activeWeather.humidity}%</span>
        </div>
      </div>

      {/* Weather telemetry grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2 text-center">
          <span className="text-[9px] text-neutral-500 block uppercase">Wind Velocity</span>
          <span className="font-bold text-neutral-200 flex items-center justify-center gap-1 mt-0.5">
            <span>{activeWeather.windSpeedKmh} km/h</span>
            <span
              style={{ transform: `rotate(${activeWeather.windDirectionDeg}deg)` }}
              className="inline-block text-amber-400 text-xs"
            >
              ↑
            </span>
          </span>
        </div>

        <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2 text-center">
          <span className="text-[9px] text-neutral-500 block uppercase">Turf Moisture</span>
          <span className="font-bold text-neutral-200 mt-0.5 block">
            {activeWeather.turf === "SLICK_FAST" ? "Fast / Slick" : activeWeather.turf === "WATERLOGGED" ? "Heavy" : "Firm / Dry"}
          </span>
        </div>

        <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2 text-center">
          <span className="text-[9px] text-neutral-500 block uppercase">Ball Roll Friction</span>
          <span className="font-bold text-amber-400 mt-0.5 block">
            μ = {activeWeather.ballFriction.toFixed(2)}
          </span>
        </div>

        <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2 text-center">
          <span className="text-[9px] text-neutral-500 block uppercase">Pass Drift Error</span>
          <span className={`font-bold mt-0.5 block ${activeWeather.passingErrorMult > 1.1 ? "text-rose-400" : "text-emerald-400"}`}>
            {activeWeather.passingErrorMult > 1.0 ? `+${Math.round((activeWeather.passingErrorMult - 1.0) * 100)}%` : "Nominal"}
          </span>
        </div>
      </div>

      {/* Adverse conditions tactical impact banner */}
      {isAdverse && (
        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-300 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            {activeWeather.condition === "HEAVY_RAIN"
              ? "Waterlogged surface: short passing slowed, increased long-range shooting deflection hazard."
              : activeWeather.condition === "LIGHT_RAIN"
                ? "Slick surface: ball accelerates off turf skips, goalkeeper handling slip risk elevated."
                : "Freezing turf: reduced ball bounce restitution, increased muscle fatigue burn rate."}
          </span>
        </div>
      )}
    </div>
  );
}
