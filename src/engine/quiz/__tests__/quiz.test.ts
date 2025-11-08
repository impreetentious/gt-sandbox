import { describe, expect, it } from "vitest";

import {
  generateQuizQuestion,
  generateQuizRound,
  QUIZ_LENGTH,
  scoreQuizRound,
} from "@/engine/quiz";

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
});
