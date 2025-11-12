"use client";

import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { AnalysisDrawer } from "@/components/analysis/analysis-drawer";
import { GameWorkbench } from "@/components/build/game-workbench";
import { pdActionCopy, pdPersonas } from "@/content/pd";
import { pd } from "@/engine/catalog/pd";
import { payoffAt, profileKey } from "@/engine/game";
import { paretoEfficientProfiles } from "@/engine/solve/pareto";
import { bestResponses, pureNashEquilibria } from "@/engine/solve/pure";
import { formatRational } from "@/engine/rational";
import { decodeGameSearch } from "@/state/game-url";
import {
  createPdSession,
  isPdPersonaId,
  PD_SESSION_ROUNDS,
  reducePdSession,
  type PdAction,
} from "@/state/pd-session";

const equilibria = new Set(pureNashEquilibria(pd.game).map(profileKey));
const paretoEfficient = new Set(paretoEfficientProfiles(pd.game).map(profileKey));

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

function personaName(personaId: string): string {
  return pdPersonas.find((persona) => persona.id === personaId)?.name ?? "Rival";
}

export function PdPlayExperience() {
  const [state, dispatch] = useReducer(reducePdSession, undefined, () => createPdSession());
  const [paretoMode, setParetoMode] = useState(false);
  const reducedMotion = useReducedMotion();
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const secondChoiceRef = useRef<HTMLButtonElement>(null);
  const playAgainRef = useRef<HTMLButtonElement>(null);
  const priorStateRef = useRef({ seed: state.seed, status: state.status });
  const latestRound = state.rounds.at(-1);
  const highlightedRound = state.pendingRound ?? latestRound;

  useEffect(() => {
    const decoded = decodeGameSearch(window.location.search);
    if (decoded.kind !== "valid") {
      return;
    }
    const rawPersona = decoded.state.extras.persona;
    const persona = rawPersona !== undefined && isPdPersonaId(rawPersona) ? rawPersona : undefined;
    const seed = decoded.state.extras.seed;
    if (persona === undefined && seed === undefined) {
      return;
    }
    dispatch({ type: "hydrate", persona, seed });
  }, []);

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
      (state.focusTarget === "choice-0" ? firstChoiceRef : secondChoiceRef).current?.focus();
    } else if (state.rounds.length === 0 && state.seed !== priorState.seed) {
      firstChoiceRef.current?.focus();
    }

    priorStateRef.current = { seed: state.seed, status: state.status };
  }, [state.focusTarget, state.rounds.length, state.seed, state.status]);

  const submitChoice = (action: PdAction) => {
    dispatch({ type: "submit-choice", action });
  };

  const handleShortcut = (event: KeyboardEvent<HTMLElement>) => {
    if (state.status !== "playing" || !["1", "2"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    submitChoice(event.key === "1" ? 0 : 1);
  };

  const narration =
    state.status === "resolving"
      ? `${personaName(state.persona)} is deciding.`
      : latestRound
        ? `Round ${latestRound.number}: you ${pdActionCopy[latestRound.playerAction].pastTense}; ${personaName(state.persona)} ${pdActionCopy[latestRound.opponentAction].pastTense}. You earned ${formatRational(latestRound.playerPayoff)} and ${personaName(state.persona)} earned ${formatRational(latestRound.opponentPayoff)}.`
        : `Round 1 of ${PD_SESSION_ROUNDS}. Choose a price move.`;

  return (
    <>
      <section
        aria-labelledby="pd-title"
        className="pd-session"
        data-round={state.rounds.length}
        onKeyDown={handleShortcut}
      >
        <header className="pd-session__header">
          <p className="eyebrow">Play / Price war</p>
          <h1 className="display" id="pd-title">
            Prisoner&apos;s Dilemma
          </h1>
          <p className="lede">
            Two firms set a price at the same time. Protect the margin together, or chase the other
            firm&apos;s customers.
          </p>
        </header>

        <div className="pd-scoreboard" aria-label="Session score">
          <p>
            <span>You</span>
            <strong>{formatRational(state.playerScore)}</strong>
          </p>
          <p>
            <span>{personaName(state.persona)}</span>
            <strong>{formatRational(state.opponentScore)}</strong>
          </p>
          <p>
            <span>Round</span>
            <strong>
              {Math.min(state.rounds.length + 1, PD_SESSION_ROUNDS)} / {PD_SESSION_ROUNDS}
            </strong>
          </p>
        </div>

        <div className="pd-layout">
          <section aria-labelledby="arena-title" className="pd-arena">
            <div className="pd-arena__heading">
              <div>
                <p className="eyebrow">Act</p>
                <h2 id="arena-title">
                  {state.status === "complete" ? "Session complete" : "Set your price."}
                </h2>
              </div>
              <label className="pd-persona">
                <span>Rival</span>
                <select
                  aria-label="Choose rival"
                  disabled={state.rounds.length > 0 || state.status === "resolving"}
                  onChange={(event) =>
                    dispatch({
                      type: "select-persona",
                      persona: event.target.value as (typeof pdPersonas)[number]["id"],
                    })
                  }
                  value={state.persona}
                >
                  {pdPersonas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="pd-persona__description">
              {pdPersonas.find((persona) => persona.id === state.persona)?.description}
            </p>

            <div className="pd-choices" aria-label="Choose your price move">
              {pdActionCopy.map((action, index) => (
                <button
                  aria-keyshortcuts={action.shortcut}
                  aria-label={`${action.label} (key ${action.shortcut})`}
                  className="pd-choice"
                  disabled={state.status !== "playing"}
                  key={action.label}
                  onClick={() => submitChoice(index as PdAction)}
                  ref={index === 0 ? firstChoiceRef : secondChoiceRef}
                  type="button"
                >
                  <span>{action.label}</span>
                  <kbd aria-hidden="true">{action.shortcut}</kbd>
                </button>
              ))}
            </div>

            <p className="pd-observation" data-resolving={state.status === "resolving"}>
              {state.status === "resolving"
                ? `${personaName(state.persona)} is deciding…`
                : state.status === "complete"
                  ? "The ten-round session is complete. Open the analysis, then try another rival."
                  : "Choose an action. The outcome commits before the next round begins."}
            </p>

            <p aria-live="polite" className="sr-only" role="status">
              {narration}
            </p>

            <section aria-labelledby="history-title" className="pd-history">
              <div className="pd-history__heading">
                <p className="eyebrow">Observe</p>
                <h3 id="history-title">History</h3>
              </div>
              {state.rounds.length === 0 ? (
                <p className="pd-history__empty">No outcomes yet.</p>
              ) : (
                <ol aria-label="Completed rounds" tabIndex={0}>
                  {state.rounds.map((round) => (
                    <li key={round.number}>
                      <span>Round {round.number}</span>
                      <span>
                        You {pdActionCopy[round.playerAction].pastTense};{" "}
                        {personaName(state.persona)} {pdActionCopy[round.opponentAction].pastTense}
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
              <div className="pd-post-session" id="post-session-controls">
                <p>
                  Final score: {formatRational(state.playerScore)} for you,{" "}
                  {formatRational(state.opponentScore)} for {personaName(state.persona)}.
                </p>
                <button
                  className="pd-play-again"
                  onClick={() => dispatch({ type: "play-again" })}
                  ref={playAgainRef}
                  type="button"
                >
                  Play again
                </button>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="matrix-title" className="pd-analysis">
            <div className="pd-analysis__heading">
              <p className="eyebrow">Matrix</p>
              <h2 id="matrix-title">The incentives on the table</h2>
            </div>
            <div
              aria-label="Scrollable price-war payoff matrix"
              className="pd-matrix-scroll"
              tabIndex={0}
            >
              <table className="pd-matrix">
                <caption>
                  Price-war payoff matrix. Each cell reads your payoff, then your rival&apos;s.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">You / Rival</th>
                    {pdActionCopy.map((action) => (
                      <th key={action.label} scope="col">
                        {action.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pd.game.rowActions.map((_, row) => (
                    <tr key={pdActionCopy[row].label}>
                      <th scope="row">{pdActionCopy[row].label}</th>
                      {pd.game.columnActions.map((__, column) => {
                        const profile = { row, column };
                        const [you, rival] = payoffAt(pd.game, profile);
                        const isHighlighted =
                          highlightedRound?.playerAction === row &&
                          highlightedRound.opponentAction === column;
                        const isEquilibrium = equilibria.has(profileKey(profile));
                        const isParetoEfficient = paretoEfficient.has(profileKey(profile));
                        const youBestRespond = bestResponses(pd.game, "row", column).includes(row);
                        const rivalBestRespond = bestResponses(pd.game, "column", row).includes(
                          column,
                        );

                        return (
                          <td
                            className={[
                              "pd-matrix__cell",
                              isHighlighted && "pd-matrix__cell--highlighted",
                              paretoMode && !isParetoEfficient && "pd-matrix__cell--dominated",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            data-pareto={paretoMode && !isParetoEfficient ? "dominated" : undefined}
                            data-highlight={isHighlighted ? "current" : undefined}
                            data-testid={`matrix-cell-${row}-${column}`}
                            key={`${row}-${column}`}
                          >
                            <span>
                              {formatRational(you)}, {formatRational(rival)}
                            </span>
                            <span className="pd-matrix__best-responses">
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
              actionLabels={{
                row: pdActionCopy.map((action) => action.label),
                column: pdActionCopy.map((action) => action.label),
              }}
              game={pd.game}
              onParetoModeChange={setParetoMode}
              opponentName={personaName(state.persona)}
              paretoMode={paretoMode}
              playerName="You"
              profiles={state.rounds.map((round) => ({
                row: round.playerAction,
                column: round.opponentAction,
              }))}
              title="Price war"
            />
          </section>
        </div>
      </section>
      <GameWorkbench
        defaultGame={pd.game}
        embedSlug="pd"
        extras={{ persona: state.persona, seed: state.seed }}
        variant="embedded"
      />
    </>
  );
}
