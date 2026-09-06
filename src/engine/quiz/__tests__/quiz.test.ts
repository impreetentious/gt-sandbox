import { describe, expect, it } from "vitest";

import { catalog } from "@/engine/catalog";
import type { NormalFormGame } from "@/engine/game";
import {
  generateQuizQuestion,
  generateQuizRound,
  QUIZ_LENGTH,
  scoreQuizRound,
} from "@/engine/quiz";
import { pureNashEquilibria } from "@/engine/solve/pure";

/** The catalog game a question was generated from, recovered from its prompt. */
function sourceGame(prompt: string): NormalFormGame | undefined {
  return catalog.find((entry) => prompt.includes(entry.game.title))?.game;
}

describe("seeded quiz generator", () => {
  it("is deterministic and cycles through all five question kinds", () => {
    const first = Array.from({ length: 5 }, (_, index) => generateQuizQuestion(42, index));
    const second = Array.from({ length: 5 }, (_, index) => generateQuizQuestion(42, index));
    expect(second).toEqual(first);
    expect(new Set(first.map((question) => question.kind))).toEqual(
      new Set([
        "nash-cell",
        "dominant-strategy",
        "mixed-probability",
        "classify",
        "backward-induction",
      ]),
    );
    expect(
      first.every((question) =>
        question.choices.some((choice) => choice.id === question.correctChoiceId),
      ),
    ).toBe(true);
  });

  it("builds and scores a deterministic five-question round", () => {
    const first = generateQuizRound(73);
    const second = generateQuizRound(73);
    const perfectAnswers = first.map((question) => question.correctChoiceId);

    expect(first).toHaveLength(QUIZ_LENGTH);
    expect(second).toEqual(first);
    expect(scoreQuizRound(first, perfectAnswers)).toBe(QUIZ_LENGTH);
    expect(
      scoreQuizRound(
        first,
        perfectAnswers.map(() => null),
      ),
    ).toBe(0);
  });

  it("never marks a cell correct in a game with no pure equilibrium", () => {
    const graded: string[] = [];

    for (let seed = 0; seed < 200; seed += 1) {
      for (const question of generateQuizRound(seed)) {
        if (question.kind !== "nash-cell") continue;

        const game = sourceGame(question.prompt);
        expect(game).toBeDefined();
        if (!game) continue;

        const equilibria = pureNashEquilibria(game);
        const cell = /^(\d+)-(\d+)$/.exec(question.correctChoiceId);

        if (cell) {
          expect(equilibria).toContainEqual({ row: Number(cell[1]), column: Number(cell[2]) });
        } else {
          // The only non-cell answer is the explicit "no pure equilibrium" one.
          expect(equilibria).toHaveLength(0);
        }

        graded.push(`${game.title}:${cell ? "cell" : "none"}`);
      }
    }

    // The sweep must actually reach a game of each shape, or it proves nothing.
    expect(graded.some((entry) => entry.endsWith(":none"))).toBe(true);
    expect(graded.some((entry) => entry.endsWith(":cell"))).toBe(true);
  });

  it("never offers a second true equilibrium alongside the graded one", () => {
    let multiEquilibriumQuestions = 0;

    for (let seed = 0; seed < 200; seed += 1) {
      for (const question of generateQuizRound(seed)) {
        if (question.kind !== "nash-cell") continue;

        const game = sourceGame(question.prompt);
        expect(game).toBeDefined();
        if (!game) continue;

        const equilibria = pureNashEquilibria(game);
        if (equilibria.length > 1) multiEquilibriumQuestions += 1;

        const offeredEquilibria = question.choices.filter((choice) =>
          equilibria.some((profile) => `${profile.row}-${profile.column}` === choice.id),
        );

        // Grading compares one id, so at most one choice may be a real
        // equilibrium or a correct answer would be marked wrong.
        expect(offeredEquilibria.map((choice) => choice.id)).toEqual(
          equilibria.length === 0 ? [] : [question.correctChoiceId],
        );
      }
    }

    // Stag Hunt, Battle of the Sexes and Chicken each have two; if the sweep
    // never reaches one the assertion above proves nothing.
    expect(multiEquilibriumQuestions).toBeGreaterThan(0);
  });

  it("offers the no-equilibrium answer as a choice in every cell question", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (const question of generateQuizRound(seed)) {
        if (question.kind !== "nash-cell") continue;

        const ids = question.choices.map((choice) => choice.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.filter((id) => !/^\d+-\d+$/.test(id))).toHaveLength(1);
        expect(ids).toContain(question.correctChoiceId);
      }
    }
  });
});
