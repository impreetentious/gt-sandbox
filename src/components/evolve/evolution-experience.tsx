"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import {
  evolutionPresetById,
  evolutionPresets,
  type EvolutionPresetId,
} from "@/content/evolution-presets";
import {
  runIpdEvolution,
  type IpdEvolutionConfig,
  type ReplicatorGeneration,
} from "@/engine/repeated/replicator";
import {
  ipdStrategyById,
  type IpdStrategyId,
} from "@/engine/repeated/strategies";
import {
  decodeEvolutionSearch,
  encodeEvolutionConfig,
} from "@/state/evolution-url";

/**
 * Series colours live in `globals.css` as `--series-1` … `--series-8`, not as
 * literals here, so the dark palette can restate them (V2-P8). Eight is the
 * roster cap; a ninth strategy would need a ninth token rather than a wrap,
 * because two identical bands would be worse than an ugly one.
 */
const chartColors = Array.from(
  { length: 8 },
  (_, index) => `var(--series-${index + 1})`,
);

type PresetSelection = EvolutionPresetId | "custom";

function sameEvolutionConfig(
  a: IpdEvolutionConfig,
  b: IpdEvolutionConfig,
): boolean {
  return (
    a.masterSeed === b.masterSeed &&
    a.continuationProbability === b.continuationProbability &&
    a.noise === b.noise &&
    a.repetitions === b.repetitions &&
    a.roundCap === b.roundCap &&
    a.generations === b.generations &&
    a.strategies.length === b.strategies.length &&
    a.strategies.every((s, i) => s === b.strategies[i]) &&
    a.initialShares.length === b.initialShares.length &&
    a.initialShares.every((x, i) => x === b.initialShares[i])
  );
}

function presetForConfig(config: IpdEvolutionConfig): PresetSelection {
  const matchingPreset = evolutionPresets.find((preset) =>
    sameEvolutionConfig(preset.config, config),
  );

  return matchingPreset?.id ?? "custom";
}

function subscribeToBrowserHistory(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);

  return () => window.removeEventListener("popstate", onChange);
}

function browserSearch(): string {
  return window.location.search;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function displayNumber(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function chartAreaPath(
  generations: readonly ReplicatorGeneration[],
  strategyIndex: number,
  width: number,
  height: number,
): string {
  const xFor = (index: number) =>
    generations.length <= 1 ? 0 : (index / (generations.length - 1)) * width;
  const cumulative = (generation: ReplicatorGeneration, through: number) =>
    generation.shares
      .slice(0, through + 1)
      .reduce((sum, share) => sum + share, 0);
  const yFor = (share: number) => height - share * height;
  const upper = generations.map(
    (generation, index) =>
      `${xFor(index)} ${yFor(cumulative(generation, strategyIndex))}`,
  );
  const lower = [...generations].reverse().map((generation, reverseIndex) => {
    const index = generations.length - 1 - reverseIndex;
    const lowerShare =
      strategyIndex === 0 ? 0 : cumulative(generation, strategyIndex - 1);

    return `${xFor(index)} ${yFor(lowerShare)}`;
  });

  return `M ${upper.join(" L ")} L ${lower.join(" L ")} Z`;
}

function selectedBandCenter(
  generation: ReplicatorGeneration,
  strategyIndex: number,
): number {
  const lower = generation.shares
    .slice(0, strategyIndex)
    .reduce((sum, share) => sum + share, 0);
  const share = generation.shares[strategyIndex] ?? 0;

  return lower + share / 2;
}

interface PopulationChartProps {
  readonly strategies: readonly IpdStrategyId[];
  readonly generations: readonly ReplicatorGeneration[];
  readonly isolated: IpdStrategyId | null;
  readonly onIsolate: (strategy: IpdStrategyId | null) => void;
}

function PopulationChart({
  strategies,
  generations,
  isolated,
  onIsolate,
}: PopulationChartProps) {
  const width = 760;
  const height = 260;
  const final = generations.at(-1);

  if (!final) {
    return null;
  }

  return (
    <>
      <div aria-label="Population bands" className="evolution-chart__bands">
        {strategies.map((strategy, index) => (
          <button
            aria-pressed={isolated === strategy}
            key={strategy}
            onBlur={() => onIsolate(null)}
            onFocus={() => onIsolate(strategy)}
            onMouseEnter={() => onIsolate(strategy)}
            onMouseLeave={() => onIsolate(null)}
            onClick={() => onIsolate(isolated === strategy ? null : strategy)}
            style={{ "--band-color": chartColors[index] } as CSSProperties}
            type="button"
          >
            {ipdStrategyById[strategy].name}
          </button>
        ))}
      </div>
      <svg
        aria-label="Stacked population shares across generations. The exact data table follows."
        className="evolution-chart"
        role="img"
        viewBox={`0 0 ${width + 160} ${height + 42}`}
      >
        <line
          className="evolution-chart__axis"
          x1="0"
          x2={width}
          y1={height}
          y2={height}
        />
        <text className="evolution-chart__tick" x="0" y={height + 25}>
          0
        </text>
        <text
          className="evolution-chart__tick"
          textAnchor="end"
          x={width}
          y={height + 25}
        >
          {generations.length - 1}
        </text>
        {strategies.map((strategy, index) => (
          <path
            className="evolution-chart__area"
            d={chartAreaPath(generations, index, width, height)}
            fill={chartColors[index]}
            key={strategy}
            opacity={isolated === null || isolated === strategy ? 1 : 0.2}
          />
        ))}
        {strategies.map((strategy, index) => (
          <text
            className="evolution-chart__label"
            key={`${strategy}-label`}
            x={width + 12}
            y={height - selectedBandCenter(final, index) * height}
          >
            {ipdStrategyById[strategy].name} {percent(final.shares[index] ?? 0)}
          </text>
        ))}
      </svg>
    </>
  );
}

/** P8's deterministic population-evolution surface. */
export function EvolutionExperience() {
  const search = useSyncExternalStore(
    subscribeToBrowserHistory,
    browserSearch,
    () => "",
  );
  const urlState = useMemo(() => decodeEvolutionSearch(search), [search]);
  const [customConfig, setCustomConfig] = useState<IpdEvolutionConfig | null>(
    null,
  );
  const [selectedPreset, setSelectedPreset] = useState<PresetSelection | null>(
    null,
  );
  const [interactionNotice, setInteractionNotice] = useState("");
  const [generation, setGeneration] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [isolated, setIsolated] = useState<IpdStrategyId | null>(null);
  const config = customConfig ?? urlState.config;
  const preset = selectedPreset ?? presetForConfig(urlState.config);
  const notice = interactionNotice || urlState.notice || "";
  const evolution = useMemo(() => runIpdEvolution(config), [config]);
  const completeConfig = evolution.config;
  const snapshots = evolution.result.generations;
  const current = snapshots[generation] ?? snapshots.at(-1);
  const presetDefinition =
    preset === "custom" ? undefined : evolutionPresetById(preset);

  useEffect(() => {
    if (customConfig === null && window.location.search !== search) {
      return;
    }

    const encodedSearch = encodeEvolutionConfig(completeConfig);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${encodedSearch}`,
    );
  }, [completeConfig, customConfig, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const snapshot = snapshots[generation];

      if (snapshot) {
        setAnnouncement(
          `Showing generation ${snapshot.generation} of ${snapshots.length - 1}.`,
        );
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [generation, snapshots]);

  const choosePreset = (id: EvolutionPresetId) => {
    const next = evolutionPresetById(id);
    setCustomConfig(next.config);
    setSelectedPreset(id);
    setGeneration(0);
    setInteractionNotice(
      `${next.label} uses its reviewed, frozen configuration.`,
    );
  };

  const updateConfig = (
    update: (current: Required<IpdEvolutionConfig>) => IpdEvolutionConfig,
  ) => {
    setCustomConfig((currentConfig) =>
      update(runIpdEvolution(currentConfig ?? urlState.config).config),
    );
    setSelectedPreset("custom");
    setGeneration(0);
  };

  const updateShare = (index: number, percentage: number) => {
    const bounded = Math.max(0, Math.min(100, percentage));
    const nextShare = bounded / 100;
    const previousShare = completeConfig.initialShares[index] ?? 0;
    const otherTotal = 1 - previousShare;
    const shares = completeConfig.initialShares.map((share, shareIndex) => {
      if (shareIndex === index) {
        return nextShare;
      }

      if (otherTotal === 0) {
        return (1 - nextShare) / (completeConfig.initialShares.length - 1);
      }

      return (share / otherTotal) * (1 - nextShare);
    });

    if (shares.every((share) => share === 0)) {
      setInteractionNotice(
        "At least one strategy needs a positive population share.",
      );
      return;
    }

    updateConfig((currentConfig) => ({
      ...currentConfig,
      initialShares: shares,
    }));
  };

  if (!current) {
    return null;
  }

  return (
    <section
      aria-labelledby="evolution-tab"
      className="evolution"
      id="evolution-panel"
      role="tabpanel"
    >
      <div className="evolution__intro">
        <p className="eyebrow">Evolution</p>
        <h2 id="evolution-panel-title">
          Population shares under a fixed environment
        </h2>
        <p>
          The pairwise match estimates stay fixed while{" "}
          <GlossaryTerm term="replicator-dynamics" /> updates the population.
          Shares use floating point because they are simulation state; the
          underlying IPD match payoffs remain the seeded, per-round estimates
          shown below.
        </p>
      </div>

      <section
        aria-labelledby="evolution-preset-title"
        className="evolution__controls"
      >
        <div>
          <p className="eyebrow">Preset</p>
          <h3 id="evolution-preset-title">A reviewed starting condition</h3>
        </div>
        <label className="evolution__select">
          <span>Story</span>
          <select
            onChange={(event) =>
              choosePreset(event.target.value as EvolutionPresetId)
            }
            value={preset}
          >
            {preset === "custom" ? (
              <option value="custom">Custom run</option>
            ) : null}
            {evolutionPresets.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <p className="evolution__story">
          {presetDefinition?.description ??
            "This custom configuration recomputes the same seeded environment from the values below."}
        </p>
      </section>

      <section
        aria-label="Evolution controls"
        className="evolution__controls evolution__controls--sliders"
      >
        <label>
          <span>
            <GlossaryTerm term="continuation-probability" /> δ
          </span>
          <output>
            {displayNumber(completeConfig.continuationProbability, 3)}
          </output>
          <input
            aria-label="Continuation probability"
            max="0.995"
            min="0.5"
            onChange={(event) =>
              updateConfig((currentConfig) => ({
                ...currentConfig,
                continuationProbability: Number(event.target.value),
              }))
            }
            step="0.005"
            type="range"
            value={completeConfig.continuationProbability}
          />
        </label>
        <label>
          <span>Action noise ε</span>
          <output>{percent(completeConfig.noise)}</output>
          <input
            aria-label="Action noise"
            max="0.1"
            min="0"
            onChange={(event) =>
              updateConfig((currentConfig) => ({
                ...currentConfig,
                noise: Number(event.target.value),
              }))
            }
            step="0.005"
            type="range"
            value={completeConfig.noise}
          />
        </label>
        <label>
          <span>Seed</span>
          <input
            aria-label="Evolution seed"
            max="2147483647"
            min="0"
            onChange={(event) => {
              const seed = Number(event.target.value);

              if (Number.isSafeInteger(seed) && seed >= 0) {
                updateConfig((currentConfig) => ({
                  ...currentConfig,
                  masterSeed: seed,
                }));
              }
            }}
            step="1"
            type="number"
            value={completeConfig.masterSeed}
          />
        </label>
      </section>

      <section
        aria-labelledby="population-title"
        className="evolution__controls"
      >
        <div>
          <p className="eyebrow">Population</p>
          <h3 id="population-title">Starting shares</h3>
        </div>
        <p className="evolution__story">
          Changing one share renormalizes the selected population before the run
          begins.
        </p>
        <div className="evolution__shares">
          {completeConfig.strategies.map((strategy, index) => (
            <label key={strategy}>
              <span>{ipdStrategyById[strategy].name}</span>
              <output>
                {percent(completeConfig.initialShares[index] ?? 0)}
              </output>
              <input
                aria-label={`${ipdStrategyById[strategy].name} starting share`}
                max="100"
                min="0"
                onChange={(event) =>
                  updateShare(index, Number(event.target.value))
                }
                step="1"
                type="range"
                value={(completeConfig.initialShares[index] ?? 0) * 100}
              />
            </label>
          ))}
        </div>
      </section>

      <dl
        aria-label="Fixed evolution environment"
        className="evolution__config"
      >
        <div>
          <dt>Repetitions</dt>
          <dd>{completeConfig.repetitions} per pair</dd>
        </div>
        <div>
          <dt>Round cap</dt>
          <dd>{completeConfig.roundCap}</dd>
        </div>
        <div>
          <dt>Generations</dt>
          <dd>{completeConfig.generations}</dd>
        </div>
      </dl>

      {evolution.result.status === "zero-mean-fitness" ? (
        <p className="evolution__warning">
          This run stopped at generation {evolution.result.generation}: every
          sampled payoff was zero, so there is no population-average fitness to
          divide by.
        </p>
      ) : null}

      <section
        aria-labelledby="trajectory-title"
        className="evolution__trajectory"
      >
        <div className="tournament__section-heading">
          <div>
            <p className="eyebrow">Trajectory</p>
            <h2 id="trajectory-title">Who becomes more common</h2>
          </div>
          <p>
            Hover or focus a name to isolate its band. The final labels carry
            both name and value.
          </p>
        </div>
        <PopulationChart
          generations={snapshots}
          isolated={isolated}
          onIsolate={setIsolated}
          strategies={completeConfig.strategies}
        />

        <label className="evolution__scrubber">
          <span>Generation scrubber</span>
          <output>{generation}</output>
          <input
            aria-label="Generation scrubber"
            aria-valuetext={`Generation ${generation} of ${snapshots.length - 1}`}
            max={snapshots.length - 1}
            min="0"
            onChange={(event) => setGeneration(Number(event.target.value))}
            step="1"
            type="range"
            value={generation}
          />
        </label>
        <dl
          aria-label={`Population at generation ${generation}`}
          className="evolution__current"
        >
          {completeConfig.strategies.map((strategy, index) => (
            <div key={strategy}>
              <dt>{ipdStrategyById[strategy].name}</dt>
              <dd>{percent(current.shares[index] ?? 0)}</dd>
            </div>
          ))}
        </dl>
        <p aria-live="polite" className="sr-only" role="status">
          {announcement}
        </p>
        <details className="evolution-table">
          <summary>View each generation as an accessible data table</summary>
          <div className="evolution-table__scroll" tabIndex={0}>
            <table>
              <caption>
                Population share at every generation for this seeded evolution
                run.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Generation</th>
                  {completeConfig.strategies.map((strategy) => (
                    <th key={strategy} scope="col">
                      {ipdStrategyById[strategy].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr
                    aria-current={
                      snapshot.generation === generation ? "true" : undefined
                    }
                    key={snapshot.generation}
                  >
                    <th scope="row">{snapshot.generation}</th>
                    {snapshot.shares.map((share, index) => (
                      <td key={completeConfig.strategies[index]}>
                        {percent(share)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <p className="evolution__link">
        <a href={encodeEvolutionConfig(completeConfig)}>
          Open this exact seeded run
        </a>
        . Its full bounded configuration is in the URL.
      </p>
      <p aria-live="polite" className="evolution__notice" role="status">
        {notice}
      </p>
    </section>
  );
}
