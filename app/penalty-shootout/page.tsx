import { Metadata } from "next";
import { PenaltyShootoutVisualizer } from "@/components/PenaltyShootoutVisualizer";

export const metadata: Metadata = {
  title: "Penalty Shootout Stage | VFL Virtual Sports",
  description: "Experience sudden-death penalty shootouts, select goal corners, and watch goalkeeper dive physics and net reactions.",
};

export default function PenaltyShootoutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PenaltyShootoutVisualizer />
    </div>
  );
}
