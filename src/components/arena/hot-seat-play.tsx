"use client";

import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { AnalysisDrawer } from "@/components/analysis/analysis-drawer";
import { hotSeatGameContent, type HotSeatSlug } from "@/content/hot-seat";
import { catalogBySlug } from "@/engine/catalog";
import { payoffAt, profileKey, type Player } from "@/engine/game";
import { formatRational } from "@/engine/rational";
import { paretoEfficientProfiles } from "@/engine/solve/pareto";
import { bestResponses, pureNashEquilibria } from "@/engine/solve/pure";
import {
  createHotSeatSession,
  hotSeatSessionToExport,
  reduceHotSeatSession,
} from "@/state/hot-seat-session";
import { serializeSessionExport } from "@/state/session-export";

export function HotSeatPlayExperience({ slug }: { readonly slug: HotSeatSlug }) {
  const content = hotSeatGameContent[slug];
  const { game } = catalogBySlug[slug];
  const [state, dispatch] = useReducer(reduceHotSeatSession, slug, () =>
    createHotSeatSession(slug),
  );
  const [paretoMode, setParetoMode] = useState(false);
  const [perspective, setPerspective] = useState<Player>("row");

  const rowChoiceRef = useRef<HTMLButtonElement>(null);
  const columnChoiceRef = useRef<HTMLButtonElement>(null);
  const handoverRef = useRef<HTMLButtonElement>(null);
  const advanceRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  const latestRound = state.rounds.at(-1);
  const showHighlight = state.phase === "reveal" || state.phase === "complete";
  const equilibria = new Set(pureNashEquilibria(game).map(profileKey));
  const paretoEfficient = new Set(paretoEfficientProfiles(game).map(profileKey));

  useEffect(() => {
    switch (state.focusTarget) {
      case "row-choice-0":
        rowChoiceRef.current?.focus();
        break;
      case "handover":
        handoverRef.current?.focus();
        break;
      case "column-choice-0":
        columnChoiceRef.current?.focus();
        break;
      case "advance":
        advanceRef.current?.focus();
        break;
      case "restart":
        restartRef.current?.focus();
        break;
    }
  }, [state.focusTarget, state.rounds.length, state.phase]);

  const handleRowShortcut = (event: KeyboardEvent<HTMLElement>) => {
    if (state.phase !== "row-commit" || !["1", "2"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    dispatch({ type: "commit-row", action: event.key === "1" ? 0 : 1 });
  };

  const handleColumnShortcut = (event: KeyboardEvent<HTMLElement>) => {
    if (state.phase !== "column-commit" || !["1", "2"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    dispatch({ type: "commit-column", action: event.key === "1" ? 0 : 1 });
  };

  const narration = (() => {
    switch (state.phase) {
      case "row-commit":
        return `Round ${state.rounds.length + 1} of ${content.roundLimit}. Player 1, choose your move in secret.`;
      case "handover":
        return "Player 1 has chosen. Pass the device to Player 2 without revealing your move.";
      case "column-commit":
        return "Player 2, choose your move.";
      case "reveal":
        return latestRound
          ? `Round ${latestRound.number}: Player 1 chose ${content.rowActions[latestRound.rowAction]}; Player 2 chose ${content.columnActions[latestRound.columnAction]}. Player 1 earned ${formatRational(latestRound.rowPayoff)} and Player 2 earned ${formatRational(latestRound.columnPayoff)}.`
          : "";
      case "complete":
        return `Session complete. Final score: Player 1 ${formatRational(state.rowScore)}, Player 2 ${formatRational(state.columnScore)}.`;
    }
  })();

  const downloadExport = () => {
    const json = serializeSessionExport(hotSeatSessionToExport(state));
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hot-seat-${slug}-session.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <section
        aria-labelledby={`${slug}-hotseat-title`}
        className="hot-seat-session"
        data-phase={state.phase}
        data-round={state.rounds.length}
        data-testid={`${slug}-hot-seat`}
      >
        <header className="one-shot-session__header">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 className="display" id={`${slug}-hotseat-title`}>
            {game.title}
          </h1>
          <p className="lede">{content.framing}</p>
        </header>

        <div className="one-shot-scoreboard" aria-label="Session score">
          <p>
            <span>Player 1</span>
            <strong>{formatRational(state.rowScore)}</strong>
          </p>
          <p>
            <span>Player 2</span>
            <strong>{formatRational(state.columnScore)}</strong>
          </p>
          <p>
            <span>Round</span>
            <strong>
              {Math.min(state.rounds.length + 1, content.roundLimit)} / {content.roundLimit}
            </strong>
          </p>
        </div>

        <div className="one-shot-layout">
          <section aria-labelledby={`${slug}-hotseat-arena`} className="one-shot-arena">
            <div className="one-shot-arena__heading">
              <div>
                <p className="eyebrow">Act</p>
                <h2 id={`${slug}-hotseat-arena`}>
                  {state.phase === "complete"
                    ? "Session complete"
                    : state.phase === "handover"
                      ? "Pass the device"
                      : state.phase === "reveal"
                        ? "Outcome"
                        : state.phase === "column-commit"
                          ? "Player 2 chooses"
                          : "Player 1 chooses"}
                </h2>
              </div>
            </div>

            {state.phase === "row-commit" ? (
              <div
                className="hot-seat-turn"
                data-testid="hot-seat-row-turn"
                onKeyDown={handleRowShortcut}
              >
                <p className="hot-seat-turn__prompt">
                  Player 1, choose in secret. Player 2 should look away.
                </p>
                <div className="one-shot-choices" aria-label="Player 1 move">
                  {content.rowActions.map((label, index) => (
                    <button
                      aria-keyshortcuts={String(index + 1)}
                      aria-label={`Player 1: ${label} (key ${index + 1})`}
                      className="one-shot-choice"
                      key={label}
                      onClick={() => dispatch({ type: "commit-row", action: index as 0 | 1 })}
                      ref={index === 0 ? rowChoiceRef : null}
                      type="button"
                    >
                      <span>{label}</span>
                      <kbd aria-hidden="true">{index + 1}</kbd>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {state.phase === "handover" ? (
              <div className="hot-seat-handover" data-testid="hot-seat-handover">
                <p className="hot-seat-handover__prompt">
                  Player 1 has locked in a hidden move. Pass the device to Player 2. The choice is
                  concealed until both players have moved.
                </p>
                <button
                  className="one-shot-play-again"
                  onClick={() => dispatch({ type: "acknowledge-handover" })}
                  ref={handoverRef}
                  type="button"
                >
                  Player 2 is ready
                </button>
              </div>
            ) : null}

            {state.phase === "column-commit" ? (
              <div
                className="hot-seat-turn"
                data-testid="hot-seat-column-turn"
                onKeyDown={handleColumnShortcut}
              >
                <p className="hot-seat-turn__prompt">
                  Player 2, choose your move. Player 1&apos;s choice stays hidden until you commit.
                </p>
                <div className="one-shot-choices" aria-label="Player 2 move">
                  {content.columnActions.map((label, index) => (
                    <button
                      aria-keyshortcuts={String(index + 1)}
                      aria-label={`Player 2: ${label} (key ${index + 1})`}
                      className="one-shot-choice"
                      key={label}
                      onClick={() =>
                        dispatch({
                          type: "commit-column",
                          action: index as 0 | 1,
                        })
                      }
                      ref={index === 0 ? columnChoiceRef : null}
                      type="button"
                    >
                      <span>{label}</span>
                      <kbd aria-hidden="true">{index + 1}</kbd>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {state.phase === "reveal" && latestRound ? (
              <div className="hot-seat-reveal" data-testid="hot-seat-reveal">
                <p className="hot-seat-reveal__line">
                  Player 1 chose <strong>{content.rowActions[latestRound.rowAction]}</strong>;
                  Player 2 chose <strong>{content.columnActions[latestRound.columnAction]}</strong>.
                </p>
                <p className="hot-seat-reveal__scores">
                  Player 1 {formatRational(latestRound.rowPayoff)} — Player 2{" "}
                  {formatRational(latestRound.columnPayoff)}
                </p>
                <button
                  className="one-shot-play-again"
                  onClick={() => dispatch({ type: "advance" })}
                  ref={advanceRef}
                  type="button"
                >
                  {state.rounds.length === content.roundLimit ? "See the analysis" : "Next round"}
                </button>
              </div>
            ) : null}

            <p aria-live="polite" className="sr-only" role="status">
              {narration}
            </p>

            <section aria-labelledby={`${slug}-hotseat-history`} className="one-shot-history">
              <div className="one-shot-history__heading">
                <p className="eyebrow">Observe</p>
                <h3 id={`${slug}-hotseat-history`}>History</h3>
              </div>
              {state.rounds.length === 0 ? (
                <p className="one-shot-history__empty">No outcomes yet.</p>
              ) : (
                <ol aria-label="Completed rounds" tabIndex={0}>
                  {state.rounds.map((round) => (
                    <li key={round.number}>
                      <span>Round {round.number}</span>
                      <span>
                        P1 {content.rowActions[round.rowAction]}; P2{" "}
                        {content.columnActions[round.columnAction]}
                      </span>
                      <strong>
                        {formatRational(round.rowPayoff)} — {formatRational(round.columnPayoff)}
                      </strong>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {state.phase === "complete" ? (
              <div className="one-shot-post-session" id="post-session-controls">
                <p>
                  Final score: {formatRational(state.rowScore)} for Player 1,{" "}
                  {formatRational(state.columnScore)} for Player 2.
                </p>
                <div className="hot-seat-post-actions">
                  <button
                    className="one-shot-play-again"
                    onClick={() => dispatch({ type: "restart" })}
                    ref={restartRef}
                    type="button"
                  >
                    Play again
                  </button>
                  <button className="hot-seat-export" onClick={downloadExport} type="button">
                    Download session
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <aside aria-labelledby={`${slug}-hotseat-matrix`} className="one-shot-analysis">
            <div className="one-shot-analysis__heading">
              <p className="eyebrow">Matrix</p>
              <h2 id={`${slug}-hotseat-matrix`}>The incentives on the table</h2>
            </div>
            <div
              aria-label={`Scrollable ${game.title} payoff matrix`}
              className="one-shot-matrix-scroll"
              tabIndex={0}
            >
              <table className="one-shot-matrix">
                <caption>
                  {game.title} payoff matrix. Each cell reads Player 1&apos;s payoff, then Player
                  2&apos;s.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">P1 / P2</th>
                    {content.columnActions.map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {content.rowActions.map((rowLabel, row) => (
                    <tr key={rowLabel}>
                      <th scope="row">{rowLabel}</th>
                      {content.columnActions.map((_, column) => {
                        const profile = { row, column };
                        const [p1, p2] = payoffAt(game, profile);
                        const isHighlighted =
                          showHighlight &&
                          latestRound?.rowAction === row &&
                          latestRound.columnAction === column;
                        const isEquilibrium = equilibria.has(profileKey(profile));
                        const isParetoEfficient = paretoEfficient.has(profileKey(profile));
                        const p1BestRespond = bestResponses(game, "row", column).includes(row);
                        const p2BestRespond = bestResponses(game, "column", row).includes(column);

                        return (
                          <td
                            className={[
                              "one-shot-matrix__cell",
                              isHighlighted && "one-shot-matrix__cell--highlighted",
                              paretoMode &&
                                !isParetoEfficient &&
                                "one-shot-matrix__cell--dominated",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            data-highlight={isHighlighted ? "current" : undefined}
                            data-testid={`${slug}-hot-seat-cell-${row}-${column}`}
                            key={`${row}-${column}`}
                          >
                            <span>
                              {formatRational(p1)}, {formatRational(p2)}
                            </span>
                            <span className="one-shot-matrix__best-responses">
                              {p1BestRespond ? <b>P1 BR</b> : null}
                              {p2BestRespond ? <b>P2 BR</b> : null}
                            </span>
                            {isEquilibrium ? <em>NE</em> : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hot-seat-perspective" role="group" aria-label="Analysis perspective">
              <span>Measure</span>
              <div className="hot-seat-perspective__buttons">
                <button
                  aria-pressed={perspective === "row"}
                  className="hot-seat-perspective__button"
                  onClick={() => setPerspective("row")}
                  type="button"
                >
                  Player 1
                </button>
                <button
                  aria-pressed={perspective === "column"}
                  className="hot-seat-perspective__button"
                  onClick={() => setPerspective("column")}
                  type="button"
                >
                  Player 2
                </button>
              </div>
            </div>

            <AnalysisDrawer
              actionLabels={{
                row: content.rowActions,
                column: content.columnActions,
              }}
              game={game}
              onParetoModeChange={setParetoMode}
              opponentName={perspective === "row" ? "Player 2" : "Player 1"}
              paretoMode={paretoMode}
              player={perspective}
              playerName={perspective === "row" ? "Player 1" : "Player 2"}
              profiles={state.rounds.map((round) => ({
                row: round.rowAction,
                column: round.columnAction,
              }))}
              title={game.title}
            />
          </aside>
        </div>
      </section>
    </>
  );
}
