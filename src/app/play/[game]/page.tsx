import { notFound } from "next/navigation";
import { PdPlayExperience } from "@/components/arena/pd-play";
import { StubPage } from "@/components/stub-page";

const games = [
  "pd",
  "stag-hunt",
  "battle-of-the-sexes",
  "chicken",
  "matching-pennies",
  "iterated-pd",
] as const;

type GameSlug = (typeof games)[number];

const labels: Record<GameSlug, string> = {
  pd: "Prisoner's Dilemma",
  "stag-hunt": "Stag Hunt",
  "battle-of-the-sexes": "Battle of the Sexes",
  chicken: "Chicken",
  "matching-pennies": "Matching Pennies",
  "iterated-pd": "Iterated Prisoner's Dilemma",
};

export function generateStaticParams(): Array<{ game: GameSlug }> {
  return games.map((game) => ({ game }));
}

export default async function PlayGamePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;

  if (!games.includes(game as GameSlug)) {
    notFound();
  }

  if (game === "pd") {
    return <PdPlayExperience />;
  }

  return (
    <StubPage
      eyebrow="Play / Static route"
      title={labels[game as GameSlug]}
      summary="This game route has been prerendered and is ready for the play loop built in the next phases."
    />
  );
}
