import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HotSeatPlayExperience } from "@/components/arena/hot-seat-play";
import type { HotSeatSlug } from "@/content/hot-seat";

const routeSlugs = {
  pd: "pd",
  "stag-hunt": "stag",
  "battle-of-the-sexes": "bos",
  chicken: "chicken",
  "matching-pennies": "pennies",
} as const;

type RouteSlug = keyof typeof routeSlugs;

const labels: Record<RouteSlug, string> = {
  pd: "Prisoner's Dilemma",
  "stag-hunt": "Stag Hunt",
  "battle-of-the-sexes": "Battle of the Sexes",
  chicken: "Chicken",
  "matching-pennies": "Matching Pennies",
};

export function generateStaticParams(): Array<{ game: RouteSlug }> {
  return (Object.keys(routeSlugs) as RouteSlug[]).map((game) => ({ game }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ game: string }>;
}): Promise<Metadata> {
  const { game } = await params;
  if (!(game in routeSlugs)) {
    return { title: "Game not found" };
  }
  const slug = game as RouteSlug;
  return {
    title: `Hot-seat ${labels[slug]}`,
    description: `Play ${labels[slug]} against another person on one device, with commit-and-conceal simultaneity and the full analysis drawer.`,
  };
}

export default async function HotSeatGamePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  if (!(game in routeSlugs)) {
    notFound();
  }
  const slug: HotSeatSlug = routeSlugs[game as RouteSlug];
  return <HotSeatPlayExperience slug={slug} />;
}
