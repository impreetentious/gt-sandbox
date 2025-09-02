"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AnalysisDrawer } from "@/components/analysis/analysis-drawer";
import { GameWorkbench } from "@/components/build/game-workbench";
import {
  oneShotGameContent,
  sharkPredictionAccuracy,
  type OneShotPlayableSlug,
} from "@/content/one-shot-games";
import { catalogBySlug } from "@/engine/catalog";
import { payoffAt, profileKey } from "@/engine/game";
import { formatRational } from "@/engine/rational";
import { paretoEfficientProfiles } from "@/engine/solve/pareto";
import { bestResponses, pureNashEquilibria } from "@/engine/solve/pure";
import {
  createOneShotSession,
  reduceOneShotSession,
  type OneShotSessionState,
} from "@/state/one-shot-session";

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function personaName(slug: OneShotPlayableSlug, personaId: string): string {
  return (
    oneShotGameContent[slug].personas.find(
      (persona) => persona.id === personaId,
    )?.name ?? "Rival"
  );
}

function latestInsight(slug: OneShotPlayableSlug, state: OneShotSessionState) {
  return oneShotGameContent[slug].insights.find((insight) =>
    insight.when(state.rounds),
  );
}

/** The common P5 arena for the four remaining repeated one-shot sessions. */
export function OneShotPlayExperience({
  slug,
}: {
  readonly slug: OneShotPlayableSlug;
}) {
  const content = oneShotGameContent[slug];
  const catalogGame = catalogBySlug[slug];
  const { game } = catalogGame;
  const [state, dispatch] = useReducer(reduceOneShotSession, undefined, () =>
    createOneShotSession(slug),
  );
  const [paretoMode, setParetoMode] = useState(false);
  const reducedMotion = useReducedMotion();
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const secondChoiceRef = useRef<HTMLButtonElement>(null);
  const playAgainRef = useRef<HTMLButtonElement>(null);
  const priorStateRef = useRef({ seed: state.seed, status: state.status });
  const latestRound = state.rounds.at(-1);
  const highlightedRound = state.pendingRound ?? latestRound;
  const insight = latestInsight(slug, state);
  const equilibria = new Set(pureNashEquilibria(game).map(profileKey));
  const paretoEfficient = new Set(
    paretoEfficientProfiles(game).map(profileKey),
  );

  useEffect(() => {
    if (state.status !== "resolving") {
      return;
    }

    const timer = window.setTimeout(
      () => dispatch({ type: "commit-outcome" }),
      reducedMotion ? 0 : 150,
    );

    return () => window.clearTimeout(timer);
  }, [reducedMotion, state.status]);

  useEffect(() => {
    const priorState = priorStateRef.current;

    if (state.status === "complete") {
      playAgainRef.current?.focus();
    } else if (priorState.status === "resolving") {
      (state.focusTarget === "choice-0"
        ? firstChoiceRef
        : secondChoiceRef
      ).current?.focus();
    } else if (state.rounds.length === 0 && state.seed !== priorState.seed) {
      firstChoiceRef.current?.focus();
    }

    priorStateRef.current = { seed: state.seed, status: state.status };
  }, [state.focusTarget, state.rounds.length, state.seed, state.status]);

  const handleShortcut = (event: KeyboardEvent<HTMLElement>) => {
    if (state.status !== "playing" || !["1", "2"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    dispatch({
      type: "submit-choice",
      action: event.key === "1" ? 0 : 1,
    });
  };

  const narration =
    state.status === "resolving"
      ? `${personaName(slug, state.persona)} is deciding.`
      : latestRound
        ? `Round ${latestRound.number}: you chose ${game.rowActions[latestRound.playerAction]}; ${personaName(slug, state.persona)} chose ${game.columnActions[latestRound.opponentAction]}. You earned ${formatRational(latestRound.playerPayoff)} and ${personaName(slug, state.persona)} earned ${formatRational(latestRound.opponentPayoff)}.`
        : `Round 1 of ${content.roundLimit}. Choose your move.`;
  const sharkAccuracy =
    state.persona === "markov2" ? sharkPredictionAccuracy(state.rounds) : 0;

  return (
    <>
      <section
        aria-labelledby={`${slug}-title`}
        className="one-shot-session"
        data-round={state.rounds.length}
        data-testid={`${slug}-session`}
        onKeyDown={handleShortcut}
      >
        <header className="one-shot-session__header">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 className="display" id={`${slug}-title`}>
            {game.title}
          </h1>
          <p className="lede">{content.framing}</p>
        </header>

        <div className="one-shot-scoreboard" aria-label="Session score">
          <p>
            <span>You</span>
            <strong>{formatRational(state.playerScore)}</strong>
          </p>
          <p>
            <span>{personaName(slug, state.persona)}</span>
            <strong>{formatRational(state.opponentScore)}</strong>
          </p>
          <p>
            <span>Round</span>
            <strong>
              {Math.min(state.rounds.length + 1, content.roundLimit)} /{" "}
              {content.roundLimit}
            </strong>
          </p>
        </div>

        <div className="one-shot-layout">
          <section
            aria-labelledby={`${slug}-arena-title`}
            className="one-shot-arena"
          >
            <div className="one-shot-arena__heading">
              <div>
                <p className="eyebrow">Act</p>
                <h2 id={`${slug}-arena-title`}>
                  {state.status === "complete"
                    ? "Session complete"
                    : "Choose your move."}
                </h2>
              </div>
              <label className="one-shot-persona">
                <span>Rival</span>
                <select
                  aria-label="Choose rival"
                  disabled={
                    state.rounds.length > 0 || state.status === "resolving"
                  }
                  onChange={(event) =>
                    dispatch({
                      type: "select-persona",
                      persona: event.target.value as typeof state.persona,
                    })
                  }
                  value={state.persona}
                >
                  {content.personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="one-shot-persona__description">
              {
                content.personas.find((persona) => persona.id === state.persona)
                  ?.description
              }
            </p>

            <div className="one-shot-choices" aria-label="Choose your move">
              {game.rowActions.map((action, index) => (
                <button
                  aria-keyshortcuts={String(index + 1)}
                  aria-label={`${action} (key ${index + 1})`}
                  className="one-shot-choice"
                  disabled={state.status !== "playing"}
                  key={action}
                  onClick={() =>
                    dispatch({ type: "submit-choice", action: index as 0 | 1 })
                  }
                  ref={index === 0 ? firstChoiceRef : secondChoiceRef}
                  type="button"
                >
                  <span>{action}</span>
                  <kbd aria-hidden="true">{index + 1}</kbd>
                </button>
              ))}
            </div>

            <p
              className="one-shot-observation"
              data-resolving={state.status === "resolving"}
            >
              {state.status === "resolving"
                ? `${personaName(slug, state.persona)} is deciding…`
                : state.status === "complete"
                  ? "The session is complete. Open the analysis, then try another rival."
                  : "Choose an action. The outcome commits before the next round begins."}
            </p>
            <p aria-live="polite" className="sr-only" role="status">
              {narration}
            </p>

            {insight ? (
              <p className="one-shot-insight" role="status">
                {insight.message}
              </p>
            ) : null}
            {state.persona === "markov2" && state.rounds.length >= 2 ? (
              <p
                className="one-shot-prediction"
                data-testid="shark-prediction-accuracy"
              >
                Shark prediction accuracy: {(sharkAccuracy * 100).toFixed(0)}%.
              </p>
            ) : null}

            <section
              aria-labelledby={`${slug}-history-title`}
              className="one-shot-history"
            >
              <div className="one-shot-history__heading">
                <p className="eyebrow">Observe</p>
                <h3 id={`${slug}-history-title`}>History</h3>
              </div>
              {state.rounds.length === 0 ? (
                <p className="one-shot-history__empty">No outcomes yet.</p>
              ) : (
                <ol aria-label="Completed rounds" tabIndex={0}>
                  {state.rounds.map((round) => (
                    <li key={round.number}>
                      <span>Round {round.number}</span>
                      <span>
                        You {game.rowActions[round.playerAction]};{" "}
                        {personaName(slug, state.persona)}{" "}
                        {game.columnActions[round.opponentAction]}
                      </span>
                      <strong>
                        {formatRational(round.playerPayoff)} —{" "}
                        {formatRational(round.opponentPayoff)}
                      </strong>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {state.status === "complete" ? (
              <div className="one-shot-post-session" id="post-session-controls">
                <p>
                  Final score: {formatRational(state.playerScore)} for you,{" "}
                  {formatRational(state.opponentScore)} for{" "}
                  {personaName(slug, state.persona)}.
                </p>
                <button
                  className="one-shot-play-again"
                  onClick={() => dispatch({ type: "play-again" })}
                  ref={playAgainRef}
                  type="button"
                >
                  Play again
                </button>
              </div>
            ) : null}
          </section>

          <section
            aria-labelledby={`${slug}-matrix-title`}
            className="one-shot-analysis"
          >
            <div className="one-shot-analysis__heading">
              <p className="eyebrow">Matrix</p>
              <h2 id={`${slug}-matrix-title`}>The incentives on the table</h2>
            </div>
            <div
              aria-label={`Scrollable ${game.title} payoff matrix`}
              className="one-shot-matrix-scroll"
              tabIndex={0}
            >
              <table className="one-shot-matrix">
                <caption>
                  {game.title} payoff matrix. Each cell reads your payoff, then
                  your rival&apos;s.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">You / Rival</th>
                    {game.columnActions.map((action) => (
                      <th key={action} scope="col">
                        {action}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {game.rowActions.map((rowAction, row) => (
                    <tr key={rowAction}>
                      <th scope="row">{rowAction}</th>
                      {game.columnActions.map((_, column) => {
                        const profile = { row, column };
                        const [you, rival] = payoffAt(game, profile);
                        const isHighlighted =
                          highlightedRound?.playerAction === row &&
                          highlightedRound.opponentAction === column;
                        const isEquilibrium = equilibria.has(
                          profileKey(profile),
                        );
                        const isParetoEfficient = paretoEfficient.has(
                          profileKey(profile),
                        );
                        const youBestRespond = bestResponses(
                          game,
                          "row",
                          column,
                        ).includes(row);
                        const rivalBestRespond = bestResponses(
                          game,
                          "column",
                          row,
                        ).includes(column);

                        return (
                          <td
                            className={[
                              "one-shot-matrix__cell",
                              isHighlighted &&
                                "one-shot-matrix__cell--highlighted",
                              paretoMode &&
                                !isParetoEfficient &&
                                "one-shot-matrix__cell--dominated",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            data-highlight={
                              isHighlighted ? "current" : undefined
                            }
                            data-pareto={
                              paretoMode && !isParetoEfficient
                                ? "dominated"
                                : undefined
                            }
                            data-testid={`${slug}-matrix-cell-${row}-${column}`}
                            key={`${row}-${column}`}
                          >
                            <span>
                              {formatRational(you)}, {formatRational(rival)}
                            </span>
                            <span className="one-shot-matrix__best-responses">
                              {youBestRespond ? <b>You BR</b> : null}
                              {rivalBestRespond ? <b>Rival BR</b> : null}
                            </span>
                            {isEquilibrium ? <em>NE</em> : null}
                            {isHighlighted ? (
                              <span className="sr-only">Latest outcome.</span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AnalysisDrawer
              game={game}
              onParetoModeChange={setParetoMode}
              opponentName={personaName(slug, state.persona)}
              paretoMode={paretoMode}
              playerName="You"
              profiles={state.rounds.map((round) => ({
                row: round.playerAction,
                column: round.opponentAction,
              }))}
              title={game.title}
            />
          </section>
        </div>
      </section>
      <GameWorkbench
        defaultGame={game}
        extras={{ persona: state.persona, seed: state.seed }}
        variant="embedded"
      />
    </>
  );
}
