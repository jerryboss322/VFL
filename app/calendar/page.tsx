import { Metadata } from "next";
import { FixtureCalendarGrid } from "@/components/FixtureCalendarGrid";

export const metadata: Metadata = {
  title: "Season Fixture Calendar | VFL Virtual Sports",
  description: "Explore the full double round-robin league schedule, browse matchdays, view kickoff times, and examine live scores.",
};

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <FixtureCalendarGrid />
    </div>
  );
}
