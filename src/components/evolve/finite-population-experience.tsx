"use client";

import { useMemo, useState } from "react";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import {
  finitePopulationContent,
  finitePopulationPresets,
} from "@/content/finite-population";
import { classifyESS } from "@/engine/ess";
import {
  classifySelection,
  createMoranConfig,
  fixationCurve,
} from "@/engine/moran";
import {
  compare,
  formatRational,
  multiply,
  rational,
  subtract,
  type Rational,
} from "@/engine/rational";

const SELECTION_DENOMINATOR = 20n;

/** Approximates a rational for plotting only; every displayed number stays exact. */
function toPlotNumber(value: Rational): number {
  return Number(value.numerator) / Number(value.denominator);
}

function percentLabel(value: Rational): string {
  const scaled = multiply(value, rational(100n));
  const whole = scaled.numerator / scaled.denominator;
  const remainder =
    Number(scaled.numerator - whole * scaled.denominator) /
    Number(scaled.denominator);
  return `${(Number(whole) + remainder).toFixed(1)}%`;
}

export function FinitePopulationExperience() {
  const [presetId, setPresetId] = useState(finitePopulationPresets[1].id);
  const [populationSize, setPopulationSize] = useState(20);
  const [selectionStep, setSelectionStep] = useState(2); // 2/20 = 0.1

  const preset =
    finitePopulationPresets.find((option) => option.id === presetId) ??
    finitePopulationPresets[0];

  const config = useMemo(
    () =>
      createMoranConfig({
        populationSize,
        payoffs: preset.payoffs,
        selectionIntensity: rational(
          BigInt(selectionStep),
          SELECTION_DENOMINATOR,
        ),
      }),
    [populationSize, preset.payoffs, selectionStep],
  );

  const selection = useMemo(() => classifySelection(config), [config]);
  const ess = useMemo(() => classifyESS(preset.payoffs), [preset.payoffs]);
  const curve = useMemo(() => fixationCurve(config), [config]);

  const selectionLabel = formatRational(
    rational(BigInt(selectionStep), SELECTION_DENOMINATOR),
  );

  // ESS says stable-or-not; the 1/N rule says favoured-or-not. Where a pure
  // strategy is an ESS yet still invadable in this population, say so out loud.
  const disagreement =
    (ess.a.isESS && selection.favoursB) || (ess.b.isESS && selection.favoursA);

  const plotWidth = 320;
  const plotHeight = 180;
  const plotX = (state: number) =>
    12 + (state / populationSize) * (plotWidth - 24);
  const plotY = (value: number) => plotHeight - 20 - value * (plotHeight - 36);

  const curvePath = curve
    .map(
      (row, index) =>
        `${index === 0 ? "M" : "L"} ${plotX(row.state).toFixed(2)} ${plotY(
          toPlotNumber(row.fixation),
        ).toFixed(2)}`,
    )
    .join(" ");
  const neutralPath = curve
    .map(
      (row, index) =>
        `${index === 0 ? "M" : "L"} ${plotX(row.state).toFixed(2)} ${plotY(
          row.state / populationSize,
        ).toFixed(2)}`,
    )
    .join(" ");

  return (
    <div
      aria-labelledby="finite-tab"
      className="finite-population"
      data-population={populationSize}
      data-preset={preset.id}
      id="finite-panel"
      role="tabpanel"
    >
      <section aria-labelledby="finite-intro-title" className="finite__intro">
        <h2 id="finite-intro-title">Luck decides more often than fitness</h2>
        <p>{finitePopulationContent.framing}</p>
        <p>{finitePopulationContent.fixationExplainer}</p>
      </section>

      <div className="finite__layout">
        <section
          aria-labelledby="finite-controls-title"
          className="finite__controls"
        >
          <h3 id="finite-controls-title">The contest</h3>

          <div className="finite__control">
            <label htmlFor="finite-preset">Game</label>
            <select
              id="finite-preset"
              onChange={(event) => setPresetId(event.target.value)}
              value={presetId}
            >
              {finitePopulationPresets.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="finite__control-note">{preset.description}</p>
          </div>

          <div className="finite__control">
            <label htmlFor="finite-size">
              Population size N
              <output htmlFor="finite-size">{populationSize}</output>
            </label>
            <input
              id="finite-size"
              max={60}
              min={2}
              onChange={(event) =>
                setPopulationSize(Number(event.target.value))
              }
              step={1}
              type="range"
              value={populationSize}
            />
          </div>

          <div className="finite__control">
            <label htmlFor="finite-selection">
              Selection intensity w
              <output htmlFor="finite-selection">{selectionLabel}</output>
            </label>
            <input
              id="finite-selection"
              max={20}
              min={1}
              onChange={(event) => setSelectionStep(Number(event.target.value))}
              step={1}
              type="range"
              value={selectionStep}
            />
            <p className="finite__control-note">
              Fitness is 1 − w + w·π, so a small w is near-neutral drift and w =
              1 makes fitness the raw payoff.
            </p>
          </div>

          <table className="finite__matrix">
            <caption>Payoff to the row strategy, in exact rationals.</caption>
            <thead>
              <tr>
                <th scope="col">Strategy</th>
                <th scope="col">vs {preset.strategyA}</th>
                <th scope="col">vs {preset.strategyB}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{preset.strategyA}</th>
                <td>{formatRational(preset.payoffs.a)}</td>
                <td>{formatRational(preset.payoffs.b)}</td>
              </tr>
              <tr>
                <th scope="row">{preset.strategyB}</th>
                <td>{formatRational(preset.payoffs.c)}</td>
                <td>{formatRational(preset.payoffs.d)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section
          aria-labelledby="finite-results-title"
          className="finite__results"
        >
          <h3 id="finite-results-title">Fixation from a single mutant</h3>

          <table className="finite__fixation" data-testid="finite-fixation">
            <caption>
              Exact probability that one mutant takes over the whole population,
              against the neutral benchmark 1/{populationSize}.
            </caption>
            <thead>
              <tr>
                <th scope="col">Mutant</th>
                <th scope="col">Fixation probability</th>
                <th scope="col">Approx.</th>
                <th scope="col">Favoured?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{preset.strategyA}</th>
                <td className="finite__exact">
                  {formatRational(selection.fixationA)}
                </td>
                <td>{percentLabel(selection.fixationA)}</td>
                <td>{selection.favoursA ? "Yes" : "No"}</td>
              </tr>
              <tr>
                <th scope="row">{preset.strategyB}</th>
                <td className="finite__exact">
                  {formatRational(selection.fixationB)}
                </td>
                <td>{percentLabel(selection.fixationB)}</td>
                <td>{selection.favoursB ? "Yes" : "No"}</td>
              </tr>
              <tr>
                <th scope="row">Neutral drift</th>
                <td className="finite__exact">
                  {formatRational(selection.neutral)}
                </td>
                <td>{percentLabel(selection.neutral)}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
          <p className="finite__rule">{finitePopulationContent.neutralRule}</p>

          <figure className="finite__figure">
            <svg
              aria-label={`Fixation probability for ${preset.strategyA} against the number of ${preset.strategyA} individuals already present, with the neutral drift line for comparison.`}
              className="finite__plot"
              role="img"
              viewBox={`0 0 ${plotWidth} ${plotHeight}`}
            >
              <line
                className="finite__axis"
                x1={12}
                x2={plotWidth - 12}
                y1={plotHeight - 20}
                y2={plotHeight - 20}
              />
              <line
                className="finite__axis"
                x1={12}
                x2={12}
                y1={16}
                y2={plotHeight - 20}
              />
              <path className="finite__neutral-line" d={neutralPath} />
              <path className="finite__curve" d={curvePath} />
            </svg>
            <figcaption>
              Solid: fixation probability for {preset.strategyA} from each
              starting count. Dashed: the neutral drift line i/N. Curving above
              it means selection is helping.
            </figcaption>
          </figure>

          <details className="finite__table-fallback">
            <summary>
              View the fixation curve as an accessible data table
            </summary>
            <div className="finite__table-scroll" tabIndex={0}>
              <table>
                <caption>
                  Exact fixation probability for {preset.strategyA} from every
                  starting count.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{preset.strategyA} present</th>
                    <th scope="col">Fixation probability</th>
                  </tr>
                </thead>
                <tbody>
                  {curve.map((row) => (
                    <tr key={row.state}>
                      <th scope="row">{row.state}</th>
                      <td>{formatRational(row.fixation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      </div>

      <section aria-labelledby="finite-ess-title" className="finite__ess">
        <h3 id="finite-ess-title">
          The formal <GlossaryTerm term="evolutionarily-stable-strategy" />{" "}
          verdict
        </h3>
        <ul className="finite__ess-list">
          <li data-testid="finite-ess-a">
            <strong>{preset.strategyA}.</strong>{" "}
            {ess.a.isESS
              ? ess.a.clause === "strict-advantage"
                ? "An ESS — it strictly out-earns the mutant against the resident population."
                : "An ESS — it ties against the resident population, then strictly out-earns the mutant against the mutant."
              : `Not an ESS. ${ess.a.witness}`}
          </li>
          <li data-testid="finite-ess-b">
            <strong>{preset.strategyB}.</strong>{" "}
            {ess.b.isESS
              ? ess.b.clause === "strict-advantage"
                ? "An ESS — it strictly out-earns the mutant against the resident population."
                : "An ESS — it ties against the resident population, then strictly out-earns the mutant against the mutant."
              : `Not an ESS. ${ess.b.witness}`}
          </li>
        </ul>
        {ess.mixed ? (
          <p data-testid="finite-mixed">
            An interior rest point sits at{" "}
            <strong>{formatRational(ess.mixed.shareOfA)}</strong>{" "}
            {preset.strategyA}
            {ess.mixed.isStable
              ? " — and it is an attractor, so this mixture is the stable outcome and neither pure strategy is an ESS."
              : " — but it repels, so it is the boundary between two basins rather than a stable mixture."}
          </p>
        ) : null}

        {disagreement ? (
          <p className="finite__disagreement" data-testid="finite-disagreement">
            <strong>The two tests disagree here.</strong>{" "}
            {finitePopulationContent.disagreement}
          </p>
        ) : null}
      </section>

      <details className="finite__exactness">
        <summary>Why these are fractions and not decimals</summary>
        <p>{finitePopulationContent.exactness}</p>
        <p>
          At N = {populationSize}, drift alone would fix a {preset.strategyA}{" "}
          mutant with probability {formatRational(selection.neutral)}. Selection
          moves that to {formatRational(selection.fixationA)} — a margin of
          exactly{" "}
          <code data-testid="finite-margin">
            {formatRational(subtract(selection.fixationA, selection.neutral))}
          </code>
          , which is{" "}
          {compare(selection.fixationA, selection.neutral) === 1
            ? "positive, so selection is helping."
            : compare(selection.fixationA, selection.neutral) === -1
              ? "negative, so selection is working against it."
              : "exactly zero, so selection is doing nothing at all."}
        </p>
      </details>
    </div>
  );
}
