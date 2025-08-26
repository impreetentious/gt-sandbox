import type { GameSlug } from "@/engine/catalog/types";
import type { OneShotOpponentPolicy } from "@/engine/repeated/policies";
import type { OneShotRound } from "@/state/one-shot-session";

export type OneShotPlayableSlug = Exclude<GameSlug, "pd" | "ipd">;

export interface OneShotPersonaContent {
  readonly id: OneShotOpponentPolicy;
  readonly name: string;
  readonly description: string;
}

export interface InsightMoment {
  readonly id: string;
  readonly message: string;
  readonly when: (rounds: readonly OneShotRound[]) => boolean;
}

export interface OneShotGameContent {
  readonly slug: OneShotPlayableSlug;
  readonly eyebrow: string;
  /** A compact scenario, authored from the normative catalog framing in §4. */
  readonly framing: string;
  readonly roundLimit: number;
  readonly personas: readonly OneShotPersonaContent[];
  /** P5 deliberately keeps every game to at most two quiet moments. */
  readonly insights: readonly InsightMoment[];
}

function atLeast(rounds: readonly OneShotRound[], count: number): boolean {
  return rounds.length >= count;
}

function sharkAccuracy(rounds: readonly OneShotRound[]): number {
  const predicted = rounds.filter(
    (round) => round.predictedPlayerAction !== undefined,
  );

  if (predicted.length === 0) {
    return 0;
  }

  return (
    predicted.filter(
      (round) => round.predictedPlayerAction === round.playerAction,
    ).length / predicted.length
  );
}

export const oneShotGameContent: Readonly<
  Record<OneShotPlayableSlug, OneShotGameContent>
> = {
  stag: {
    slug: "stag",
    eyebrow: "Play / Standards adoption",
    framing:
      "Two firms choose a standard together. The new option creates more value when both commit, but the dependable legacy choice protects either firm from a failed bet.",
    roundLimit: 10,
    personas: [
      {
        id: "fsm:trusting",
        name: "Trusting",
        description:
          "Starts with the new standard, then mirrors your last choice.",
      },
      {
        id: "fsm:cautious",
        name: "Cautious",
        description:
          "Starts with legacy and mirrors only after seeing two consecutive commitments.",
      },
      {
        id: "fictitious",
        name: "Learner",
        description:
          "Best-responds to an add-one-smoothed record of your past choices.",
      },
    ],
    insights: [
      {
        id: "trust-signal",
        message:
          "A repeated commitment is evidence, not a promise. The Cautious rival only mirrors after it has seen two commitments in a row.",
        when: (rounds) =>
          atLeast(rounds, 3) &&
          rounds.slice(0, 2).every((round) => round.playerAction === 0),
      },
    ],
  },
  bos: {
    slug: "bos",
    eyebrow: "Play / Systems integration",
    framing:
      "Two merged companies must settle on one shared platform. Either agreement works, but each side prefers its own system, making commitment valuable before coordination begins.",
    roundLimit: 10,
    personas: [
      {
        id: "always:1",
        name: "Stubborn",
        description: "Always selects their own platform and never yields.",
      },
      {
        id: "fictitious",
        name: "Learner",
        description:
          "Best-responds to an add-one-smoothed record of your past choices.",
      },
      {
        id: "random:1/3",
        name: "Judge",
        description:
          "Randomizes: your platform one-third of the time, theirs two-thirds.",
      },
    ],
    insights: [
      {
        id: "commitment",
        message:
          "Your preference is becoming legible. Against a Learner, consistent commitment can train the coordination point in your favor.",
        when: (rounds) =>
          atLeast(rounds, 3) &&
          rounds.slice(0, 3).every((round) => round.playerAction === 0),
      },
    ],
  },
  chicken: {
    slug: "chicken",
    eyebrow: "Play / Capacity war",
    framing:
      "Two firms choose whether to flood a market that can support one aggressive expansion. Someone must yield; mutual escalation destroys far more value than either retreat.",
    roundLimit: 10,
    personas: [
      {
        id: "always:1",
        name: "Daredevil",
        description: "Always expands straight into the capacity war.",
      },
      {
        id: "random:9/10",
        name: "Judge",
        description:
          "Swerve with probability 9/10: the exact mixed-equilibrium policy.",
      },
      {
        id: "fictitious",
        name: "Learner",
        description:
          "Best-responds to an add-one-smoothed record of your past choices.",
      },
    ],
    insights: [
      {
        id: "crash",
        message:
          "Both firms went straight. The crash is not a useful threat once it happens; it is the price of brinkmanship.",
        when: (rounds) =>
          rounds.some(
            (round) => round.playerAction === 1 && round.opponentAction === 1,
          ),
      },
    ],
  },
  pennies: {
    slug: "pennies",
    eyebrow: "Play / Audit and evasion",
    framing:
      "An auditor checks one channel while an operator chooses where to hide. Matching wins the audit; predictable play turns a balanced contest into an exploitable pattern.",
    roundLimit: 20,
    personas: [
      {
        id: "random:1/2",
        name: "Coin",
        description:
          "Randomizes equally between heads and tails: the equilibrium policy.",
      },
      {
        id: "markov2",
        name: "Shark",
        description:
          "Predicts from the last two moves, then best-responds to that prediction.",
      },
    ],
    insights: [
      {
        id: "pattern-leak",
        message:
          "You are leaking a pattern. The Shark predicted more than 60% of your moves; the analysis shows why an even mix cannot be exploited this way.",
        when: (rounds) => rounds.length >= 8 && sharkAccuracy(rounds) > 0.6,
      },
    ],
  },
};

export function sharkPredictionAccuracy(
  rounds: readonly OneShotRound[],
): number {
  return sharkAccuracy(rounds);
}
