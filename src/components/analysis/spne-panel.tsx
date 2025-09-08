"use client";

import { useMemo, useState } from "react";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import type { ExtensiveOracle } from "@/engine/catalog/extensive";
import {
  backwardInduction,
  inductionTrace,
  verifySubgamePerfect,
  type ExtensiveGame,
  type InductionStep,
} from "@/engine/extensive";
import { formatRational } from "@/engine/rational";

interface Props {
  readonly game: ExtensiveGame;
  readonly oracle: ExtensiveOracle;
  readonly reveal: {
    readonly headline: string;
    readonly credibleThreat: string;
    readonly whyItMatters: string;
  };
}

function describeStep(step: InductionStep, players: readonly string[]): string {
  const playerIndex = players.indexOf(step.player);
  const alternatives = Array.from(step.childPayoffs.values())
    .map((payoffs) => formatRational(payoffs[playerIndex]))
    .join(" / ");
  return `${step.player} at ${step.nodeId}: chooses ${step.chosenAction} (payoffs by action: ${alternatives}).`;
}

export function SPNEPanel({ game, oracle, reveal }: Props) {
  const spne = useMemo(() => backwardInduction(game), [game]);
  const trace = useMemo(() => inductionTrace(game), [game]);
  const [visibleSteps, setVisibleSteps] = useState(0);

  const verifierResult = useMemo(
    () => verifySubgamePerfect(game, spne.strategy),
    [game, spne.strategy],
  );

  const nonSpVerdicts = useMemo(
    () =>
      oracle.nonSubgamePerfectNash.map((entry) => ({
        label: entry.label,
        payoffs: entry.payoffs,
        verdict: verifySubgamePerfect(game, entry.strategy),
      })),
    [game, oracle.nonSubgamePerfectNash],
  );

  const canShowMore = visibleSteps < trace.length;
  const allShown = visibleSteps === trace.length;
  const stepLabelForButton =
    visibleSteps < trace.length
      ? `Show step ${visibleSteps + 1} of ${trace.length}`
      : "Restart trace";

  return (
    <div className="spne-panel">
      <p className="spne-panel__headline">{reveal.headline}</p>

      <section aria-labelledby="spne-outcome-title">
        <h3 id="spne-outcome-title">
          <GlossaryTerm term="subgame-perfect-equilibrium" /> outcome
        </h3>
        <p>
          Backward induction produces the strategy{" "}
          <strong>{oracle.spne.label}</strong>. On-path payoffs:{" "}
          <em>
            ({spne.payoffs.map((value) => formatRational(value)).join(", ")})
          </em>
          . An independent verifier{" "}
          {verifierResult.isSubgamePerfect ? "confirms" : "would flag"} this as
          subgame-perfect.
        </p>
      </section>

      <section aria-labelledby="spne-trace-title" className="spne-panel__trace">
        <h3 id="spne-trace-title">
          <GlossaryTerm term="backward-induction" /> stepper
        </h3>
        <p>
          Solve every subgame first, working back to the root. Each step below
          is one deciding player at one decision node.
        </p>
        <ol>
          {trace.slice(0, visibleSteps).map((step) => (
            <li key={step.nodeId}>{describeStep(step, game.players)}</li>
          ))}
        </ol>
        <div className="spne-panel__stepper">
          <button
            onClick={() =>
              setVisibleSteps((count) => (canShowMore ? count + 1 : 0))
            }
            type="button"
          >
            {stepLabelForButton}
          </button>
          {allShown ? (
            <p className="spne-panel__stepper-note">
              All {trace.length} induction steps shown.
            </p>
          ) : null}
        </div>
      </section>

      {nonSpVerdicts.length > 0 ? (
        <section
          aria-labelledby="spne-non-sp-title"
          className="spne-panel__non-sp"
        >
          <h3 id="spne-non-sp-title">Nash but not subgame-perfect</h3>
          <p>{reveal.credibleThreat}</p>
          <ul>
            {nonSpVerdicts.map((entry) => (
              <li key={entry.label}>
                <strong>{entry.label}.</strong> Payoffs (
                {entry.payoffs.join(", ")}). Verifier:{" "}
                {entry.verdict.isSubgamePerfect ? (
                  <span>marked subgame-perfect (unexpected)</span>
                ) : (
                  <span>
                    not subgame-perfect — a strictly better action exists at{" "}
                    <code>{entry.verdict.violation?.nodeId}</code> for{" "}
                    {entry.verdict.violation?.player}.
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section
          aria-labelledby="spne-non-sp-title"
          className="spne-panel__non-sp"
        >
          <h3 id="spne-non-sp-title">Where the theory strains</h3>
          <p>{reveal.credibleThreat}</p>
        </section>
      )}

      <section aria-labelledby="spne-why-title">
        <h3 id="spne-why-title">Why the distinction matters</h3>
        <p>
          A <GlossaryTerm term="credible-threat" /> would survive subgame
          perfection; this one does not.
        </p>
        <p>{reveal.whyItMatters}</p>
      </section>
    </div>
  );
}
