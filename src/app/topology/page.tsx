import type { Metadata } from "next";

import { TopologyAtlas } from "@/components/topology/topology-atlas";

export const metadata: Metadata = {
  title: "2×2 topology atlas",
  description: "Browse all 144 strict ordinal 2×2 games with exact strategic classification.",
};

export default function TopologyPage() {
  return <TopologyAtlas />;
}
