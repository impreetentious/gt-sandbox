"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import { spatialContent, spatialPresets } from "@/content/spatial";
import {
  cellPosition,
  createSpatialConfig,
  runSpatial,
  seededGrid,
  singleDefectorGrid,
  type Boundary,
  type Neighborhood,
  type SpatialGrid,
} from "@/engine/spatial";
import {
  formatRational,
  multiply,
  rational,
  type Rational,
} from "@/engine/rational";

const TEMPTATION_DENOMINATOR = 10n;
const MAX_GENERATIONS = 40;
const CELL = 10;

function percentLabel(numerator: number, denominator: number): string {
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** Slider position for a preset's b, which the grid keeps at tenths. */
function temptationToStep(temptation: Rational): number {
  const scaled = multiply(temptation, rational(TEMPTATION_DENOMINATOR));
  return Number(scaled.numerator / scaled.denominator);
}

export function SpatialExperience() {
  const [presetId, setPresetId] = useState(spatialPresets[0].id);
  const preset =
    spatialPresets.find((option) => option.id === presetId) ??
    spatialPresets[0];

  const [temptationStep, setTemptationStep] = useState(16);
  const [size, setSize] = useState(preset.size);
  const [neighborhood, setNeighborhood] = useState<Neighborhood>(
    preset.neighborhood,
  );
  const [boundary, setBoundary] = useState<Boundary>(preset.boundary);
  const [selfInteraction, setSelfInteraction] = useState(
    preset.selfInteraction,
  );
  const [opening, setOpening] = useState(preset.opening);
  const [generation, setGeneration] = useState(0);

  // Selecting a preset replaces every control at once; the presets are whole
  // configurations, not just a payoff, because the neighbourhood and the
  // opening matter as much as b does.
  function applyPreset(id: string): void {
    const next =
      spatialPresets.find((option) => option.id === id) ?? spatialPresets[0];
    setPresetId(id);
    setTemptationStep(temptationToStep(next.temptation));
    setSize(next.size);
    setNeighborhood(next.neighborhood);
    setBoundary(next.boundary);
    setSelfInteraction(next.selfInteraction);
    setOpening(next.opening);
    setGeneration(0);
  }

  const temptation = rational(BigInt(temptationStep), TEMPTATION_DENOMINATOR);

  const run = useMemo(() => {
    const config = createSpatialConfig({
      width: size,
      height: size,
      // Nowak & May's weak Prisoner's Dilemma: R = 1, P = S = 0, T = b.
      payoffs: {
        a: rational(1n),
        b: rational(0n),
        c: temptation,
        d: rational(0n),
      },
      neighborhood,
      boundary,
      selfInteraction,
    });
    const start: SpatialGrid =
      opening === "single-defector"
        ? singleDefectorGrid(config)
        : seededGrid(config, preset.seed, rational(1n, 2n));

    return runSpatial(config, start, MAX_GENERATIONS);
  }, [
    boundary,
    neighborhood,
    opening,
    preset.seed,
    selfInteraction,
    size,
    temptation,
  ]);

  const lastGeneration = run.generations.length - 1;
  const clamped = Math.min(generation, lastGeneration);
  const current = run.generations[clamped];

  const statusRef = useRef<HTMLParagraphElement>(null);

  // Mirrors the evolution scrubber: the live region announces the generation so
  // a screen-reader user stepping through the lattice hears it change.
  useEffect(() => {
    const node = statusRef.current;
    if (node) {
      node.textContent = `Generation ${clamped} of ${lastGeneration}. Cooperators hold ${formatRational(
        current.cooperatorShare,
      )} of the lattice.`;
    }
  }, [clamped, current.cooperatorShare, lastGeneration]);

  const cooperators = current.grid.filter((cell) => cell === 0).length;
  const total = current.grid.length;

  const terminationNote =
    run.termination.kind === "fixed-point"
      ? `The lattice stopped changing at generation ${run.termination.generation}.`
      : run.termination.kind === "cycle"
        ? `The lattice fell into a repeating cycle of period ${run.termination.period} at generation ${run.termination.generation}.`
        : `Still moving after ${MAX_GENERATIONS} generations — no fixed point and no repeat.`;

  return (
    <section aria-labelledby="spatial-title" className="spatial">
      <header className="spatial__header">
        <p className="eyebrow">Evolve / Spatial</p>
        <h1 className="display" id="spatial-title">
          Cooperation survives because it can cluster.
        </h1>
        <p className="lede">{spatialContent.framing}</p>
      </header>

      <div className="spatial__layout">
        <section
          aria-labelledby="spatial-controls-title"
          className="spatial__controls"
        >
          <h2 id="spatial-controls-title">The lattice</h2>

          <div className="spatial__control">
            <label htmlFor="spatial-preset">Scenario</label>
            <select
              id="spatial-preset"
              onChange={(event) => applyPreset(event.target.value)}
              value={presetId}
            >
              {spatialPresets.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="spatial__control-note">{preset.description}</p>
          </div>

          <div className="spatial__control">
            <label htmlFor="spatial-temptation">
              Temptation b
              <output htmlFor="spatial-temptation">
                {formatRational(temptation)}
              </output>
            </label>
            <input
              id="spatial-temptation"
              max={30}
              min={11}
              onChange={(event) => {
                setTemptationStep(Number(event.target.value));
                setGeneration(0);
              }}
              step={1}
              type="range"
              value={temptationStep}
            />
            <p className="spatial__control-note">
              A defector meeting a cooperator earns b; two cooperators earn 1
              each; anything involving a defector on both sides earns 0.
            </p>
          </div>

          <div className="spatial__control">
            <label htmlFor="spatial-size">
              Lattice
              <output htmlFor="spatial-size">
                {size} × {size}
              </output>
            </label>
            <input
              id="spatial-size"
              max={29}
              min={9}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setGeneration(0);
              }}
              step={2}
              type="range"
              value={size}
            />
          </div>

          <div className="spatial__control">
            <label htmlFor="spatial-neighborhood">Neighbourhood</label>
            <select
              id="spatial-neighborhood"
              onChange={(event) => {
                setNeighborhood(event.target.value as Neighborhood);
                setGeneration(0);
              }}
              value={neighborhood}
            >
              <option value="moore">Moore — all 8 surrounding cells</option>
              <option value="von-neumann">
                von Neumann — the 4 orthogonal cells
              </option>
            </select>
          </div>

          <div className="spatial__control">
            <label htmlFor="spatial-boundary">Edges</label>
            <select
              id="spatial-boundary"
              onChange={(event) => {
                setBoundary(event.target.value as Boundary);
                setGeneration(0);
              }}
              value={boundary}
            >
              <option value="torus">Wrap around — no edge at all</option>
              <option value="fixed">Hard edge — corner cells have fewer</option>
            </select>
          </div>

          <div className="spatial__control">
            <label htmlFor="spatial-opening">Opening</label>
            <select
              id="spatial-opening"
              onChange={(event) => {
                setOpening(event.target.value as typeof opening);
                setGeneration(0);
              }}
              value={opening}
            >
              <option value="single-defector">
                One defector in a cooperator field
              </option>
              <option value="seeded">Seeded half-and-half scatter</option>
            </select>
          </div>

          <div className="spatial__control spatial__control--check">
            <input
              checked={selfInteraction}
              id="spatial-self"
              onChange={(event) => {
                setSelfInteraction(event.target.checked);
                setGeneration(0);
              }}
              type="checkbox"
            />
            <label htmlFor="spatial-self">
              Cells also play themselves
              <span className="spatial__control-note">
                Nowak &amp; May&apos;s variant. It adds a different constant to
                each strategy, so it moves the threshold rather than shifting
                every score equally.
              </span>
            </label>
          </div>
        </section>

        <section
          aria-labelledby="spatial-lattice-title"
          className="spatial__results"
        >
          <h2 id="spatial-lattice-title">Generation {clamped}</h2>

          <figure className="spatial__figure">
            <svg
              aria-label={`Lattice at generation ${clamped}. ${cooperators} of ${total} cells are cooperators. The accessible data table below carries the same run.`}
              className="spatial__grid"
              role="img"
              viewBox={`0 0 ${size * CELL} ${size * CELL}`}
            >
              {current.grid.map((cell, index) => {
                const { x, y } = cellPosition(run.config, index);
                return (
                  <rect
                    className={
                      cell === 0
                        ? "spatial__cell spatial__cell--c"
                        : "spatial__cell spatial__cell--d"
                    }
                    height={CELL}
                    key={index}
                    width={CELL}
                    x={x * CELL}
                    y={y * CELL}
                  />
                );
              })}
            </svg>
            <figcaption>
              Filled cells cooperate; outlined cells defect. Cooperators hold{" "}
              <strong data-testid="spatial-share">
                {formatRational(current.cooperatorShare)}
              </strong>{" "}
              of the lattice ({percentLabel(cooperators, total)}).
            </figcaption>
          </figure>

          <div className="spatial__transport">
            <button
              disabled={clamped === 0}
              onClick={() => setGeneration(Math.max(0, clamped - 1))}
              type="button"
            >
              Step back
            </button>
            <div className="spatial__scrub">
              <label htmlFor="spatial-generation">
                Generation
                <output htmlFor="spatial-generation">
                  {clamped} / {lastGeneration}
                </output>
              </label>
              <input
                id="spatial-generation"
                max={lastGeneration}
                min={0}
                onChange={(event) => setGeneration(Number(event.target.value))}
                step={1}
                type="range"
                value={clamped}
              />
            </div>
            <button
              disabled={clamped === lastGeneration}
              onClick={() =>
                setGeneration(Math.min(lastGeneration, clamped + 1))
              }
              type="button"
            >
              Step forward
            </button>
          </div>
          <p
            aria-live="polite"
            className="sr-only"
            ref={statusRef}
            role="status"
          />

          <p className="spatial__termination" data-testid="spatial-termination">
            {terminationNote}
          </p>

          <details className="spatial__table-fallback">
            <summary>View the run as an accessible data table</summary>
            <div className="spatial__table-scroll" tabIndex={0}>
              <table>
                <caption>
                  Exact cooperator share at every generation of this run.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Generation</th>
                    <th scope="col">Cooperator share</th>
                    <th scope="col">Approx.</th>
                  </tr>
                </thead>
                <tbody>
                  {run.generations.map((snapshot) => (
                    <tr key={snapshot.generation}>
                      <th scope="row">{snapshot.generation}</th>
                      <td>{formatRational(snapshot.cooperatorShare)}</td>
                      <td>
                        {percentLabel(
                          Number(snapshot.cooperatorShare.numerator),
                          Number(snapshot.cooperatorShare.denominator),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      </div>

      <section aria-labelledby="spatial-why-title" className="spatial__why">
        <h2 id="spatial-why-title">
          Why a cluster survives: <GlossaryTerm term="spatial-reciprocity" />
        </h2>
        <p>{spatialContent.whyItWorks}</p>
        <p>{spatialContent.ruleExplainer}</p>

        <details className="spatial__exactness">
          <summary>The rules that are easy to get wrong</summary>
          <p>{spatialContent.tieBreak}</p>
          <p>{spatialContent.exactness}</p>
        </details>
      </section>
    </section>
  );
}
