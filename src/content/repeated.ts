import type { GameSlug } from "@/engine/catalog/types";
import type { NormalFormGame } from "@/engine/game";

export type RepeatableSlug = Exclude<GameSlug, "ipd">;

/** The action index each player treats as "cooperate" in repeated play. */
export interface CooperativeProfile {
  readonly row: 0 | 1;
  readonly column: 0 | 1;
}

/**
 * Everything the Repeat surface needs to iterate a stage game. Catalog games carry an authored
 * one; a Build-mode custom game gets one derived at read time, because the engine is generic
 * over any 2×2 and only the framing was ever catalog-specific.
 */
interface RepeatFraming {
  readonly framing: string;
  readonly cooperate: CooperativeProfile;
  readonly cooperateLabel: string;
  readonly defectLabel: string;
  /** An honesty note when "cooperation" is not the game's natural lesson. */
  readonly caveat?: string;
}

interface RepeatableGameContent extends RepeatFraming {
  readonly slug: RepeatableSlug;
}

/**
 * Framing for a game the user built themselves.
 *
 * A catalog game arrives with an authored cooperative profile because somebody decided which
 * action "holding price" is. A custom game has no such answer, so the caller supplies one and
 * this labels it from the game's own action names. Nothing is guessed: designating the
 * cooperative outcome is a modelling choice, and the surface makes the user make it.
 */
export function customRepeatFraming(
  game: NormalFormGame,
  cooperate: CooperativeProfile,
): RepeatFraming {
  const cooperateLabel = game.rowActions[cooperate.row] ?? "Cooperate";
  const defectLabel = game.rowActions[cooperate.row === 0 ? 1 : 0] ?? "Defect";
  return {
    framing:
      "Your own 2×2, played over an indefinite horizon. The folk-theorem region below is computed from the payoffs you entered; the discount threshold is exact.",
    cooperate,
    cooperateLabel,
    defectLabel,
    caveat:
      "Which outcome counts as “cooperative” is your designation, not a property of the payoffs. The region and the threshold are exact given that choice — change it and both change.",
  };
}

export const repeatableGameContent: Readonly<Record<RepeatableSlug, RepeatableGameContent>> = {
  pd: {
    slug: "pd",
    framing:
      "Repeated, the price war becomes a question of the future: holding price is only rational if tomorrow is likely enough to punish an undercut today.",
    cooperate: { row: 0, column: 0 },
    cooperateLabel: "Hold price",
    defectLabel: "Undercut",
  },
  stag: {
    slug: "stag",
    framing:
      "Betting together on the new standard is already an equilibrium; repetition lets trust survive the occasional stumble.",
    cooperate: { row: 0, column: 0 },
    cooperateLabel: "Stag",
    defectLabel: "Hare",
  },
  chicken: {
    slug: "chicken",
    framing:
      "Mutual restraint in the capacity war is not a one-shot equilibrium, but the shadow of future rounds can hold both firms back from the crash.",
    cooperate: { row: 0, column: 0 },
    cooperateLabel: "Swerve",
    defectLabel: "Straight",
  },
  bos: {
    slug: "bos",
    framing:
      "Landing on one platform repeatedly is a coordination problem, not a cooperation problem — but the folk-theorem region still shows what payoffs repetition can support.",
    cooperate: { row: 0, column: 0 },
    cooperateLabel: "Yours",
    defectLabel: "Theirs",
    caveat:
      "Battle of the Sexes has two pure equilibria and conflicting interests. The designated coordinate is a stage equilibrium already, so repetition adds no discount threshold — the lesson here is the feasible region, not sustaining cooperation.",
  },
  pennies: {
    slug: "pennies",
    framing:
      "Auditing and evading is strictly competitive. Repetition cannot manufacture cooperation from a zero-sum stage game — and the analysis says so plainly.",
    cooperate: { row: 0, column: 0 },
    cooperateLabel: "Heads",
    defectLabel: "Tails",
    caveat:
      "This stage game is zero-sum. There is no mutually beneficial outcome to sustain, so no discount factor makes 'cooperation' individually rational.",
  },
};
