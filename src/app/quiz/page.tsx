import type { Metadata } from "next";

import { QuizExperience } from "@/components/quiz/quiz-experience";

export const metadata: Metadata = {
  title: "Guess the equilibrium",
  description:
    "A seeded game-theory quiz over equilibrium, dominance, mixed play, and backward induction.",
};

export default function QuizPage() {
  return <QuizExperience />;
}
