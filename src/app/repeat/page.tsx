import type { Metadata } from "next";
import { RepeatedGameExperience } from "@/components/repeat/repeated-experience";

export const metadata: Metadata = {
  title: "Repeat",
  description:
    "Iterate any 2×2 game with the full strategy roster and see the folk-theorem region: feasible and individually-rational payoffs, with the exact discount threshold that sustains cooperation.",
};

export default function RepeatPage() {
  return <RepeatedGameExperience />;
}
