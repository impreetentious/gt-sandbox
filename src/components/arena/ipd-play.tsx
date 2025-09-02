"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AnalysisDrawer } from "@/components/analysis/analysis-drawer";
import { GameWorkbench } from "@/components/build/game-workbench";
import { ipdActionCopy, ipdOpponentOptions } from "@/content/ipd";
import { ipd } from "@/engine/catalog/ipd";
import { payoffAt, profileKey } from "@/engine/game";
import { formatRational } from "@/engine/rational";
import { simulateIpdMatch } from "@/engine/repeated/match";
import {
  ipdStrategyById,
  type IpdStrategy,
} from "@/engine/repeated/strategies";
import { paretoEfficientProfiles } from "@/engine/solve/pareto";
import { bestResponses, pureNashEquilibria } from "@/engine/solve/pure";
import {
  createIpdSession,
  reduceIpdSession,
  type IpdOpponentChoice,
} from "@/state/ipd-session";

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

function StrategyDiagram({ strategy }: { readonly strategy: IpdStrategy }) {
  const width = Math.max(180, strategy.diagram.states.length * 116);

  return (
    <section aria-labelledby="ipd-fsm-title" className="ipd-fsm">
      <p className="eyebrow">Opponent reveal</p>
      <h2 id="ipd-fsm-title">{strategy.name}</h2>
      <p>{strategy.shortDescription}</p>
      <svg
        aria-label={`${strategy.name} state diagram: ${strategy.diagram.transitions.join(". ")}`}
        className="ipd-fsm__diagram"
        role="img"
        viewBox={`0 0 ${width} 86`}
      >
        {strategy.diagram.states.map((state, index) => {
          const x = 50 + index * 116;
          const nextX = x + 66;

          return (
            <g key={state}>
              {index < strategy.diagram.states.length - 1 ? (
                <path
                  d={`M ${x + 34} 43 H ${nextX - 12}`}
                  markerEnd="url(#ipd-arrow)"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              ) : null}
              <circle
                cx={x}
                cy="43"
                fill="var(--paper-raised)"
                r="33"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <text
                dominantBaseline="middle"
                fontSize="11"
                textAnchor="middle"
                x={x}
                y="43"
              >
                {state}
              </text>
            </g>
          );
        })}
        <defs>
          <marker
            id="ipd-arrow"
            markerHeight="6"
            markerWidth="6"
            orient="auto"
            refX="5"
            refY="3"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill="currentColor" />
          </marker>
        </defs>
      </svg>
      <ul className="analysis-list">
        {strategy.diagram.transitions.map((transition) => (
          <li key={transition}>{transition}</li>
        ))}
      </ul>
    </section>
  );
}

/** P6's interactive finite IPD match, backed by the same engine as tournaments. */
export function IpdPlayExperience() {
  const [state, dispatch] = useReducer(reduceIpdSession, undefined, () =>
    createIpdSession(),
  );
  const [paretoMode, setParetoMode] = useState(false);
  const reducedMotion = useReducedMotion();
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const secondChoiceRef = useRef<HTMLButtonElement>(null);
  const playAgainRef = useRef<HTMLButtonElement>(null);
  const priorStateRef = useRef({
    seed: state.config.masterSeed,
    status: state.status,
  });
  const latestRound = state.rounds.at(-1);
  const highlightedRound = state.pendingRound ?? latestRound;
  const opponentStrategy = ipdStrategyById[state.opponentStrategy];
  const opponentName =
    state.mystery && state.status !== "complete"
      ? "Mystery rival"
      : opponentStrategy.name;
  const counterfactual = useMemo(
    () =>
      state.status === "complete"
        ? simulateIpdMatch({ ...state.config, rowStrategy: "tft" })
        : undefined,
    [state.config, state.status],
  );
  const equilibria = new Set(pureNashEquilibria(ipd.game).map(profileKey));
  const paretoEfficient = new Set(
    paretoEfficientProfiles(ipd.game).map(profileKey),
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
    } else if (
      state.rounds.length === 0 &&
      state.config.masterSeed !== priorState.seed
    ) {
      firstChoiceRef.current?.focus();
    }

    priorStateRef.current = {
      seed: state.config.masterSeed,
      status: state.status,
    };
  }, [
    state.config.masterSeed,
    state.focusTarget,
    state.rounds.length,
    state.status,
  ]);

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
      ? `${opponentName} is deciding.`
      : latestRound
        ? `Round ${latestRound.number}: you ${ipdActionCopy[latestRound.row.action].pastTense}; ${opponentName} ${ipdActionCopy[latestRound.column.action].pastTense}. You earned ${formatRational(latestRound.rowPayoff)} and ${opponentName} earned ${formatRational(latestRound.columnPayoff)}.`
        : `A seeded match is ready for ${state.length.rounds} rounds. Choose a move.`;

  return (
    <>
      <section
        aria-labelledby="ipd-title"
        className="ipd-session one-shot-session"
        data-round={state.rounds.length}
        data-testid="ipd-session"
        onKeyDown={handleShortcut}
      >
        <header className="one-shot-session__header">
          <p className="eyebrow">Play / The shadow of the future</p>
          <h1 className="display" id="ipd-title">
            Iterated Prisoner&apos;s Dilemma
          </h1>
          <p className="lede">
            A price decision is no longer a one-off. The next round may arrive,
            so today&apos;s move can change what a rival does tomorrow.
          </p>
        </header>

        <div className="one-shot-scoreboard" aria-label="Match score">
          <p>
            <span>You</span>
            <strong>{formatRational(state.playerScore)}</strong>
          </p>
          <p>
            <span>{opponentName}</span>
            <strong>{formatRational(state.opponentScore)}</strong>
          </p>
          <p>
            <span>Round</span>
            <strong>
              {Math.min(state.rounds.length + 1, state.length.rounds)} /{" "}
              {state.length.rounds}
            </strong>
          </p>
        </div>

        <div className="one-shot-layout">
          <section aria-labelledby="ipd-arena-title" className="one-shot-arena">
            <div className="one-shot-arena__heading">
              <div>
                <p className="eyebrow">Act</p>
                <h2 id="ipd-arena-title">
                  {state.status === "complete"
                    ? "Match complete"
                    : "Choose your move."}
                </h2>
              </div>
              <label className="one-shot-persona">
                <span>Rival</span>
                <select
                  aria-label="Choose IPD rival"
                  disabled={
                    state.rounds.length > 0 || state.status === "resolving"
                  }
                  onChange={(event) =>
                    dispatch({
                      type: "select-opponent",
                      opponent: event.target.value as IpdOpponentChoice,
                    })
                  }
                  value={state.selectedOpponent}
                >
                  {ipdOpponentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="one-shot-persona__description">
              {state.mystery && state.status !== "complete"
                ? "Identity stays hidden until the reveal. The seeded environment is already fixed."
                : opponentStrategy.shortDescription}
            </p>

            <div className="one-shot-choices" aria-label="Choose your IPD move">
              {ipdActionCopy.map((action, index) => (
                <button
                  aria-keyshortcuts={action.shortcut}
                  aria-label={`${action.label} (key ${action.shortcut})`}
                  className="one-shot-choice"
                  disabled={state.status !== "playing"}
                  key={action.label}
                  onClick={() =>
                    dispatch({ type: "submit-choice", action: index as 0 | 1 })
                  }
                  ref={index === 0 ? firstChoiceRef : secondChoiceRef}
                  type="button"
                >
                  <span>{action.label}</span>
                  <kbd aria-hidden="true">{action.shortcut}</kbd>
                </button>
              ))}
            </div>

            <p
              className="one-shot-observation"
              data-resolving={state.status === "resolving"}
            >
              {state.status === "resolving"
                ? `${opponentName} is deciding…`
                : state.status === "complete"
                  ? "The match is complete. The reveal keeps the same seed and environment for its counterfactual."
                  : "Both intended moves are chosen before any noise could alter an outcome."}
            </p>
            <p aria-live="polite" className="sr-only" role="status">
              {narration}
            </p>

            <section
              aria-labelledby="ipd-history-title"
              className="one-shot-history"
            >
              <div className="one-shot-history__heading">
                <p className="eyebrow">Observe</p>
                <h3 id="ipd-history-title">History</h3>
              </div>
              {state.rounds.length === 0 ? (
                <p className="one-shot-history__empty">No outcomes yet.</p>
              ) : (
                <ol aria-label="Completed IPD rounds" tabIndex={0}>
                  {state.rounds.map((round) => (
                    <li key={round.number}>
                      <span>Round {round.number}</span>
                      <span>
                        You {ipdActionCopy[round.row.action].pastTense};{" "}
                        {opponentName}{" "}
                        {ipdActionCopy[round.column.action].pastTense}
                      </span>
                      <strong>
                        {formatRational(round.rowPayoff)} —{" "}
                        {formatRational(round.columnPayoff)}
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
                  {formatRational(state.opponentScore)} for {opponentName}.
                </p>
                {state.length.truncatedAtCap ? (
                  <p className="analysis-caveat" role="status">
                    This seeded match reached the 5,000-round safety cap. The
                    result is disclosed as truncated rather than treated as an
                    unbounded match.
                  </p>
                ) : null}
                {counterfactual ? (
                  <p className="ipd-counterfactual" role="status">
                    Tit for Tat in your seat would have scored{" "}
                    {formatRational(counterfactual.rowTotal)} against this same
                    rival and seed.
                  </p>
                ) : null}
                <StrategyDiagram strategy={opponentStrategy} />
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
            aria-labelledby="ipd-matrix-title"
            className="one-shot-analysis"
          >
            <div className="one-shot-analysis__heading">
              <p className="eyebrow">Stage-game matrix</p>
              <h2 id="ipd-matrix-title">The incentives persist</h2>
            </div>
            <div
              aria-label="Scrollable IPD payoff matrix"
              className="one-shot-matrix-scroll"
              tabIndex={0}
            >
              <table className="one-shot-matrix">
                <caption>
                  Prisoner&apos;s Dilemma stage-game payoff matrix. Each cell
                  reads your payoff, then your rival&apos;s.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">You / Rival</th>
                    {ipd.game.columnActions.map((action) => (
                      <th key={action} scope="col">
                        {action}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ipd.game.rowActions.map((rowAction, row) => (
                    <tr key={rowAction}>
                      <th scope="row">{rowAction}</th>
                      {ipd.game.columnActions.map((_, column) => {
                        const profile = { row, column };
                        const [you, rival] = payoffAt(ipd.game, profile);
                        const isHighlighted =
                          highlightedRound?.row.action === row &&
                          highlightedRound.column.action === column;
                        const isEquilibrium = equilibria.has(
                          profileKey(profile),
                        );
                        const isParetoEfficient = paretoEfficient.has(
                          profileKey(profile),
                        );
                        const youBestRespond = bestResponses(
                          ipd.game,
                          "row",
                          column,
                        ).includes(row);
                        const rivalBestRespond = bestResponses(
                          ipd.game,
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
                            data-testid={`ipd-matrix-cell-${row}-${column}`}
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
              game={ipd.game}
              onParetoModeChange={setParetoMode}
              opponentName={opponentName}
              paretoMode={paretoMode}
              playerName="You"
              profiles={state.rounds.map((round) => ({
                row: round.row.action,
                column: round.column.action,
              }))}
              title="Iterated price war"
            />
          </section>
        </div>
      </section>
      <GameWorkbench
        defaultGame={ipd.game}
        extras={{
          continuationProbability: state.config.continuationProbability,
          noise: state.config.noise,
          persona: state.opponentStrategy,
          seed: state.config.masterSeed,
        }}
        variant="embedded"
      />
    </>
  );
}
