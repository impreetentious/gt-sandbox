import { catalogBySlug } from "@/engine/catalog";
import type { GameSlug } from "@/engine/catalog/types";
import type { OneShotOpponentPolicy } from "@/engine/repeated/policies";
import { encodeGameSearch } from "@/state/game-url";

/**
 * Builds a shareable assignment link a teacher can hand to students. Play
 * assignments pin the rival persona and seed through the existing versioned
 * game-URL codec, so every student faces the identical sequence; the other
 * surfaces are deep links to the exercise. Everything is a static path — the
 * link encodes the whole assignment, with no server to look anything up (I4).
 */
export type AssignmentSurface = "play" | "hot-seat" | "auction";

export interface AssignmentSpec {
  readonly surface: AssignmentSurface;
  readonly target: string;
  readonly persona?: string;
  readonly seed?: number;
}

const ROUTE_SLUG: Record<string, string> = {
  pd: "pd",
  stag: "stag-hunt",
  bos: "battle-of-the-sexes",
  chicken: "chicken",
  pennies: "matching-pennies",
};

const CATALOG_SLUG: Record<string, GameSlug> = {
  pd: "pd",
  stag: "stag",
  bos: "bos",
  chicken: "chicken",
  pennies: "pennies",
};

export const ASSIGNMENT_TARGETS: Readonly<
  Record<
    AssignmentSurface,
    readonly { readonly value: string; readonly label: string }[]
  >
> = {
  play: [
    { value: "pd", label: "Prisoner's Dilemma" },
    { value: "stag", label: "Stag Hunt" },
    { value: "bos", label: "Battle of the Sexes" },
    { value: "chicken", label: "Chicken" },
    { value: "pennies", label: "Matching Pennies" },
  ],
  "hot-seat": [
    { value: "pd", label: "Prisoner's Dilemma" },
    { value: "stag", label: "Stag Hunt" },
    { value: "bos", label: "Battle of the Sexes" },
    { value: "chicken", label: "Chicken" },
    { value: "pennies", label: "Matching Pennies" },
  ],
  auction: [
    { value: "first-price", label: "First-price sealed bid" },
    { value: "second-price", label: "Second-price sealed bid" },
    { value: "common-value", label: "Common value" },
  ],
};

export function buildAssignmentPath(spec: AssignmentSpec): string {
  if (spec.surface === "hot-seat") {
    const slug = ROUTE_SLUG[spec.target];
    if (!slug) {
      throw new RangeError(`Unknown hot-seat target: ${spec.target}`);
    }
    return `/hot-seat/${slug}/`;
  }

  if (spec.surface === "auction") {
    if (
      !ASSIGNMENT_TARGETS.auction.some((entry) => entry.value === spec.target)
    ) {
      throw new RangeError(`Unknown auction target: ${spec.target}`);
    }
    return `/auctions/${spec.target}/`;
  }

  const routeSlug = ROUTE_SLUG[spec.target];
  const catalogSlug = CATALOG_SLUG[spec.target];
  if (!routeSlug || !catalogSlug) {
    throw new RangeError(`Unknown play target: ${spec.target}`);
  }

  const search = encodeGameSearch({
    game: catalogBySlug[catalogSlug].game,
    extras: {
      ...(spec.persona !== undefined
        ? { persona: spec.persona as OneShotOpponentPolicy }
        : {}),
      ...(spec.seed !== undefined ? { seed: spec.seed } : {}),
    },
  });

  return `/play/${routeSlug}/?${search}`;
}
