import { notFound } from "next/navigation";

import { GameWorkbench } from "@/components/build/game-workbench";
import { catalogBySlug, type GameSlug } from "@/engine/catalog";

const embeddedGames = [
  "pd",
  "stag",
  "bos",
  "chicken",
  "pennies",
  "ipd",
] as const;

export function generateStaticParams(): Array<{
  game: (typeof embeddedGames)[number];
}> {
  return embeddedGames.map((game) => ({ game }));
}

export default async function EmbedGamePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  if (!embeddedGames.includes(game as (typeof embeddedGames)[number]))
    notFound();
  const catalogGame = catalogBySlug[game as GameSlug];
  return (
    <div className="embed-game">
      <h1 className="sr-only">
        {catalogGame.game.title} interactive game embed
      </h1>
      <GameWorkbench defaultGame={catalogGame.game} variant="embedded" />
    </div>
  );
}
