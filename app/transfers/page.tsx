import { Metadata } from "next";
import { TransferMarketHub } from "@/components/TransferMarketHub";

export const metadata: Metadata = {
  title: "Transfer Market & FFP Desk | VFL Virtual Sports",
  description: "Scout top European football stars, negotiate transfer fees, trigger contractual release clauses, and manage UEFA Financial Fair Play (FFP) compliance.",
};

export default function TransfersPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <TransferMarketHub />
    </div>
  );
}
