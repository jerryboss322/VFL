import { Metadata } from "next";
import { P2PBetExchangeHub } from "@/components/P2PBetExchangeHub";

export const metadata: Metadata = {
  title: "P2P Betting Exchange | VFL Virtual Sports",
  description: "Peer-to-peer sports betting exchange. Back and Lay outcomes directly against traders with zero bookmaker margin and full escrow safety.",
};

export default function P2PExchangePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <P2PBetExchangeHub />
    </div>
  );
}
