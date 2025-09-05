import type { GameSlug } from "@/engine/catalog/types";

export type RepeatableSlug = Exclude<GameSlug, "ipd">;

export interface RepeatableGameContent {
  readonly slug: RepeatableSlug;
  readonly framing: string;
  /** The action index each player treats as "cooperate" in repeated play. */
  readonly cooperate: { readonly row: 0 | 1; readonly column: 0 | 1 };
  readonly cooperateLabel: string;
  readonly defectLabel: string;
  /** An honesty note when "cooperation" is not the game's natural lesson. */
  readonly caveat?: string;
}

export const repeatableGameContent: Readonly<
  Record<RepeatableSlug, RepeatableGameContent>
> = {
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
