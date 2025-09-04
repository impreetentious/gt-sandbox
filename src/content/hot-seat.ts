export type HotSeatSlug = "pd" | "stag" | "bos" | "chicken" | "pennies";

export interface HotSeatGameContent {
  readonly slug: HotSeatSlug;
  readonly eyebrow: string;
  /** A two-human framing: the lesson is bluffing or coordinating with a person. */
  readonly framing: string;
  readonly roundLimit: number;
  /** Verbs shown on the two choice buttons, in action-index order. */
  readonly rowActions: readonly [string, string];
  readonly columnActions: readonly [string, string];
}

/**
 * The five simultaneous-move catalog games are the pass-and-play roster. The
 * iterated PD is excluded: it is a match against a strategy, not a
 * commit-and-conceal human exchange.
 */
export const hotSeatGameContent: Readonly<
  Record<HotSeatSlug, HotSeatGameContent>
> = {
  pd: {
    slug: "pd",
    eyebrow: "Hot-seat / Price war",
    framing:
      "Two people run rival firms on one device. Each secretly holds price or undercuts; the temptation to defect is real when the other person cannot see your hand.",
    roundLimit: 10,
    rowActions: ["Hold price", "Undercut"],
    columnActions: ["Hold price", "Undercut"],
  },
  stag: {
    slug: "stag",
    eyebrow: "Hot-seat / Standards adoption",
    framing:
      "Two people decide whether to bet on a new standard together. Trust only pays if the other person commits too — and you cannot ask them first.",
    roundLimit: 10,
    rowActions: ["Stag", "Hare"],
    columnActions: ["Stag", "Hare"],
  },
  bos: {
    slug: "bos",
    eyebrow: "Hot-seat / Systems integration",
    framing:
      "Two people must land on one shared platform, but each prefers their own. Coordinating beats a standoff — someone has to yield, and neither can negotiate aloud.",
    roundLimit: 10,
    rowActions: ["Yours", "Theirs"],
    columnActions: ["Yours", "Theirs"],
  },
  chicken: {
    slug: "chicken",
    eyebrow: "Hot-seat / Capacity war",
    framing:
      "Two people flood a market that supports one. Holding straight against a real person is brinkmanship; the crash is expensive when neither of you blinks.",
    roundLimit: 10,
    rowActions: ["Swerve", "Straight"],
    columnActions: ["Swerve", "Straight"],
  },
  pennies: {
    slug: "pennies",
    eyebrow: "Hot-seat / Audit and evasion",
    framing:
      "One person audits while the other evades. Matching wins; against a real opponent, any pattern you leak can be read and punished.",
    roundLimit: 20,
    rowActions: ["Heads", "Tails"],
    columnActions: ["Heads", "Tails"],
  },
};
