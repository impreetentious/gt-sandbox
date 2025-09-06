import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExtensivePlayExperience } from "@/components/arena/extensive-play";
import type { ExtensiveSlug } from "@/engine/catalog/extensive";

const games: readonly ExtensiveSlug[] = ["entry-deterrence"];

const labels: Record<ExtensiveSlug, string> = {
  "entry-deterrence": "Entry Deterrence",
};

const descriptions: Record<ExtensiveSlug, string> = {
  "entry-deterrence":
    "Decide whether to enter a monopoly, watch the incumbent respond, then see backward induction extract the subgame-perfect equilibrium.",
};

export function generateStaticParams(): Array<{ game: ExtensiveSlug }> {
  return games.map((game) => ({ game }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ game: string }>;
}): Promise<Metadata> {
  const { game } = await params;
  if (!(games as readonly string[]).includes(game)) {
    return { title: "Game not found" };
  }
  const slug = game as ExtensiveSlug;
  return { title: labels[slug], description: descriptions[slug] };
}

export default async function ExtensiveGamePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  if (!(games as readonly string[]).includes(game)) {
    notFound();
  }
  return <ExtensivePlayExperience slug={game as ExtensiveSlug} />;
}
