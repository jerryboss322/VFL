import { Metadata } from "next";
import { FantasyDraftRoom } from "@/components/FantasyDraftRoom";

export const metadata: Metadata = {
  title: "Fantasy Live Snake Draft | VFL Virtual Sports",
  description: "Live 15-round fantasy football snake draft war room with VORP algorithmic analysis, turn timers, and positional quota enforcement.",
};

export default function FantasyDraftPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <FantasyDraftRoom />
    </div>
  );
}
