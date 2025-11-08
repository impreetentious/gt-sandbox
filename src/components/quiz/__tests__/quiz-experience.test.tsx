import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { QuizExperience } from "@/components/quiz/quiz-experience";
import { generateQuizRound, QUIZ_LENGTH } from "@/engine/quiz";

describe("seeded quiz experience", () => {
  afterEach(cleanup);

  it("finishes the deterministic round and reports its score", () => {
    window.history.replaceState(null, "", "/quiz/?seed=42");
    const questions = generateQuizRound(42);
    render(<QuizExperience />);

    for (const [index, question] of questions.entries()) {
      const correct = question.choices.find((choice) => choice.id === question.correctChoiceId);
      expect(correct).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: correct?.label }));
      if (index < QUIZ_LENGTH - 1)
        fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    }

    expect(screen.getByRole("status")).toHaveTextContent(
      `Round complete: ${QUIZ_LENGTH} of ${QUIZ_LENGTH}.`,
    );
    expect(screen.getByRole("button", { name: "Play this seed again" })).toBeVisible();
  });
});
