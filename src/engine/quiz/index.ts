import { catalog } from "@/engine/catalog";
import { extensiveCatalog } from "@/engine/catalog/extensive";
import type { NormalFormGame } from "@/engine/game";
import { createRng } from "@/engine/rng";
import { formatRational } from "@/engine/rational";
import { classifyTwoByTwo } from "@/engine/solve/classify";
import { dominanceRelations } from "@/engine/solve/dominance";
import { analyzeMixedEquilibria } from "@/engine/solve/mixed";
import { pureNashEquilibria } from "@/engine/solve/pure";

type QuizQuestionKind =
  "nash-cell" | "dominant-strategy" | "mixed-probability" | "classify" | "backward-induction";

interface QuizChoice {
  readonly id: string;
  readonly label: string;
}

interface QuizQuestion {
  readonly id: string;
  readonly kind: QuizQuestionKind;
  readonly source: string;
  readonly prompt: string;
  readonly choices: readonly QuizChoice[];
  readonly correctChoiceId: string;
  readonly explanation: string;
}

const kinds: readonly QuizQuestionKind[] = [
  "nash-cell",
  "dominant-strategy",
  "mixed-probability",
  "classify",
  "backward-induction",
];

export const QUIZ_LENGTH = kinds.length;

function normalGameFor(
  seed: number,
  customGame?: NormalFormGame,
): { game: NormalFormGame; source: string } {
  if (customGame) return { game: customGame, source: "Your Build game" };
  const game = catalog[seed % catalog.length];
  return { game: game.game, source: game.game.title };
}

function profileLabel(game: NormalFormGame, row: number, column: number): string {
  return `${game.rowActions[row]} / ${game.columnActions[column]}`;
}

function rotate<T>(values: readonly T[], seed: number): T[] {
  if (values.length === 0) return [];
  const offset = seed % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

/**
 * Games such as Matching Pennies have no pure equilibrium at all, so the answer
 * set always carries this option. Naming some cell anyway would teach a false
 * equilibrium in the one place the reader is being graded on the definition.
 */
const NO_PURE_EQUILIBRIUM = "None — no pure-strategy equilibrium";

function nashQuestion(seed: number, customGame?: NormalFormGame): QuizQuestion {
  const { game, source } = normalGameFor(seed, customGame);
  const equilibria = pureNashEquilibria(game);
  const equilibrium = equilibria[0];
  /**
   * Coordination games, Chicken and Battle of the Sexes each have two pure
   * equilibria, but a question is graded against a single id. Offering the
   * others as choices would mark a correct answer wrong, so every equilibrium
   * except the graded one is left out of the answer set and the explanation
   * says the game has more than one rather than implying the shown cell is
   * unique.
   */
  const ungraded = new Set(
    equilibria.slice(1).map((profile) => `${profile.row}-${profile.column}`),
  );
  const choices = rotate(
    [
      ...game.payoffs
        .flatMap((row, rowIndex) =>
          row.map((_, columnIndex) => ({
            id: `${rowIndex}-${columnIndex}`,
            label: profileLabel(game, rowIndex, columnIndex),
          })),
        )
        .filter((choice) => !ungraded.has(choice.id)),
      { id: NO_PURE_EQUILIBRIUM, label: NO_PURE_EQUILIBRIUM },
    ],
    seed,
  );
  return {
    id: `nash-${seed}`,
    kind: "nash-cell",
    source,
    prompt: `Which action pair is a Nash equilibrium in ${game.title}?`,
    choices,
    correctChoiceId: equilibrium ? `${equilibrium.row}-${equilibrium.column}` : NO_PURE_EQUILIBRIUM,
    explanation: equilibrium
      ? `At ${profileLabel(game, equilibrium.row, equilibrium.column)}, neither player can improve by changing action alone.${
          equilibria.length > 1
            ? ` ${game.title} has ${equilibria.length} pure equilibria in all; the others are not offered here.`
            : ""
        }`
      : `${game.title} has no pure-strategy equilibrium: in every cell one player would rather switch. Its only equilibrium mixes both actions.`,
  };
}

function dominantQuestion(seed: number, customGame?: NormalFormGame): QuizQuestion {
  const { game, source } = normalGameFor(seed + 1, customGame);
  const relation = dominanceRelations(game, "strict").find(
    (candidate) => candidate.player === "row",
  );
  const correct = relation
    ? game.rowActions[relation.dominator]
    : "No strictly dominant row action";
  const choices = rotate(
    [...game.rowActions, "No strictly dominant row action"].map((label, index) => ({
      id: String(index),
      label,
    })),
    seed,
  );
  return {
    id: `dominant-${seed}`,
    kind: "dominant-strategy",
    source,
    prompt: `Which row-player action is strictly dominant in ${game.title}?`,
    choices,
    correctChoiceId: String(
      [...game.rowActions, "No strictly dominant row action"].indexOf(correct),
    ),
    explanation: relation
      ? `${correct} pays more than ${game.rowActions[relation.dominated]} against every column action.`
      : "Neither row action is strictly better against every possible column action.",
  };
}

function mixedQuestion(seed: number, customGame?: NormalFormGame): QuizQuestion {
  const candidates = customGame
    ? [customGame, ...catalog.map((entry) => entry.game)]
    : catalog.map((entry) => entry.game);
  const game =
    candidates.find((candidate) =>
      analyzeMixedEquilibria(candidate).equilibria.some(
        (equilibrium) => equilibrium.row.support.length === 2,
      ),
    ) ?? catalog[0].game;
  const equilibrium =
    analyzeMixedEquilibria(game).equilibria.find(
      (candidate) => candidate.row.support.length === 2,
    ) ?? analyzeMixedEquilibria(game).equilibria[0];
  const probability = equilibrium?.row.probabilities[0];
  const answer = probability ? formatRational(probability) : "0";
  const distractors = ["0", "1/3", "1/2", "2/3", "1"]
    .filter((value) => value !== answer)
    .slice(0, 3);
  const choices = rotate(
    [answer, ...distractors].map((label) => ({ id: label, label })),
    seed,
  );
  return {
    id: `mixed-${seed}`,
    kind: "mixed-probability",
    source: customGame === game ? "Your Build game" : game.title,
    prompt: `In a mixed equilibrium, what probability does the row player put on ${game.rowActions[0]}?`,
    choices,
    correctChoiceId: answer,
    explanation: `The exact solver makes the column player indifferent, yielding probability ${answer} on ${game.rowActions[0]}.`,
  };
}

function classifyQuestion(seed: number, customGame?: NormalFormGame): QuizQuestion {
  const { game, source } = normalGameFor(seed + 2, customGame);
  const answer = classifyTwoByTwo(game);
  const labels = [
    "dominance",
    "dilemma",
    "coordination (assurance)",
    "battle",
    "anti-coordination",
    "cycle",
  ];
  const choices = rotate(
    [answer, ...labels.filter((label) => label !== answer).slice(0, 3)].map((label) => ({
      id: label,
      label,
    })),
    seed,
  );
  return {
    id: `classify-${seed}`,
    kind: "classify",
    source,
    prompt: `How does the exact 2×2 classifier describe ${game.title}?`,
    choices,
    correctChoiceId: answer,
    explanation: `The best-response pattern is ${answer}; the label is derived from the payoff matrix, not its title.`,
  };
}

function backwardInductionQuestion(seed: number): QuizQuestion {
  const game = extensiveCatalog[seed % extensiveCatalog.length];
  const answer = game.oracle.spne.label;
  const choices = rotate(
    [
      answer,
      ...extensiveCatalog
        .map((candidate) => candidate.oracle.spne.label)
        .filter((label) => label !== answer),
    ].map((label) => ({ id: label, label })),
    seed,
  );
  return {
    id: `backward-${seed}`,
    kind: "backward-induction",
    source: game.game.title,
    prompt: `What outcome does backward induction select in ${game.game.title}?`,
    choices,
    correctChoiceId: answer,
    explanation: `Work backward at every decision node: ${answer} is the subgame-perfect outcome.`,
  };
}

/** A seeded, pure question factory. The same seed and index always yield the same quiz. */
export function generateQuizQuestion(
  seed: number,
  index: number,
  customGame?: NormalFormGame,
): QuizQuestion {
  const rng = createRng((seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const questionSeed = rng.integer(0, 0xffff_ffff);
  switch (kinds[index % kinds.length]) {
    case "nash-cell":
      return nashQuestion(questionSeed, customGame);
    case "dominant-strategy":
      return dominantQuestion(questionSeed, customGame);
    case "mixed-probability":
      return mixedQuestion(questionSeed, customGame);
    case "classify":
      return classifyQuestion(questionSeed, customGame);
    case "backward-induction":
      return backwardInductionQuestion(questionSeed);
  }
}

/** The complete deterministic five-question round for a URL seed. */
export function generateQuizRound(
  seed: number,
  customGame?: NormalFormGame,
): readonly QuizQuestion[] {
  return Array.from({ length: QUIZ_LENGTH }, (_, index) =>
    generateQuizQuestion(seed, index, customGame),
  );
}

/** Pure scoring keeps a shared round reproducible for tests and permalinks. */
export function scoreQuizRound(
  questions: readonly QuizQuestion[],
  answers: readonly (string | null)[],
): number {
  return questions.reduce(
    (score, question, index) => score + (answers[index] === question.correctChoiceId ? 1 : 0),
    0,
  );
}
