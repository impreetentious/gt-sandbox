import type { Metadata } from "next";
import { TournamentExperience } from "@/components/evolve/tournament-experience";

export const metadata: Metadata = {
  title: "Tournament and Evolution",
  description:
    "Run a seeded round-robin over eight repeated-game strategies and inspect frozen replicator-dynamics stories.",
};

export default function EvolvePage() {
  return <TournamentExperience />;
}
