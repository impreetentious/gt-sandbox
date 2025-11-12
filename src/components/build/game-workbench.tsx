"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AnalysisDrawer } from "@/components/analysis/analysis-drawer";
import { createNormalFormGame, profileKey, type NormalFormGame } from "@/engine/game";
import type { GameSlug } from "@/engine/catalog/types";
import { classifyTwoByTwo, type StrategicStructure } from "@/engine/solve/classify";
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
import { decodeAnnotation, setAnnotation } from "@/state/annotation-url";

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
  // V2-P13 — set only where a chromeless `/embed/<slug>/` route exists, which
  // is the six catalog games. A custom Build draft has no embed route, so the
  // snippet control stays hidden rather than emitting a dead iframe.
  readonly embedSlug?: GameSlug;
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

// The snippet is pasted into someone else's HTML, so both the title (author
// text) and the URL (`&` between query parameters) must be attribute-safe.
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  embedSlug,
}: GameWorkbenchProps) {
  const [draft, setDraft] = useState<EditableGameDraft>(() => gameToDraft(defaultGame));
  const [game, setGame] = useState(defaultGame);
  const [shareExtras, setShareExtras] = useState(extras);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(structureSentence(structureFor(defaultGame)));
  const [paretoMode, setParetoMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [manualEmbedCopy, setManualEmbedCopy] = useState(false);
  const [annotation, setAnnotationText] = useState("");
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const manualCopyRef = useRef<HTMLInputElement>(null);
  const manualEmbedCopyRef = useRef<HTMLTextAreaElement>(null);
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
      setAnnotationText(decodeAnnotation(new URLSearchParams(initialSearch)) ?? "");
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
        setNotice(`${result.notice} The last valid analysis remains on screen.`);
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

  const shareSearch = useMemo(() => {
    const params = new URLSearchParams(encodeGameSearch({ game, extras: shareExtras }));
    return setAnnotation(params, annotation).toString();
  }, [annotation, game, shareExtras]);
  const shareUrl =
    typeof window === "undefined"
      ? `?${shareSearch}`
      : `${window.location.origin}${window.location.pathname}?${shareSearch}`;
  // The embed route runs the same client-side decode as every other surface,
  // so carrying `shareSearch` makes the framed copy show the edited game
  // rather than the catalog default.
  const embedUrl =
    embedSlug === undefined
      ? null
      : `${typeof window === "undefined" ? "" : window.location.origin}/embed/${embedSlug}/?${shareSearch}`;
  const embedSnippet =
    embedUrl === null
      ? null
      : `<iframe src="${escapeAttribute(embedUrl)}" width="640" height="720" title="${escapeAttribute(game.title)} — interactive game" loading="lazy" style="border:0;max-width:100%"></iframe>`;

  useEffect(() => {
    if (dirty) {
      window.history.replaceState(null, "", `${window.location.pathname}?${shareSearch}`);
    }
  }, [dirty, shareSearch]);

  useEffect(() => {
    if (manualCopy) {
      manualCopyRef.current?.focus();
      manualCopyRef.current?.select();
    }
  }, [manualCopy]);

  useEffect(() => {
    if (manualEmbedCopy) {
      manualEmbedCopyRef.current?.focus();
      manualEmbedCopyRef.current?.select();
    }
  }, [manualEmbedCopy]);

  const analysis = useMemo(() => analyzeMixedEquilibria(game), [game]);
  const equilibria = useMemo(() => new Set(pureNashEquilibria(game).map(profileKey)), [game]);
  const paretoEfficient = useMemo(
    () => new Set(paretoEfficientProfiles(game).map(profileKey)),
    [game],
  );

  const setDimension = (player: "row" | "column", event: ChangeEvent<HTMLSelectElement>) => {
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

  const copyToClipboard = async (
    text: string,
    onCopied: (copied: boolean) => void,
    onManual: (manual: boolean) => void,
  ) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      onCopied(true);
      onManual(false);
    } catch {
      onCopied(false);
      onManual(true);
    }
  };

  const copyLink = () => copyToClipboard(shareUrl, setCopied, setManualCopy);
  const copyEmbedSnippet = () =>
    embedSnippet === null
      ? undefined
      : copyToClipboard(embedSnippet, setEmbedCopied, setManualEmbedCopy);

  return (
    <section
      aria-labelledby={`${defaultGame.id}-workbench-title`}
      className={`game-workbench game-workbench--${variant}`}
      data-testid="game-workbench"
    >
      <header className="game-workbench__header">
        <div>
          <p className="eyebrow">
            {variant === "page" ? "Build / Live solver" : "Build / Edit this game"}
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
          Every valid edit is solved with exact fractions. The last valid game stays visible while
          an incomplete input is corrected.
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
        <p aria-live="assertive" className="game-workbench__notice" role="alert">
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
            Editable payoff matrix. Each cell contains your payoff first, then the rival&apos;s
            payoff.
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
                          updateAction(current, "column", column, event.target.value),
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
                    row < game.rowActions.length && column < game.columnActions.length;
                  const isEquilibrium = equilibria.has(profileKey(profile));
                  const isPareto = paretoEfficient.has(profileKey(profile));
                  const rowBestResponse =
                    isInAnalyzedGame && bestResponses(game, "row", column).includes(row);
                  const columnBestResponse =
                    isInAnalyzedGame && bestResponses(game, "column", row).includes(column);
                  const cell = draft.payoffs[row][column];

                  return (
                    <td
                      className={
                        paretoMode && !isPareto ? "game-workbench__cell--dominated" : undefined
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
                                updatePayoff(current, row, column, 0, event.target.value),
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
                                updatePayoff(current, row, column, 1, event.target.value),
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
        <h2 id={`${defaultGame.id}-verdict-title`}>{structureSentence(structureFor(game))}</h2>
        <p>
          {pureNashEquilibria(game).length} pure{" "}
          {pureNashEquilibria(game).length === 1 ? "equilibrium" : "equilibria"};{" "}
          {analysis.equilibria.length} exact equilibrium profile
          {analysis.equilibria.length === 1 ? "" : "s"} enumerated.
        </p>
        {analysis.degeneracyWitness ? (
          <p className="analysis-warning" role="status">
            Degeneracy detected. The engine shows verified equilibria without claiming that this
            sample describes every equilibrium component.
          </p>
        ) : null}
      </section>

      <section
        className="game-workbench__annotation"
        aria-labelledby={`${defaultGame.id}-annotation-title`}
      >
        <div>
          <p className="eyebrow">Annotation</p>
          <h2 id={`${defaultGame.id}-annotation-title`}>Carry one observation with the game.</h2>
          <p>
            A bounded plain-text note travels in <code>?a=</code>. It stays in the URL; nothing is
            stored or sent elsewhere.
          </p>
        </div>
        <label>
          <span className="sr-only">Game annotation</span>
          <textarea
            aria-describedby={annotationError ? `${defaultGame.id}-annotation-error` : undefined}
            onChange={(event) => {
              const next = event.target.value;
              try {
                setAnnotation(new URLSearchParams(), next);
                setAnnotationText(next);
                setAnnotationError(null);
                setDirty(true);
              } catch (error) {
                setAnnotationError(
                  error instanceof Error ? error.message : "Annotation is invalid.",
                );
              }
            }}
            placeholder="e.g. Is the threat credible after entry?"
            value={annotation}
          />
        </label>
        {annotationError ? (
          <p id={`${defaultGame.id}-annotation-error`} role="alert">
            {annotationError}
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

      <section aria-labelledby={`${defaultGame.id}-share-title`} className="game-workbench__share">
        <div>
          <p className="eyebrow">Reproduce</p>
          <h2 id={`${defaultGame.id}-share-title`}>Share the complete game state.</h2>
          <p>
            The link contains the labels, exact payoffs, and any supplied seed or simulation
            settings. Nothing is uploaded.
          </p>
        </div>
        <button className="analysis-button" onClick={copyLink} type="button">
          Copy reproducible link
        </button>
        {variant === "page" ? (
          <a className="analysis-button" href={`/quiz/?${shareSearch}`}>
            Quiz this game
          </a>
        ) : null}
        {/* Iterated play and the folk-theorem region are defined for binary actions only, so the
            link appears exactly when the game the user built can actually be played that way. */}
        {variant === "page" && game.rowActions.length === 2 && game.columnActions.length === 2 ? (
          <a className="analysis-button" href={`/repeat/?${shareSearch}`}>
            Play it iterated
          </a>
        ) : null}
        {copied ? (
          <p className="game-workbench__copied" role="status">
            Copied. The complete bounded state is in the link.
          </p>
        ) : null}
        {manualCopy ? (
          <label className="game-workbench__manual-copy">
            <span>Clipboard access is unavailable. Copy this link manually.</span>
            <input readOnly ref={manualCopyRef} value={shareUrl} />
          </label>
        ) : null}
        {embedSnippet !== null ? (
          <>
            <button className="analysis-button" onClick={copyEmbedSnippet} type="button">
              Copy embed snippet
            </button>
            {embedCopied ? (
              <p className="game-workbench__copied" role="status">
                Copied. Paste the iframe into any https: page.
              </p>
            ) : null}
            {manualEmbedCopy ? (
              <label className="game-workbench__manual-copy">
                <span>Clipboard access is unavailable. Copy this snippet manually.</span>
                <textarea readOnly ref={manualEmbedCopyRef} rows={3} value={embedSnippet} />
              </label>
            ) : null}
          </>
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
