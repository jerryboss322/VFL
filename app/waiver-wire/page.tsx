import { Metadata } from "next";
import { WaiverWireHub } from "@/components/WaiverWireHub";

export const metadata: Metadata = {
  title: "Fantasy Waiver Wire & Free Agency | VFL Virtual Sports",
  description: "Manage free agent acquisitions, submit blind-bid FAB claims, and track weekly waiver clearing priority.",
};

export default function WaiverWirePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <WaiverWireHub />
    </div>
  );
}
