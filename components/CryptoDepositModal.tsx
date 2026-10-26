"use client";

import React, { useState, useEffect } from "react";
import type { DisplayCurrency } from "./CurrencySelector";

interface CryptoDepositModalProps {
  onClose: () => void;
  userId?: string;
}

export function CryptoDepositModal({ onClose, userId = "usr-demo" }: CryptoDepositModalProps) {
  const [selectedAsset, setSelectedAsset] = useState<"BTC" | "ETH" | "SOL">("BTC");
  const [copied, setCopied] = useState(false);
  const [quoteSeconds, setQuoteSeconds] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteSeconds((prev) => (prev <= 1 ? 60 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const depositAddresses: Record<"BTC" | "ETH" | "SOL", { address: string; network: string; minDeposit: string }> = {
    BTC: {
      address: "bc1q9vfl8472901kdna7294810slmv7294ka9184k2",
      network: "Bitcoin Native SegWit (Bech32)",
      minDeposit: "0.0005 BTC (~34.00 XTS)",
    },
    ETH: {
      address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      network: "Ethereum Mainnet (ERC-20)",
      minDeposit: "0.01 ETH (~35.00 XTS)",
    },
    SOL: {
      address: "Sol7VFL9482kLmNqP91048ZtmV82049LpqmZ7492kVFL",
      network: "Solana High-Speed Network",
      minDeposit: "0.1 SOL (~18.00 XTS)",
    },
  };

  const currentInfo = depositAddresses[selectedAsset];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentInfo.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-graphite p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent animate-ping"></span>
            <h3 className="text-base font-bold text-white">Instant Cryptocurrency Deposit</h3>
          </div>
          <button type="button" onClick={onClose} className="text-fog hover:text-white">
            ✕
          </button>
        </div>

        {/* Asset Selector */}
        <div>
          <label className="text-[10px] font-mono text-fog uppercase block mb-1.5">
            Select Deposit Asset
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["BTC", "ETH", "SOL"] as const).map((coin) => (
              <button
                key={coin}
                type="button"
                onClick={() => setSelectedAsset(coin)}
                className={`rounded-lg p-2.5 text-xs text-center border font-mono transition ${
                  selectedAsset === coin
                    ? "bg-accent text-ink border-accent font-bold shadow-md shadow-accent/20"
                    : "bg-line text-fog border-transparent hover:text-white"
                }`}
              >
                {coin === "BTC" ? "Bitcoin (BTC)" : coin === "ETH" ? "Ethereum (ETH)" : "Solana (SOL)"}
              </button>
            ))}
          </div>
        </div>

        {/* Address Card & QR Placeholder */}
        <div className="rounded-xl bg-ink/60 border border-line p-4 space-y-3">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-fog">Network:</span>
            <span className="text-white font-bold">{currentInfo.network}</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono text-fog uppercase block">Your Segregated Deposit Address</span>
            <div className="flex items-center gap-2 bg-graphite p-2.5 rounded-lg border border-line/80 font-mono text-xs">
              <code className="text-accent flex-1 truncate">{currentInfo.address}</code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded bg-line px-2.5 py-1 text-[11px] font-bold text-white hover:bg-line/80 shrink-0"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>

          <div className="border-t border-line/40 pt-2 flex items-center justify-between text-[11px] font-mono text-fog">
            <span>Minimum Deposit:</span>
            <span className="text-bone">{currentInfo.minDeposit}</span>
          </div>
        </div>

        {/* Oracle Rate Countdown */}
        <div className="flex items-center justify-between rounded-lg bg-line/40 p-2.5 text-xs font-mono text-fog">
          <span>Oracle Price Locked For:</span>
          <span className="text-accent font-bold">{quoteSeconds}s remaining</span>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-accent px-5 py-2 text-xs font-black text-ink hover:brightness-110 transition shadow-md shadow-accent/20"
          >
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
}
