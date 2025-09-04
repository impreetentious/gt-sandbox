"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AnalysisDrawer } from "@/components/analysis/analysis-drawer";
import {
  createNormalFormGame,
  profileKey,
  type NormalFormGame,
} from "@/engine/game";
import {
  classifyTwoByTwo,
  type StrategicStructure,
} from "@/engine/solve/classify";
import { analyzeMixedEquilibria } from "@/engine/solve/mixed";
import { paretoEfficientProfiles } from "@/engine/solve/pareto";
import { bestResponses, pureNashEquilibria } from "@/engine/solve/pure";
import {
  MAX_ACTIONS,
  MIN_ACTIONS,
  decodeGameSearch,
  draftToGame,
  encodeGameSearch,
  gameToDraft,
  type EditableGameDraft,
  type GameShareExtras,
} from "@/state/game-url";

const blankGame = createNormalFormGame({
  id: "custom",
  title: "Untitled strategic game",
  rowActions: ["Row A", "Row B"],
  columnActions: ["Column A", "Column B"],
  payoffs: [
    [
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [0, 0],
    ],
  ],
});
const emptyExtras: GameShareExtras = {};

interface GameWorkbenchProps {
  readonly defaultGame?: NormalFormGame;
  readonly extras?: GameShareExtras;
  readonly variant?: "page" | "embedded";
}

function structureFor(game: NormalFormGame): StrategicStructure | null {
  return game.rowActions.length === 2 && game.columnActions.length === 2
    ? classifyTwoByTwo(game)
    : null;
}

function resizeDraft(
  draft: EditableGameDraft,
  rowCount: number,
  columnCount: number,
): EditableGameDraft {
  const rowActions = Array.from(
    { length: rowCount },
    (_, index) => draft.rowActions[index] ?? `Row ${index + 1}`,
  );
  const columnActions = Array.from(
    { length: columnCount },
    (_, index) => draft.columnActions[index] ?? `Column ${index + 1}`,
  );
  const payoffs = Array.from({ length: rowCount }, (_, row) =>
    Array.from(
      { length: columnCount },
      (_, column) => draft.payoffs[row]?.[column] ?? (["0", "0"] as const),
    ),
  );

  return { ...draft, rowActions, columnActions, payoffs };
}

function updateAction(
  draft: EditableGameDraft,
  player: "row" | "column",
  index: number,
  value: string,
): EditableGameDraft {
  if (player === "row") {
    const rowActions = [...draft.rowActions];
    rowActions[index] = value;
    return { ...draft, rowActions };
  }

  const columnActions = [...draft.columnActions];
  columnActions[index] = value;
  return { ...draft, columnActions };
}

function updatePayoff(
  draft: EditableGameDraft,
  row: number,
  column: number,
  player: 0 | 1,
  value: string,
): EditableGameDraft {
  const payoffs = draft.payoffs.map((payoffRow) =>
    payoffRow.map((cell) => [...cell] as [string, string]),
  );
  payoffs[row][column][player] = value;
  return { ...draft, payoffs };
}

function structureSentence(structure: StrategicStructure | null): string {
  return structure
    ? `This is ${structure === "anti-coordination" ? "an" : "a"} ${structure} game.`
    : "Structure labels are available for 2×2 games; the exact equilibrium analysis still updates for this larger game.";
}

export function GameWorkbench({
  defaultGame = blankGame,
  extras = emptyExtras,
  variant = "page",
}: GameWorkbenchProps) {
  const [draft, setDraft] = useState<EditableGameDraft>(() =>
    gameToDraft(defaultGame),
  );
  const [game, setGame] = useState(defaultGame);
  const [shareExtras, setShareExtras] = useState(extras);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(
    structureSentence(structureFor(defaultGame)),
  );
  const [paretoMode, setParetoMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const manualCopyRef = useRef<HTMLInputElement>(null);
  const previousStructureRef = useRef(structureFor(defaultGame));
  const loadedSharedStateRef = useRef(false);

  useEffect(() => {
    const initialSearch = window.location.search;
    const timer = window.setTimeout(() => {
      const decoded = decodeGameSearch(initialSearch);

      if (decoded.kind === "valid") {
        loadedSharedStateRef.current = true;
        setGame(decoded.state.game);
        setDraft(gameToDraft(decoded.state.game));
        setShareExtras(decoded.state.extras);
        previousStructureRef.current = structureFor(decoded.state.game);
        setAnnouncement(structureSentence(previousStructureRef.current));
      } else if (decoded.kind === "invalid") {
        setNotice(decoded.notice);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loadedSharedStateRef.current) {
      const timer = window.setTimeout(() => setShareExtras(extras), 0);
      return () => window.clearTimeout(timer);
    }
  }, [extras]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = draftToGame(draft, defaultGame.id);

      if (!result.ok) {
        setNotice(
          `${result.notice} The last valid analysis remains on screen.`,
        );
        return;
      }

      const nextStructure = structureFor(result.game);
      const previousStructure = previousStructureRef.current;
      if (nextStructure !== previousStructure) {
        setAnnouncement(
          previousStructure && nextStructure
            ? `Structure changed: this was ${previousStructure}; it is now ${nextStructure}.`
            : structureSentence(nextStructure),
        );
      } else {
        setAnnouncement(structureSentence(nextStructure));
      }

      previousStructureRef.current = nextStructure;
      setGame(result.game);
      setNotice(null);
      setCopied(false);
      setManualCopy(false);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [defaultGame.id, draft]);

  const shareSearch = useMemo(
    () => encodeGameSearch({ game, extras: shareExtras }),
    [game, shareExtras],
  );
  const shareUrl =
    typeof window === "undefined"
      ? `?${shareSearch}`
      : `${window.location.origin}${window.location.pathname}?${shareSearch}`;

  useEffect(() => {
    if (dirty) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${shareSearch}`,
      );
    }
  }, [dirty, shareSearch]);

  useEffect(() => {
    if (manualCopy) {
      manualCopyRef.current?.focus();
      manualCopyRef.current?.select();
    }
  }, [manualCopy]);

  const analysis = useMemo(() => analyzeMixedEquilibria(game), [game]);
  const equilibria = useMemo(
    () => new Set(pureNashEquilibria(game).map(profileKey)),
    [game],
  );
  const paretoEfficient = useMemo(
    () => new Set(paretoEfficientProfiles(game).map(profileKey)),
    [game],
  );

  const setDimension = (
    player: "row" | "column",
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const count = Number(event.target.value);
    setDirty(true);
    setDraft((current) =>
      resizeDraft(
        current,
        player === "row" ? count : current.rowActions.length,
        player === "column" ? count : current.columnActions.length,
      ),
    );
  };

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setManualCopy(false);
    } catch {
      setCopied(false);
      setManualCopy(true);
    }
  };

  return (
    <section
      aria-labelledby={`${defaultGame.id}-workbench-title`}
      className={`game-workbench game-workbench--${variant}`}
      data-testid="game-workbench"
    >
      <header className="game-workbench__header">
        <div>
          <p className="eyebrow">
            {variant === "page"
              ? "Build / Live solver"
              : "Build / Edit this game"}
          </p>
          {variant === "page" ? (
            <h1 className="display" id={`${defaultGame.id}-workbench-title`}>
              Shape the incentives.
            </h1>
          ) : (
            <h2 id={`${defaultGame.id}-workbench-title`}>
              Change the payoffs. Watch the game change.
            </h2>
          )}
        </div>
        <p>
          Every valid edit is solved with exact fractions. The last valid game
          stays visible while an incomplete input is corrected.
        </p>
      </header>

      <div className="game-workbench__controls">
        <label>
          <span>Game title</span>
          <input
            maxLength={80}
            onChange={(event) => {
              setDirty(true);
              setDraft((current) => ({
                ...current,
                title: event.target.value,
              }));
            }}
            value={draft.title}
          />
        </label>
        {variant === "page" ? (
          <>
            <label>
              <span>Your actions</span>
              <select
                aria-label="Number of row actions"
                onChange={(event) => setDimension("row", event)}
                value={draft.rowActions.length}
              >
                {Array.from(
                  { length: MAX_ACTIONS - MIN_ACTIONS + 1 },
                  (_, index) => index + MIN_ACTIONS,
                ).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Rival actions</span>
              <select
                aria-label="Number of column actions"
                onChange={(event) => setDimension("column", event)}
                value={draft.columnActions.length}
              >
                {Array.from(
                  { length: MAX_ACTIONS - MIN_ACTIONS + 1 },
                  (_, index) => index + MIN_ACTIONS,
                ).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>

      {notice ? (
        <p
          aria-live="assertive"
          className="game-workbench__notice"
          role="alert"
        >
          {notice}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div
        aria-label="Scrollable editable payoff matrix"
        className="game-workbench__matrix-scroll"
        tabIndex={0}
      >
        <table className="game-workbench__matrix">
          <caption>
            Editable payoff matrix. Each cell contains your payoff first, then
            the rival&apos;s payoff.
          </caption>
          <thead>
            <tr>
              <th scope="col">You / Rival</th>
              {draft.columnActions.map((action, column) => (
                <th key={column} scope="col">
                  <label>
                    <span className="sr-only">Column action {column + 1}</span>
                    <input
                      aria-label={`Column action ${column + 1}`}
                      maxLength={40}
                      onChange={(event) => {
                        setDirty(true);
                        setDraft((current) =>
                          updateAction(
                            current,
                            "column",
                            column,
                            event.target.value,
                          ),
                        );
                      }}
                      value={action}
                    />
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.rowActions.map((action, row) => (
              <tr key={row}>
                <th scope="row">
                  <label>
                    <span className="sr-only">Row action {row + 1}</span>
                    <input
                      aria-label={`Row action ${row + 1}`}
                      maxLength={40}
                      onChange={(event) => {
                        setDirty(true);
                        setDraft((current) =>
                          updateAction(current, "row", row, event.target.value),
                        );
                      }}
                      value={action}
                    />
                  </label>
                </th>
                {draft.columnActions.map((_, column) => {
                  const profile = { row, column };
                  const isInAnalyzedGame =
                    row < game.rowActions.length &&
                    column < game.columnActions.length;
                  const isEquilibrium = equilibria.has(profileKey(profile));
                  const isPareto = paretoEfficient.has(profileKey(profile));
                  const rowBestResponse =
                    isInAnalyzedGame &&
                    bestResponses(game, "row", column).includes(row);
                  const columnBestResponse =
                    isInAnalyzedGame &&
                    bestResponses(game, "column", row).includes(column);
                  const cell = draft.payoffs[row][column];

                  return (
                    <td
                      className={
                        paretoMode && !isPareto
                          ? "game-workbench__cell--dominated"
                          : undefined
                      }
                      data-testid={`editable-cell-${row}-${column}`}
                      key={column}
                    >
                      <div className="game-workbench__payoffs">
                        <label>
                          <span>Your payoff</span>
                          <input
                            aria-label={`Your payoff for row ${row + 1}, column ${column + 1}`}
                            inputMode="decimal"
                            onChange={(event) => {
                              setDirty(true);
                              setDraft((current) =>
                                updatePayoff(
                                  current,
                                  row,
                                  column,
                                  0,
                                  event.target.value,
                                ),
                              );
                            }}
                            value={cell[0]}
                          />
                        </label>
                        <label>
                          <span>Rival payoff</span>
                          <input
                            aria-label={`Rival payoff for row ${row + 1}, column ${column + 1}`}
                            inputMode="decimal"
                            onChange={(event) => {
                              setDirty(true);
                              setDraft((current) =>
                                updatePayoff(
                                  current,
                                  row,
                                  column,
                                  1,
                                  event.target.value,
                                ),
                              );
                            }}
                            value={cell[1]}
                          />
                        </label>
                      </div>
                      <span className="game-workbench__badges">
                        {rowBestResponse ? <b>You BR</b> : null}
                        {columnBestResponse ? <b>Rival BR</b> : null}
                        {isEquilibrium ? <em>NE</em> : null}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section
        aria-labelledby={`${defaultGame.id}-verdict-title`}
        className="game-workbench__verdict"
      >
        <p className="eyebrow">Computed verdict</p>
        <h2 id={`${defaultGame.id}-verdict-title`}>
          {structureSentence(structureFor(game))}
        </h2>
        <p>
          {pureNashEquilibria(game).length} pure{" "}
          {pureNashEquilibria(game).length === 1 ? "equilibrium" : "equilibria"}
          ; {analysis.equilibria.length} exact equilibrium profile
          {analysis.equilibria.length === 1 ? "" : "s"} enumerated.
        </p>
        {analysis.degeneracyWitness ? (
          <p className="analysis-warning" role="status">
            Degeneracy detected. The engine shows verified equilibria without
            claiming that this sample describes every equilibrium component.
          </p>
        ) : null}
      </section>

      {variant === "page" ? (
        <AnalysisDrawer
          defaultOpen
          game={game}
          onParetoModeChange={setParetoMode}
          opponentName="the rival"
          paretoMode={paretoMode}
          playerName="You"
          profiles={[]}
          showAllPanels
          title={game.title}
        />
      ) : null}

      <section
        aria-labelledby={`${defaultGame.id}-share-title`}
        className="game-workbench__share"
      >
        <div>
          <p className="eyebrow">Reproduce</p>
          <h2 id={`${defaultGame.id}-share-title`}>
            Share the complete game state.
          </h2>
          <p>
            The link contains the labels, exact payoffs, and any supplied seed
            or simulation settings. Nothing is uploaded.
          </p>
        </div>
        <button className="analysis-button" onClick={copyLink} type="button">
          Copy reproducible link
        </button>
        {copied ? (
          <p className="game-workbench__copied" role="status">
            Copied. The complete bounded state is in the link.
          </p>
        ) : null}
        {manualCopy ? (
          <label className="game-workbench__manual-copy">
            <span>
              Clipboard access is unavailable. Copy this link manually.
            </span>
            <input readOnly ref={manualCopyRef} value={shareUrl} />
          </label>
        ) : null}
      </section>

      {variant === "page" ? (
        <button
          className="game-workbench__reset"
          onClick={() => {
            setDraft(gameToDraft(defaultGame));
            setGame(defaultGame);
            setShareExtras(extras);
            setNotice(null);
            setDirty(true);
          }}
          type="button"
        >
          Reset to blank 2×2
        </button>
      ) : null}
    </section>
  );
}
