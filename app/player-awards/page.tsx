import { Metadata } from "next";
import { PlayerAwardsCenter } from "@/components/PlayerAwardsCenter";

export const metadata: Metadata = {
  title: "Player Honors & Awards | VFL Virtual Sports",
  description: "Track the seasonal race for the Golden Boot, Playmaker Award, Golden Glove, and Fair Play Trophy with per-90 metrics.",
};

export default function PlayerAwardsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PlayerAwardsCenter />
    </div>
  );
}
