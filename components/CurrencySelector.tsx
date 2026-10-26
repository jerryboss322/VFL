"use client";

import React from "react";

export type DisplayCurrency = "XTS" | "EUR" | "GBP" | "USD" | "BTC" | "ETH" | "SOL";

interface CurrencySelectorProps {
  currentCurrency: DisplayCurrency;
  onChangeCurrency: (currency: DisplayCurrency) => void;
}

export const CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  XTS: "XTS",
  EUR: "€",
  GBP: "£",
  USD: "$",
  BTC: "₿",
  ETH: "Ξ",
  SOL: "◎",
};

export const EXCHANGE_RATES_FROM_XTS: Record<DisplayCurrency, number> = {
  XTS: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  USD: 1.0,
  BTC: 0.0000146,
  ETH: 0.000286,
  SOL: 0.00556,
};

export function CurrencySelector({ currentCurrency, onChangeCurrency }: CurrencySelectorProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-line px-2 py-1 text-xs font-mono">
      <span className="text-fog text-[10px] uppercase">CURR:</span>
      <select
        value={currentCurrency}
        onChange={(e) => onChangeCurrency(e.target.value as DisplayCurrency)}
        className="bg-transparent text-white font-bold focus-visible:outline-none cursor-pointer"
        aria-label="Select display currency"
      >
        <option value="XTS" className="bg-graphite text-white">XTS (Default)</option>
        <option value="USD" className="bg-graphite text-white">USD ($)</option>
        <option value="EUR" className="bg-graphite text-white">EUR (€)</option>
        <option value="GBP" className="bg-graphite text-white">GBP (£)</option>
        <option value="BTC" className="bg-graphite text-white">BTC (₿)</option>
        <option value="ETH" className="bg-graphite text-white">ETH (Ξ)</option>
        <option value="SOL" className="bg-graphite text-white">SOL (◎)</option>
      </select>
    </div>
  );
}
