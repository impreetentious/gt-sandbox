import type { Metadata } from "next";
import { GameWorkbench } from "@/components/build/game-workbench";

export const metadata: Metadata = {
  title: "Build a Game",
  description:
    "Create a bounded normal-form game, solve it exactly, and share its complete state in a reproducible URL.",
};

export default function BuildPage() {
  return <GameWorkbench />;
}
