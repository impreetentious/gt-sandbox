"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import {
  customRepeatFraming,
  repeatableGameContent,
  type CooperativeProfile,
  type RepeatableSlug,
} from "@/content/repeated";
import { catalogBySlug } from "@/engine/catalog";
import type { NormalFormGame } from "@/engine/game";
import { formatRational, type Rational } from "@/engine/rational";
import {
  analyzeFolkTheorem,
  type DeltaThreshold,
  type PayoffPoint,
} from "@/engine/repeated/folk-theorem";
import { simulateIteratedMatch } from "@/engine/repeated/iterated-game";
import { ipdStrategies, type IpdStrategyId } from "@/engine/repeated/strategies";
import { decodeGameSearch } from "@/state/game-url";

const REPEATABLE_SLUGS: readonly RepeatableSlug[] = ["pd", "stag", "chicken", "bos", "pennies"];

const CUSTOM_STAGE = "custom" as const;
type StageChoice = RepeatableSlug | typeof CUSTOM_STAGE;

type CustomStage =
  | { readonly kind: "none" }
  | { readonly kind: "game"; readonly game: NormalFormGame }
  | { readonly kind: "rejected"; readonly notice: string };

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function locationSnapshot() {
  return window.location.search;
}

/**
 * A Build-mode game arriving on the share link. Iterated play and the folk-theorem analysis are
 * defined for binary actions only, so a 3×3 custom is refused with a reason rather than being
 * silently truncated to its first two rows — a quietly cropped payoff matrix would produce an
 * exact-looking threshold for a game the user never built.
 */
function customStageFromSearch(search: string): CustomStage {
  const decoded = decodeGameSearch(search);
  if (decoded.kind === "empty") return { kind: "none" };
  if (decoded.kind === "invalid") return { kind: "rejected", notice: decoded.notice };

  const game = decoded.state.game;
  if (game.rowActions.length !== 2 || game.columnActions.length !== 2) {
    return {
      kind: "rejected",
      notice: `Repeated play and the folk-theorem region are defined for 2×2 stage games. “${game.title}” is ${game.rowActions.length}×${game.columnActions.length}, so a catalog game was loaded instead.`,
    };
  }
  return { kind: "game", game };
}

const SLUG_LABEL: Record<RepeatableSlug, string> = {
  pd: "Prisoner's Dilemma",
  stag: "Stag Hunt",
  chicken: "Chicken",
  bos: "Battle of the Sexes",
  pennies: "Matching Pennies",
};

function toNumber(value: Rational): number {
  return Number(value.numerator) / Number(value.denominator);
}

function describeThreshold(threshold: DeltaThreshold): string {
  switch (threshold.kind) {
    case "always":
      return "The cooperative outcome is already a stage equilibrium, so it is sustainable at any discount factor.";
    case "never":
      return `Cooperation cannot be sustained here. ${threshold.reason}`;
    case "threshold":
      return `Grim-trigger cooperation is a subgame-perfect equilibrium exactly when the continuation probability is at least ${formatRational(threshold.value)} (${toNumber(threshold.value).toFixed(3)}).`;
  }
}

function sustainedAtDelta(threshold: DeltaThreshold, delta: number): boolean | null {
  switch (threshold.kind) {
    case "always":
      return true;
    case "never":
      return false;
    case "threshold":
      return delta >= toNumber(threshold.value);
  }
}

export function RepeatedGameExperience() {
  const search = useSyncExternalStore(subscribeToLocation, locationSnapshot, () => "");
  const custom = useMemo(() => customStageFromSearch(search), [search]);
  const customGame = custom.kind === "game" ? custom.game : null;

  const [stageOverride, setStageOverride] = useState<StageChoice>();
  const [customCooperate, setCustomCooperate] = useState<CooperativeProfile>({ row: 0, column: 0 });
  const [rowStrategy, setRowStrategy] = useState<IpdStrategyId>("tft");
  const [columnStrategy, setColumnStrategy] = useState<IpdStrategyId>("tft");
  const [delta, setDelta] = useState(0.95);
  const [noise, setNoise] = useState(0);
  const [seed, setSeed] = useState(406029);

  // A shared game opens on itself; the catalog stays one select away.
  const defaultStage: StageChoice = customGame ? CUSTOM_STAGE : "pd";
  const requested = stageOverride ?? defaultStage;
  const stage: StageChoice = requested === CUSTOM_STAGE && !customGame ? "pd" : requested;
  const isCustom = stage === CUSTOM_STAGE && customGame !== null;

  const content =
    isCustom && customGame
      ? customRepeatFraming(customGame, customCooperate)
      : repeatableGameContent[stage === CUSTOM_STAGE ? "pd" : stage];
  const game =
    isCustom && customGame ? customGame : catalogBySlug[stage === CUSTOM_STAGE ? "pd" : stage].game;
  const matchId = isCustom ? `${game.id}-custom-repeat` : `${stage}-repeat`;

  const folk = useMemo(
    () => analyzeFolkTheorem(game, { cooperate: content.cooperate }),
    [game, content.cooperate],
  );

  const match = useMemo(
    () =>
      simulateIteratedMatch({
        game,
        cooperate: content.cooperate,
        rowStrategy,
        columnStrategy,
        masterSeed: seed,
        matchId,
        continuationProbability: delta,
        noise,
        roundCap: 1000,
      }),
    [game, content.cooperate, rowStrategy, columnStrategy, seed, delta, noise, matchId],
  );

  const sustained = sustainedAtDelta(folk.threshold, delta);

  // Presentation-only pixel mapping for the payoff-space diagram.
  const points = folk.feasibleHull;
  const allX = points.map((point) => toNumber(point.row));
  const allY = points.map((point) => toNumber(point.column));
  const minX = Math.min(...allX, toNumber(folk.rowMinimax));
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY, toNumber(folk.columnMinimax));
  const maxY = Math.max(...allY);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const px = (value: number) => 6 + ((value - minX) / spanX) * 88;
  const py = (value: number) => 94 - ((value - minY) / spanY) * 88;

  const outcomeCells = game.rowActions.flatMap((rowLabel, row) =>
    game.columnActions.map((columnLabel, column) => ({
      rowLabel,
      columnLabel,
      point: {
        row: game.payoffs[row][column][0],
        column: game.payoffs[row][column][1],
      } as PayoffPoint,
      isCooperative: row === content.cooperate.row && column === content.cooperate.column,
    })),
  );

  const strategyName = (id: IpdStrategyId) =>
    ipdStrategies.find((strategy) => strategy.id === id)?.name ?? id;

  return (
    <section aria-labelledby="repeat-title" className="repeat">
      <header className="repeat__header">
        <p className="eyebrow">Repeat / The shadow of the future</p>
        <h1 className="display" id="repeat-title">
          Iterate any 2×2.
        </h1>
        <p className="lede">{content.framing}</p>
        {custom.kind === "rejected" ? (
          <p className="repeat__caveat" role="status">
            {custom.notice}
          </p>
        ) : null}
      </header>

      <form
        aria-label="Repeated game configuration"
        className="repeat__controls"
        onSubmit={(event) => event.preventDefault()}
      >
        <label>
          <span>Stage game</span>
          <select
            onChange={(event) => setStageOverride(event.target.value as StageChoice)}
            value={stage}
          >
            {customGame ? <option value={CUSTOM_STAGE}>{customGame.title} (yours)</option> : null}
            {REPEATABLE_SLUGS.map((option) => (
              <option key={option} value={option}>
                {SLUG_LABEL[option]}
              </option>
            ))}
          </select>
        </label>
        {isCustom && customGame ? (
          <>
            <label>
              <span>Row&apos;s cooperative action</span>
              <select
                onChange={(event) =>
                  setCustomCooperate((current) => ({
                    ...current,
                    row: Number(event.target.value) === 1 ? 1 : 0,
                  }))
                }
                value={customCooperate.row}
              >
                {customGame.rowActions.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Column&apos;s cooperative action</span>
              <select
                onChange={(event) =>
                  setCustomCooperate((current) => ({
                    ...current,
                    column: Number(event.target.value) === 1 ? 1 : 0,
                  }))
                }
                value={customCooperate.column}
              >
                {customGame.columnActions.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <label>
          <span>Row strategy</span>
          <select
            onChange={(event) => setRowStrategy(event.target.value as IpdStrategyId)}
            value={rowStrategy}
          >
            {ipdStrategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Column strategy</span>
          <select
            onChange={(event) => setColumnStrategy(event.target.value as IpdStrategyId)}
            value={columnStrategy}
          >
            {ipdStrategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            <GlossaryTerm term="continuation-probability" /> δ = {delta.toFixed(3)}
          </span>
          <input
            max={0.995}
            min={0.5}
            onChange={(event) => setDelta(Number(event.target.value))}
            step={0.005}
            type="range"
            value={delta}
          />
        </label>
        <label>
          <span>Action noise ε = {noise.toFixed(3)}</span>
          <input
            max={0.1}
            min={0}
            onChange={(event) => setNoise(Number(event.target.value))}
            step={0.005}
            type="range"
            value={noise}
          />
        </label>
        <label>
          <span>Seed</span>
          <input
            min={0}
            onChange={(event) => setSeed(Math.max(0, Math.floor(Number(event.target.value)) || 0))}
            type="number"
            value={seed}
          />
        </label>
      </form>

      <div className="repeat__layout">
        <section aria-labelledby="repeat-folk-title" className="repeat__folk">
          <h2 id="repeat-folk-title">
            Feasible and <GlossaryTerm term="individually-rational" /> payoffs
          </h2>
          <svg
            aria-hidden="true"
            className="repeat__diagram"
            viewBox="0 0 100 100"
            role="presentation"
          >
            <line className="repeat__axis" x1="6" x2="6" y1="6" y2="94" />
            <line className="repeat__axis" x1="6" x2="94" y1="94" y2="94" />
            <line
              className="repeat__minimax"
              x1={px(toNumber(folk.rowMinimax))}
              x2={px(toNumber(folk.rowMinimax))}
              y1="6"
              y2="94"
            />
            <line
              className="repeat__minimax"
              x1="6"
              x2="94"
              y1={py(toNumber(folk.columnMinimax))}
              y2={py(toNumber(folk.columnMinimax))}
            />
            {points.length >= 3 ? (
              <polygon
                className="repeat__hull"
                points={points
                  .map((point) => `${px(toNumber(point.row))},${py(toNumber(point.column))}`)
                  .join(" ")}
              />
            ) : null}
            {outcomeCells.map((cell) => (
              <circle
                className={
                  cell.isCooperative ? "repeat__point repeat__point--cooperative" : "repeat__point"
                }
                cx={px(toNumber(cell.point.row))}
                cy={py(toNumber(cell.point.column))}
                key={`${cell.rowLabel}-${cell.columnLabel}`}
                r={cell.isCooperative ? 2.4 : 1.6}
              />
            ))}
          </svg>

          <table className="repeat__table">
            <caption>
              Exact payoffs for each outcome, with each player&apos;s minimax (security) value. The
              individually-rational region is every feasible payoff at or above both minimax values.
            </caption>
            <thead>
              <tr>
                <th scope="col">Outcome</th>
                <th scope="col">Row payoff</th>
                <th scope="col">Column payoff</th>
              </tr>
            </thead>
            <tbody>
              {outcomeCells.map((cell) => (
                <tr
                  data-cooperative={cell.isCooperative || undefined}
                  key={`${cell.rowLabel}-${cell.columnLabel}`}
                >
                  <th scope="row">
                    ({cell.rowLabel}, {cell.columnLabel})
                    {cell.isCooperative ? " — cooperative" : ""}
                  </th>
                  <td>{formatRational(cell.point.row)}</td>
                  <td>{formatRational(cell.point.column)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Minimax (security) value</th>
                <td>{formatRational(folk.rowMinimax)}</td>
                <td>{formatRational(folk.columnMinimax)}</td>
              </tr>
            </tbody>
          </table>

          <p className="repeat__threshold" role="status">
            {describeThreshold(folk.threshold)}
          </p>
          {!folk.cooperativeIsIndividuallyRational ? (
            <p className="repeat__caveat">
              The chosen cooperative outcome is not individually rational — at least one player can
              guarantee more by playing defensively.
            </p>
          ) : null}
          {content.caveat ? <p className="repeat__caveat">{content.caveat}</p> : null}
          {sustained !== null ? (
            <p className="repeat__verdict" data-sustained={sustained ? "yes" : "no"}>
              At your chosen δ = {delta.toFixed(3)}, cooperation is{" "}
              <strong>{sustained ? "sustainable" : "not sustainable"}</strong> as a grim-trigger
              equilibrium.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="repeat-match-title" className="repeat__match">
          <h2 id="repeat-match-title">
            {strategyName(rowStrategy)} vs {strategyName(columnStrategy)}
          </h2>
          <dl className="repeat__summary">
            <div>
              <dt>Rounds</dt>
              <dd>
                {match.rounds}
                {match.truncatedAtCap ? " (capped)" : ""}
              </dd>
            </div>
            <div>
              <dt>Row total</dt>
              <dd>{formatRational(match.rowTotal)}</dd>
            </div>
            <div>
              <dt>Column total</dt>
              <dd>{formatRational(match.columnTotal)}</dd>
            </div>
            <div>
              <dt>Mutual cooperation</dt>
              <dd>
                {formatRational(match.mutualCooperationRate)} (
                {(toNumber(match.mutualCooperationRate) * 100).toFixed(0)}%)
              </dd>
            </div>
          </dl>
          <p className="repeat__strip-label">
            First {Math.min(match.history.length, 24)} rounds (C = cooperate, D = defect):
          </p>
          <ol aria-label="Round-by-round realized play" className="repeat__strip">
            {match.history.slice(0, 24).map((round) => (
              <li key={round.number}>
                <span aria-hidden="true">
                  {round.rowSymbol}
                  {round.columnSymbol}
                </span>
                <span className="sr-only">
                  Round {round.number}: row {round.rowSymbol}, column {round.columnSymbol}.
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
