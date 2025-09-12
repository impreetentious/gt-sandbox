"use client";

import { useMemo, useState } from "react";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import { zdContent } from "@/content/zd";
import {
  classifyZd,
  extortionateStrategy,
  generousStrategy,
  relationResidual,
  stationaryOutcome,
  ALWAYS_DEFECT,
  CANONICAL_PD,
  TIT_FOR_TAT,
  type MemoryOneStrategy,
} from "@/engine/zd";
import { equals, formatRational, rational } from "@/engine/rational";

const CHI_DENOMINATOR = 10n;
const STATE_LABELS = [
  "after both cooperated",
  "after you cooperated, they defected",
  "after you defected, they cooperated",
  "after both defected",
] as const;

/**
 * A fixed, deliberately unremarkable opponent. Every probability is strictly
 * inside (0, 1) so the four-state chain is ergodic and the long-run payoffs are
 * well defined — the point being that the enforced relation holds against this
 * opponent without the opponent having agreed to anything.
 */
const HOUSE_OPPONENT: MemoryOneStrategy = [
  rational(9n, 12n),
  rational(3n, 12n),
  rational(7n, 12n),
  rational(2n, 12n),
];

export function ZeroDeterminantDemo() {
  const [family, setFamily] = useState<"extortionate" | "generous">(
    "extortionate",
  );
  const [chiStep, setChiStep] = useState(20);

  const chi = rational(BigInt(chiStep), CHI_DENOMINATOR);

  const construction = useMemo(
    () =>
      family === "extortionate"
        ? extortionateStrategy(CANONICAL_PD, chi)
        : generousStrategy(CANONICAL_PD, chi),
    [chi, family],
  );

  const outcome = useMemo(
    () =>
      construction.kind === "feasible"
        ? stationaryOutcome(CANONICAL_PD, construction.strategy, HOUSE_OPPONENT)
        : null,
    [construction],
  );

  const isTitForTat =
    construction.kind === "feasible" &&
    construction.strategy.every((value, index) =>
      equals(value, TIT_FOR_TAT[index]),
    );

  const allDefectVerdict = classifyZd(CANONICAL_PD, ALWAYS_DEFECT);

  return (
    <div className="zd-demo">
      <div className="zd-demo__controls">
        <div className="zd-demo__control">
          <label htmlFor="zd-family">Family</label>
          <select
            id="zd-family"
            onChange={(event) => setFamily(event.target.value as typeof family)}
            value={family}
          >
            <option value="extortionate">
              Extortionate — baseline is mutual defection
            </option>
            <option value="generous">
              Generous — baseline is mutual cooperation
            </option>
          </select>
        </div>

        <div className="zd-demo__control">
          <label htmlFor="zd-chi">
            Factor χ<output htmlFor="zd-chi">{formatRational(chi)}</output>
          </label>
          <input
            id="zd-chi"
            max={60}
            min={10}
            onChange={(event) => setChiStep(Number(event.target.value))}
            step={1}
            type="range"
            value={chiStep}
          />
          <p className="zd-demo__note">
            {family === "extortionate"
              ? "Every point the opponent earns above mutual defection hands you χ points above it."
              : "Every point the opponent falls short of mutual cooperation, you fall short by χ — you absorb more of the loss than you cause."}
          </p>
        </div>
      </div>

      {construction.kind === "infeasible" ? (
        <p className="zd-demo__infeasible" data-testid="zd-infeasible">
          {construction.witness}
        </p>
      ) : (
        <>
          <table className="zd-demo__strategy" data-testid="zd-strategy">
            <caption>
              The resulting memory-one strategy: probability of cooperating in
              each of the four situations, at the largest admissible scale
              factor φ = {formatRational(construction.phi.max)}.
            </caption>
            <thead>
              <tr>
                <th scope="col">Situation</th>
                <th scope="col">Cooperate with probability</th>
              </tr>
            </thead>
            <tbody>
              {construction.strategy.map((value, index) => (
                <tr key={STATE_LABELS[index]}>
                  <th scope="row">{STATE_LABELS[index]}</th>
                  <td>{formatRational(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {isTitForTat ? (
            <p className="zd-demo__callout" data-testid="zd-tft">
              <strong>That is Tit for Tat, exactly.</strong>{" "}
              {zdContent.titForTat}
            </p>
          ) : null}

          <p className="zd-demo__relation" data-testid="zd-relation">
            Enforced relation:{" "}
            <code>
              {formatRational(construction.relation.alpha)}·sX +{" "}
              {formatRational(construction.relation.beta)}·sY +{" "}
              {formatRational(construction.relation.gamma)} = 0
            </code>
          </p>

          {outcome ? (
            <table className="zd-demo__outcome" data-testid="zd-outcome">
              <caption>
                Exact long-run payoffs against a fixed memory-one opponent that
                never agreed to any of this.
              </caption>
              <tbody>
                <tr>
                  <th scope="row">Your average payoff sX</th>
                  <td>{formatRational(outcome.ownPayoff)}</td>
                </tr>
                <tr>
                  <th scope="row">Their average payoff sY</th>
                  <td>{formatRational(outcome.opponentPayoff)}</td>
                </tr>
                <tr>
                  <th scope="row">Residual of the relation</th>
                  <td data-testid="zd-residual">
                    {formatRational(
                      relationResidual(construction.relation, outcome),
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : null}
        </>
      )}

      <details className="zd-demo__honesty">
        <summary>What Always Defect is not</summary>
        <p>{zdContent.allDefect}</p>
        {allDefectVerdict.kind === "not-zero-determinant" ? (
          <p data-testid="zd-alld">{allDefectVerdict.witness}</p>
        ) : null}
      </details>

      <p className="zd-demo__note">
        The payoffs above come from solving the four-state chain directly, with
        no reference to the determinant identity that produced the strategy — so
        a residual of exactly 0 is a check on the construction, not a
        restatement of it. See <GlossaryTerm term="zero-determinant-strategy" />
        .
      </p>
    </div>
  );
}
