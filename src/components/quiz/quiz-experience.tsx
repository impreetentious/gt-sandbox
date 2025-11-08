"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { generateQuizRound, QUIZ_LENGTH, scoreQuizRound } from "@/engine/quiz";
import type { NormalFormGame } from "@/engine/game";
import { decodeGameSearch } from "@/state/game-url";

function seedFromSearch(search: string): number {
  const raw = new URLSearchParams(search).get("seed");
  const value = raw ? Number(raw) : 42;
  return Number.isSafeInteger(value) && value >= 0 ? value >>> 0 : 42;
}

function customGameFromSearch(search: string): NormalFormGame | undefined {
  const decoded = decodeGameSearch(search);
  return decoded.kind === "valid" &&
    decoded.state.game.rowActions.length === 2 &&
    decoded.state.game.columnActions.length === 2
    ? decoded.state.game
    : undefined;
}

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function locationSnapshot() {
  return window.location.search;
}

export function QuizExperience() {
  const search = useSyncExternalStore(subscribeToLocation, locationSnapshot, () => "");
  const [seedOverride, setSeedOverride] = useState<number>();
  const seed = seedOverride ?? seedFromSearch(search);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<readonly (string | null)[]>(
    Array.from({ length: QUIZ_LENGTH }, () => null),
  );
  const game = useMemo(() => customGameFromSearch(search), [search]);
  const questions = useMemo(() => generateQuizRound(seed, game), [game, seed]);
  const question = questions[index];
  const answer = answers[index] ?? null;
  const correct = answer === question.correctChoiceId;
  const score = scoreQuizRound(questions, answers);
  const complete = index === QUIZ_LENGTH - 1 && answer !== null;

  const resetRound = (nextSeed = seed) => {
    setSeedOverride(nextSeed);
    setIndex(0);
    setAnswers(Array.from({ length: QUIZ_LENGTH }, () => null));
  };

  const next = () => {
    setIndex((current) => current + 1);
  };

  return (
    <section className="quiz-experience" aria-labelledby="quiz-title">
      <header>
        <p className="eyebrow">Learn / Guess the equilibrium</p>
        <h1 className="display" id="quiz-title">
          Make the call before the solver does.
        </h1>
        <p className="lede">
          Five deterministic question types rotate from one seed. A shared Build link becomes this
          quiz’s normal-form source.
        </p>
      </header>
      <div className="quiz-experience__controls">
        <label>
          Seed
          <input
            aria-label="Quiz seed"
            min="0"
            onChange={(event) => {
              const value = Number(event.target.value);
              const nextSeed = Number.isSafeInteger(value) && value >= 0 ? value >>> 0 : 42;
              resetRound(nextSeed);
              const params = new URLSearchParams(window.location.search);
              params.set("seed", String(nextSeed));
              window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
            }}
            type="number"
            value={seed}
          />
        </label>
        <p>
          {game
            ? "Using Your Build game when the question supports it."
            : "Using the catalog. Build a 2×2 game and open its quiz link to test it."}
        </p>
      </div>
      <p className="quiz-experience__score">
        Question {index + 1} of {QUIZ_LENGTH} · Score {score}
      </p>
      <article className="quiz-experience__card">
        <p className="eyebrow">
          {question.kind.replaceAll("-", " ")} · {question.source}
        </p>
        <h2>{question.prompt}</h2>
        <div aria-label="Answer choices" className="quiz-experience__choices">
          {question.choices.map((choice) => (
            <button
              aria-pressed={answer === choice.id}
              className={
                answer
                  ? choice.id === question.correctChoiceId
                    ? "is-correct"
                    : choice.id === answer
                      ? "is-incorrect"
                      : ""
                  : ""
              }
              disabled={answer !== null}
              key={choice.id}
              onClick={() =>
                setAnswers((current) =>
                  current.map((entry, answerIndex) => (answerIndex === index ? choice.id : entry)),
                )
              }
              type="button"
            >
              {choice.label}
            </button>
          ))}
        </div>
        {answer ? (
          <p className="quiz-experience__result" role="status">
            {correct ? "Correct. " : "Not quite. "}
            {question.explanation}
            {complete ? ` Round complete: ${score} of ${QUIZ_LENGTH}.` : ""}
          </p>
        ) : null}
        {complete ? (
          <button className="analysis-button" onClick={() => resetRound()} type="button">
            Play this seed again
          </button>
        ) : (
          <button
            className="analysis-button"
            disabled={answer === null}
            onClick={next}
            type="button"
          >
            Next question
          </button>
        )}
      </article>
    </section>
  );
}
