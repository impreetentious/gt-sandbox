import type { Metadata } from "next";
import { SpatialExperience } from "@/components/evolve/spatial-experience";

export const metadata: Metadata = {
  title: "Spatial Evolution",
  description:
    "Play the Prisoner's Dilemma on a lattice where every cell meets only its neighbours, and watch cooperator clusters survive a game that has no cooperative equilibrium when the population is well mixed.",
};

export default function SpatialEvolutionPage() {
  return <SpatialExperience />;
}
