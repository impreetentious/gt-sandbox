import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IpdPlayExperience } from "@/components/arena/ipd-play";
import { OneShotPlayExperience } from "@/components/arena/one-shot-play";
import { PdPlayExperience } from "@/components/arena/pd-play";

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

const descriptions: Record<GameSlug, string> = {
  pd: "Play a price-war Prisoner's Dilemma, then inspect its exact dominance and equilibrium analysis.",
  "stag-hunt": "Test trust against safety in a standards-adoption Stag Hunt.",
  "battle-of-the-sexes":
    "Experience commitment and focal points in mixed-motive coordination.",
  chicken:
    "Play a capacity-war game of brinkmanship and inspect its exact mixed equilibrium.",
  "matching-pennies":
    "Face a pattern exploiter and see why an unpredictable mixed strategy can be rational.",
  "iterated-pd":
    "Play a seeded repeated Prisoner's Dilemma with mystery rivals and a counterfactual replay.",
};

const ogSlugs: Record<GameSlug, string> = {
  pd: "pd",
  "stag-hunt": "stag-hunt",
  "battle-of-the-sexes": "battle-of-the-sexes",
  chicken: "chicken",
  "matching-pennies": "matching-pennies",
  "iterated-pd": "iterated-pd",
};

export function generateStaticParams(): Array<{ game: GameSlug }> {
  return games.map((game) => ({ game }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ game: string }>;
}): Promise<Metadata> {
  const { game } = await params;

  if (!games.includes(game as GameSlug)) {
    return { title: "Game not found" };
  }

  const slug = game as GameSlug;
  return {
    title: labels[slug],
    description: descriptions[slug],
    openGraph: {
      images: [
        {
          url: `/og/${ogSlugs[slug]}.png`,
          width: 1200,
          height: 630,
          alt: `${labels[slug]} payoff matrix`,
        },
      ],
    },
    twitter: { images: [`/og/${ogSlugs[slug]}.png`] },
  };
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

  if (game === "iterated-pd") {
    return <IpdPlayExperience />;
  }

  const oneShotSlugs = {
    "stag-hunt": "stag",
    "battle-of-the-sexes": "bos",
    chicken: "chicken",
    "matching-pennies": "pennies",
  } as const;

  if (game in oneShotSlugs) {
    return (
      <OneShotPlayExperience
        slug={oneShotSlugs[game as keyof typeof oneShotSlugs]}
      />
    );
  }

  notFound();
}
