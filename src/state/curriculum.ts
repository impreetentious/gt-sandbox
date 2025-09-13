/**
 * V2-P10 — the guided path through the sandbox, and the only progression state
 * the product keeps.
 *
 * The home arc has always been ungated on purpose (§5.1: respect adult users),
 * and that does not change. This adds a *second* door for readers who want an
 * order imposed rather than offered, and it is gated only until they say
 * otherwise. Every lock in here can be removed by one control, and removing
 * them is not a penalty: the surfaces themselves are identical either way.
 *
 * The module is pure — no React, no DOM, no storage. It parses, serializes, and
 * answers questions about progress; the component owns the single localStorage
 * key. That split is what lets the gating rules be tested without a browser,
 * and it is why a corrupted key cannot do anything worse than reset progress.
 */

/** The one and only storage key this feature uses. */
export const CURRICULUM_KEY = "curriculum";

export interface CurriculumStep {
  readonly id: string;
  readonly title: string;
  /** The single idea this stop exists to deliver. */
  readonly concept: string;
  readonly href: string;
  /** What this stop adds that the previous one could not show. */
  readonly why: string;
}

/**
 * Ten stops, ordered so each one needs the previous one's idea.
 *
 * The ordering is the actual content here. Dominance has to land before
 * equilibrium selection is a question worth asking; selection has to land
 * before mixing looks like anything other than indecision; one-shot play has to
 * land before the shadow of the future means anything.
 */
export const curriculum: readonly CurriculumStep[] = [
  {
    id: "pd",
    title: "Prisoner's Dilemma",
    concept: "Dominance",
    href: "/play/pd/",
    why: "One action beats the other whatever the rival does — and following that logic makes both players worse off.",
  },
  {
    id: "stag-hunt",
    title: "Stag Hunt",
    concept: "Equilibrium selection",
    href: "/play/stag-hunt/",
    why: "Two equilibria, both stable. Nothing in the payoffs decides which one you land on; trust and risk do.",
  },
  {
    id: "battle-of-the-sexes",
    title: "Battle of the Sexes",
    concept: "Coordination under conflict",
    href: "/play/battle-of-the-sexes/",
    why: "Now the two equilibria are not equally attractive to both of you. Agreement is still better than disagreement.",
  },
  {
    id: "chicken",
    title: "Chicken",
    concept: "Anti-coordination",
    href: "/play/chicken/",
    why: "The first game where matching your rival is the bad outcome, and where a credible commitment is worth more than a good hand.",
  },
  {
    id: "matching-pennies",
    title: "Matching Pennies",
    concept: "Mixed strategies",
    href: "/play/matching-pennies/",
    why: "No pure equilibrium exists at all. Being unpredictable stops being a trick and becomes the rational play.",
  },
  {
    id: "iterated-pd",
    title: "Iterated Prisoner's Dilemma",
    concept: "The shadow of the future",
    href: "/play/iterated-pd/",
    why: "The same dilemma as the first stop, repeated — which is enough to make cooperation rational rather than naive.",
  },
  {
    id: "entry-deterrence",
    title: "Entry Deterrence",
    concept: "Credible threats",
    href: "/extensive/entry-deterrence/",
    why: "Moves in sequence rather than at once, so a threat can be an equilibrium and still not be believable.",
  },
  {
    id: "public-goods",
    title: "Public Goods",
    concept: "Free-riding at scale",
    href: "/nplayer/public-goods/",
    why: "The dilemma with more than two players, where your contribution is diluted and everyone's restraint is someone else's opportunity.",
  },
  {
    id: "evolve",
    title: "Evolution",
    concept: "Populations, not individuals",
    href: "/evolve/",
    why: "Strategies stop being chosen and start being selected. What survives is not always what a reasoning player would pick.",
  },
  {
    id: "build",
    title: "Build your own",
    concept: "The engine, unaccompanied",
    href: "/build/",
    why: "Every claim you have read so far was computed, not authored. Enter your own payoffs and watch the same machinery answer.",
  },
];

const stepIds = new Set(curriculum.map((step) => step.id));

export interface CurriculumProgress {
  /**
   * Whether later stops are locked until earlier ones are done. Readers who
   * turn this off keep their progress; the list simply stops withholding
   * anything.
   */
  readonly gated: boolean;
  readonly completed: readonly string[];
}

export const initialProgress: CurriculumProgress = {
  gated: true,
  completed: [],
};

/**
 * Reads stored progress, treating anything unrecognizable as a fresh start.
 *
 * The defensive filtering matters more than it looks: an unknown id in
 * `completed` would silently count towards unlocking, so a stale key from an
 * earlier curriculum could open stops the reader never reached. Ids are
 * intersected with the current curriculum rather than trusted.
 */
export function parseProgress(raw: string | null): CurriculumProgress {
  if (raw === null) {
    return initialProgress;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return initialProgress;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return initialProgress;
  }

  const record = parsed as Record<string, unknown>;
  const completed = Array.isArray(record.completed)
    ? record.completed.filter(
        (value): value is string =>
          typeof value === "string" && stepIds.has(value),
      )
    : [];

  return {
    gated: record.gated !== false,
    completed: curriculum
      .map((step) => step.id)
      .filter((id) => completed.includes(id)),
  };
}

export function serializeProgress(progress: CurriculumProgress): string {
  return JSON.stringify({
    gated: progress.gated,
    completed: progress.completed,
  });
}

export function isComplete(progress: CurriculumProgress, id: string): boolean {
  return progress.completed.includes(id);
}

/**
 * A stop is open when gating is off, when it is the first stop, or when every
 * earlier stop is done. Completing a stop out of order — which is possible by
 * arriving from the home arc — never re-locks anything.
 */
export function isUnlocked(progress: CurriculumProgress, id: string): boolean {
  if (!progress.gated) {
    return true;
  }

  const index = curriculum.findIndex((step) => step.id === id);

  if (index <= 0) {
    return index === 0;
  }

  return curriculum
    .slice(0, index)
    .every((step) => isComplete(progress, step.id));
}

/** The first stop that is open and not yet done, or null once all are done. */
export function nextStep(
  progress: CurriculumProgress,
): CurriculumStep | undefined {
  return curriculum.find(
    (step) => !isComplete(progress, step.id) && isUnlocked(progress, step.id),
  );
}

export function withCompleted(
  progress: CurriculumProgress,
  id: string,
  complete: boolean,
): CurriculumProgress {
  if (!stepIds.has(id)) {
    return progress;
  }

  const completed = curriculum
    .map((step) => step.id)
    .filter((stepId) =>
      stepId === id ? complete : isComplete(progress, stepId),
    );

  return { ...progress, completed };
}

export function withGating(
  progress: CurriculumProgress,
  gated: boolean,
): CurriculumProgress {
  return { ...progress, gated };
}
