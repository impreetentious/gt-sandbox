"use client";

import { useId, useMemo, useState } from "react";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import {
  isZeroSum,
  type NormalFormGame,
  type Player,
  type Profile,
} from "@/engine/game";
import {
  formatRational,
  multiply,
  rational,
  type Rational,
} from "@/engine/rational";
import { fixedActionHindsight, mixVersusNash } from "@/engine/session-stats";
import { classifyTwoByTwo } from "@/engine/solve/classify";
import {
  analyzeDominance,
  type EliminationStep,
} from "@/engine/solve/dominance";
import {
  analyzeMixedEquilibria,
  type MixedNashEquilibrium,
} from "@/engine/solve/mixed";
import { paretoEfficientProfiles } from "@/engine/solve/pareto";
import { bestResponses, pureNashEquilibria } from "@/engine/solve/pure";
import { analyzeEquilibriumSelection } from "@/engine/solve/riskDominance";

interface AnalysisDrawerProps {
  readonly game: NormalFormGame;
  readonly actionLabels?: {
    readonly row: readonly string[];
    readonly column: readonly string[];
  };
  readonly profiles: readonly Profile[];
  readonly player?: Player;
  readonly playerName: string;
  readonly opponentName: string;
  readonly title: string;
  readonly paretoMode: boolean;
  readonly onParetoModeChange: (enabled: boolean) => void;
  readonly defaultOpen?: boolean;
  readonly showAllPanels?: boolean;
}

function otherPlayer(player: Player): Player {
  return player === "row" ? "column" : "row";
}

function actionLabel(
  game: NormalFormGame,
  player: Player,
  action: number,
): string {
  return (player === "row" ? game.rowActions : game.columnActions)[action];
}

function profileLabel(game: NormalFormGame, profile: Profile): string {
  return `(${game.rowActions[profile.row]}, ${game.columnActions[profile.column]})`;
}

function decimal(value: Rational): string {
  return (Number(value.numerator) / Number(value.denominator)).toFixed(2);
}

function percent(value: Rational): number {
  return Math.min(
    100,
    Math.max(0, (Number(value.numerator) / Number(value.denominator)) * 100),
  );
}

function equilibriumPayoff(
  equilibrium: MixedNashEquilibrium,
  player: Player,
): Rational {
  return player === "row" ? equilibrium.rowPayoff : equilibrium.columnPayoff;
}

function BestResponsePanel({ game }: { readonly game: NormalFormGame }) {
  const titleId = useId();
  const renderResponses = (player: Player) => {
    const opponent = otherPlayer(player);
    const opponentActions =
      opponent === "row" ? game.rowActions : game.columnActions;

    return opponentActions.map((opponentAction, index) => {
      const responses = bestResponses(game, player, index).map((action) =>
        actionLabel(game, player, action),
      );

      return (
        <li key={`${player}-${opponentAction}`}>
          {player === "row" ? "Your" : "Their"} best response to{" "}
          {opponent === "row" ? "your" : "their"} {opponentAction} is{" "}
          <strong>{responses.join(" or ")}</strong>.
        </li>
      );
    });
  };

  return (
    <section aria-labelledby={titleId} className="analysis-panel">
      <h3 id={titleId}>
        <GlossaryTerm term="best-response" /> map
      </h3>
      <ul className="analysis-list">
        {renderResponses("row")}
        {renderResponses("column")}
      </ul>
    </section>
  );
}

function describeElimination(
  game: NormalFormGame,
  step: EliminationStep,
): string {
  const player = step.player === "row" ? "You" : "Your rival";
  const dominated = actionLabel(game, step.player, step.dominated);
  const dominator = actionLabel(game, step.player, step.dominator);

  return `${player}: ${dominator} eliminates ${dominated}.`;
}

function DominancePanel({ game }: { readonly game: NormalFormGame }) {
  const analysis = analyzeDominance(game);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const titleId = useId();
  const stepsId = useId();
  const trace = analysis.strictTrace;
  const nextStep = trace.steps[visibleSteps];

  return (
    <section aria-labelledby={titleId} className="analysis-panel">
      <h3 id={titleId}>
        <GlossaryTerm term="dominant-strategy" /> walkthrough
      </h3>
      {trace.steps.length === 0 ? (
        <p>No strict-dominance elimination applies to this game.</p>
      ) : (
        <>
          <p>
            Step through the engine&apos;s iterated elimination. Each step is
            discrete, so it is also the reduced-motion presentation.
          </p>
          <ol aria-live="polite" className="analysis-list" id={stepsId}>
            {trace.steps.slice(0, visibleSteps).map((step, index) => (
              <li key={`${step.player}-${step.dominated}`}>
                Step {index + 1}: {describeElimination(game, step)}
              </li>
            ))}
          </ol>
          {nextStep ? (
            <button
              aria-controls={stepsId}
              className="analysis-button"
              onClick={() => setVisibleSteps((count) => count + 1)}
              type="button"
            >
              Show elimination {visibleSteps + 1} of {trace.steps.length}
            </button>
          ) : (
            <p className="analysis-result" role="status">
              No dominated actions remain after these {trace.steps.length}{" "}
              eliminations.
            </p>
          )}
        </>
      )}
      {trace.steps.length === 0 && analysis.weakTrace.steps.length > 0 ? (
        <p className="analysis-caveat">
          Weak-dominance elimination can depend on the order of elimination;
          this drawer does not present it as a unique prediction.
        </p>
      ) : null}
    </section>
  );
}

function strategyLabel(
  game: NormalFormGame,
  player: Player,
  probabilities: readonly Rational[],
): string {
  return probabilities
    .map(
      (probability, action) =>
        `${actionLabel(game, player, action)} ${formatRational(probability)} (${decimal(probability)})`,
    )
    .join("; ");
}

function EquilibriaPanel({
  game,
  mixed,
}: {
  readonly game: NormalFormGame;
  readonly mixed: ReturnType<typeof analyzeMixedEquilibria>;
}) {
  const titleId = useId();
  const pure = pureNashEquilibria(game);
  const genuinelyMixed = mixed.equilibria.filter(
    (equilibrium) =>
      equilibrium.row.support.length > 1 ||
      equilibrium.column.support.length > 1,
  );

  return (
    <section aria-labelledby={titleId} className="analysis-panel">
      <h3 id={titleId}>
        <GlossaryTerm term="nash-equilibrium" />
      </h3>
      {mixed.degeneracyWitness ? (
        <p className="analysis-warning" role="status">
          This game is <GlossaryTerm term="degenerate" />. Tied best responses
          mean its equilibrium set needs a careful disclosure rather than a
          single tidy list.
        </p>
      ) : null}
      <p>
        Pure equilibria:{" "}
        {pure.length === 0
          ? "none"
          : pure.map((profile) => profileLabel(game, profile)).join(", ")}
        .
      </p>
      {genuinelyMixed.length === 0 ? (
        mixed.degeneracyWitness ? (
          <p>
            Equal-size support enumeration found no further mixed sample here. A
            degenerate game can still hold entire families of equilibria beyond
            the pure outcomes listed above.
          </p>
        ) : (
          <p>
            No additional mixed equilibrium is needed beyond those pure
            outcomes.
          </p>
        )
      ) : (
        <ul className="analysis-list">
          {genuinelyMixed.map((equilibrium, index) => (
            <li key={index}>
              <GlossaryTerm term="mixed-strategy" /> {index + 1}: you play{" "}
              {strategyLabel(game, "row", equilibrium.row.probabilities)}; your
              rival plays{" "}
              {strategyLabel(game, "column", equilibrium.column.probabilities)}.
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EfficiencyPanel({
  game,
  enabled,
  onChange,
}: {
  readonly game: NormalFormGame;
  readonly enabled: boolean;
  readonly onChange: (enabled: boolean) => void;
}) {
  const efficient = paretoEfficientProfiles(game);
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="analysis-panel">
      <h3 id={titleId}>
        <GlossaryTerm term="pareto-efficient" /> outcomes
      </h3>
      <p>
        Efficient cells:{" "}
        {efficient.map((profile) => profileLabel(game, profile)).join(", ")}.
      </p>
      <label className="analysis-toggle">
        <input
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        Dim dominated outcomes in the matrix
      </label>
    </section>
  );
}

function MixBars({
  game,
  player,
  empirical,
  nash,
}: {
  readonly game: NormalFormGame;
  readonly player: Player;
  readonly empirical: readonly Rational[];
  readonly nash: readonly Rational[];
}) {
  return (
    <div
      className="mix-bars"
      role="list"
      aria-label="Your empirical mix compared with Nash mix"
    >
      {empirical.map((probability, action) => (
        <div className="mix-bars__row" key={action} role="listitem">
          <strong>{actionLabel(game, player, action)}</strong>
          <span>
            Yours {formatRational(probability)} ({decimal(probability)})
          </span>
          <span className="mix-bars__track" aria-hidden="true">
            <span
              className="mix-bars__fill mix-bars__fill--actual"
              style={{ width: `${percent(probability)}%` }}
            />
          </span>
          <span>
            Nash {formatRational(nash[action])} ({decimal(nash[action])})
          </span>
          <span className="mix-bars__track" aria-hidden="true">
            <span
              className="mix-bars__fill mix-bars__fill--nash"
              style={{ width: `${percent(nash[action])}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

function YourPlayPanel({
  game,
  profiles,
  player,
  playerName,
  opponentName,
  equilibrium,
}: {
  readonly game: NormalFormGame;
  readonly profiles: readonly Profile[];
  readonly player: Player;
  readonly playerName: string;
  readonly opponentName: string;
  readonly equilibrium: MixedNashEquilibrium | undefined;
}) {
  const titleId = useId();

  if (!equilibrium || profiles.length === 0) {
    return null;
  }

  const hindsight = fixedActionHindsight(game, player, profiles);
  const comparison = mixVersusNash(game, player, profiles, equilibrium);
  const opponentComparison = mixVersusNash(
    game,
    otherPlayer(player),
    profiles,
    equilibrium,
  );
  const perRoundEquilibriumPayoff = equilibriumPayoff(equilibrium, player);
  const sessionEquilibriumPayoff = multiply(
    perRoundEquilibriumPayoff,
    rational(BigInt(profiles.length)),
  );
  const bestActionNames = hindsight.bestActions
    .map((action) => actionLabel(game, player, action))
    .join(" or ");

  return (
    <section aria-labelledby={titleId} className="analysis-panel">
      <h3 id={titleId}>Your play</h3>
      <p>
        Your realized payoff:{" "}
        <strong>{formatRational(hindsight.actualPayoff)}</strong>. The best
        fixed action against {opponentName}&apos;s realized sequence was{" "}
        <strong>{bestActionNames}</strong>, worth{" "}
        <strong>{formatRational(hindsight.bestFixedPayoff)}</strong>.
      </p>
      <p className="analysis-result">
        {hindsight.gain.numerator > 0n
          ? `One fixed action would have earned ${formatRational(hindsight.gain)} more.`
          : hindsight.gain.numerator === 0n
            ? "The best fixed action tied your realized payoff."
            : `Your adaptive sequence earned ${formatRational({ numerator: -hindsight.gain.numerator, denominator: hindsight.gain.denominator })} more than every fixed action.`}
      </p>
      <MixBars
        empirical={comparison.empirical.probabilities}
        game={game}
        nash={comparison.nash}
        player={player}
      />
      <p>
        The selected equilibrium pays{" "}
        {formatRational(perRoundEquilibriumPayoff)} per round, or{" "}
        {formatRational(sessionEquilibriumPayoff)} across this many rounds when
        both players use that equilibrium.
      </p>
      {!opponentComparison.matchesNash ? (
        <p className="analysis-caveat">
          {opponentName} did not play the equilibrium mix. Beating the
          equilibrium payoff can be rational when it is a best response to the
          opponent you actually faced.
        </p>
      ) : null}
      {comparison.matchesNash ? (
        <p className="analysis-result">
          {playerName}&apos;s empirical mix matched this equilibrium exactly.
        </p>
      ) : null}
    </section>
  );
}

function StructurePanel({ game }: { readonly game: NormalFormGame }) {
  const titleId = useId();

  if (game.rowActions.length !== 2 || game.columnActions.length !== 2) {
    return null;
  }

  const structure = classifyTwoByTwo(game);
  const selection = analyzeEquilibriumSelection(game);

  return (
    <section aria-labelledby={titleId} className="analysis-panel">
      <h3 id={titleId}>Structure</h3>
      <p>
        The engine classifies this 2×2 game as <strong>{structure}</strong>.
      </p>
      {isZeroSum(game) ? (
        <p>
          This is a <GlossaryTerm term="zero-sum" /> game: every gain for one
          player is a loss for the other.
        </p>
      ) : null}
      {selection.riskDominance.kind === "equilibrium" ? (
        <p>
          <GlossaryTerm term="risk-dominant" /> outcome:{" "}
          {profileLabel(game, selection.riskDominance.profile)}.
        </p>
      ) : null}
      {selection.payoffDominance.kind === "equilibrium" ? (
        <p>
          Payoff-dominant outcome:{" "}
          {profileLabel(game, selection.payoffDominance.profile)}.
        </p>
      ) : null}
      {selection.riskDominance.kind === "tie" ? (
        <p className="analysis-caveat">
          Risk dominance is tied here: theory is silent, so{" "}
          <GlossaryTerm term="focal-point" />s and commitment can decide.
        </p>
      ) : null}
    </section>
  );
}

/** Shared progressive-disclosure analysis for every normal-form game surface. */
export function AnalysisDrawer({
  game,
  actionLabels,
  profiles,
  player = "row",
  playerName,
  opponentName,
  title,
  paretoMode,
  onParetoModeChange,
  defaultOpen = false,
  showAllPanels = false,
}: AnalysisDrawerProps) {
  const displayGame: NormalFormGame = useMemo(
    () =>
      actionLabels
        ? {
            ...game,
            rowActions: actionLabels.row,
            columnActions: actionLabels.column,
          }
        : game,
    [game, actionLabels],
  );
  const mixed = useMemo(
    () => analyzeMixedEquilibria(displayGame),
    [displayGame],
  );

  return (
    <details className="analysis-drawer" open={defaultOpen || undefined}>
      <summary>Analysis / {title}</summary>
      <div className="analysis-drawer__content">
        {profiles.length === 0 ? (
          <p>Play one round to connect the matrix to an outcome.</p>
        ) : (
          <p>
            What just happened: this outcome came from the same incentives shown
            in the matrix, not a scripted verdict.
          </p>
        )}
        {showAllPanels || profiles.length >= 3 ? (
          <div className="analysis-drawer__panels">
            <BestResponsePanel game={displayGame} />
            <DominancePanel game={displayGame} />
            <EquilibriaPanel game={displayGame} mixed={mixed} />
            <EfficiencyPanel
              enabled={paretoMode}
              game={displayGame}
              onChange={onParetoModeChange}
            />
            <YourPlayPanel
              equilibrium={mixed.equilibria[0]}
              game={displayGame}
              opponentName={opponentName}
              player={player}
              playerName={playerName}
              profiles={profiles}
            />
            <StructurePanel game={displayGame} />
          </div>
        ) : profiles.length > 0 ? (
          <p className="analysis-caveat">
            Full analysis unlocks after round 3, once there is a small pattern
            to inspect.
          </p>
        ) : null}
      </div>
    </details>
  );
}
