"use client";

import { useMemo, useState } from "react";
import { EvolutionExperience } from "@/components/evolve/evolution-experience";
import { FinitePopulationExperience } from "@/components/evolve/finite-population-experience";
import { formatRational, type Rational } from "@/engine/rational";
import {
  DEFAULT_TOURNAMENT_CONTINUATION_PROBABILITY,
  DEFAULT_TOURNAMENT_REPETITIONS,
  DEFAULT_TOURNAMENT_SEED,
  defaultTournamentRoster,
  runIpdTournament,
} from "@/engine/repeated/tournament";
import {
  ipdStrategyById,
  type IpdStrategyId,
} from "@/engine/repeated/strategies";

function decimalPayoff(value: Rational): string {
  const decimal = Number(value.numerator) / Number(value.denominator);

  return Number.isFinite(decimal) ? decimal.toFixed(2) : formatRational(value);
}

function payoffNumber(value: Rational): number {
  return Number(value.numerator) / Number(value.denominator);
}

function heatColor(value: Rational, low: number, high: number): string {
  const span = high - low;
  const relative = span === 0 ? 0.5 : (payoffNumber(value) - low) / span;
  const bounded = Math.max(0, Math.min(1, relative));
  const lightness = 96 - bounded * 36;

  return "hsl(193 55% " + lightness + "%)";
}

/** P7's client surface for the pure, seeded IPD tournament engine. */
export function TournamentExperience() {
  const [view, setView] = useState<"tournament" | "evolution" | "finite">(
    "tournament",
  );
  const [roster, setRoster] = useState<readonly IpdStrategyId[]>(
    defaultTournamentRoster,
  );
  const [announcement, setAnnouncement] = useState("");
  const result = useMemo(
    () =>
      runIpdTournament({
        strategies: roster,
        masterSeed: DEFAULT_TOURNAMENT_SEED,
      }),
    [roster],
  );
  const payoffs = result.matrix.flatMap((row) =>
    row.payoffs.map((entry) => payoffNumber(entry.payoff)),
  );
  const low = Math.min(...payoffs);
  const high = Math.max(...payoffs);
  const gridTemplateColumns =
    "minmax(8.25rem, 1.4fr) repeat(" + roster.length + ", minmax(4.5rem, 1fr))";

  const toggleStrategy = (strategy: IpdStrategyId) => {
    if (roster.includes(strategy) && roster.length === 2) {
      setAnnouncement("Keep at least two strategies in the tournament.");
      return;
    }

    const next = roster.includes(strategy)
      ? roster.filter((entry) => entry !== strategy)
      : defaultTournamentRoster.filter(
          (entry) => entry === strategy || roster.includes(entry),
        );

    setRoster(next);
    setAnnouncement(
      ipdStrategyById[strategy].name +
        (roster.includes(strategy) ? " removed from" : " added to") +
        " the tournament. " +
        next.length +
        " strategies selected.",
    );
  };

  return (
    <section aria-labelledby="evolve-title" className="tournament">
      <header className="tournament__header">
        <p className="eyebrow">
          Evolve /{" "}
          {view === "tournament"
            ? "Tournament"
            : view === "evolution"
              ? "Evolution"
              : "Finite population"}
        </p>
        <h1 className="display" id="evolve-title">
          {view === "tournament"
            ? "A finite tournament of repeatable strategies."
            : view === "evolution"
              ? "A population is more than a scoreboard."
              : "In a small population, luck outranks fitness."}
        </h1>
        <p className="lede">
          {view === "tournament"
            ? "Eight specified Iterated Prisoner's Dilemma policies meet in a reproducible round-robin. The table rewards a strategy's average payoff per round, never the luck of a longer match."
            : view === "evolution"
              ? "Hold a seeded match environment fixed, then see which strategies become more common under discrete replicator dynamics."
              : "Drop a single mutant into a population of N and compute exactly how often it takes over — then compare that against the formal evolutionary-stability test the infinite-population theory gives you."}
        </p>
      </header>

      <div aria-label="Evolve views" className="evolve-tabs" role="tablist">
        <button
          aria-controls="tournament-panel"
          aria-selected={view === "tournament"}
          id="tournament-tab"
          onClick={() => setView("tournament")}
          role="tab"
          type="button"
        >
          Tournament
        </button>
        <button
          aria-controls="evolution-panel"
          aria-selected={view === "evolution"}
          id="evolution-tab"
          onClick={() => setView("evolution")}
          role="tab"
          type="button"
        >
          Evolution
        </button>
        <button
          aria-controls="finite-panel"
          aria-selected={view === "finite"}
          id="finite-tab"
          onClick={() => setView("finite")}
          role="tab"
          type="button"
        >
          Finite population
        </button>
      </div>

      {view === "tournament" ? (
        <div
          aria-labelledby="tournament-tab"
          className="tournament__panel"
          id="tournament-panel"
          role="tabpanel"
        >
          <section className="tournament__method">
            <p className="eyebrow">Method</p>
            <p>
              Robert Axelrod&apos;s <cite>The Evolution of Cooperation</cite>{" "}
              (1984) used computer tournaments to compare Iterated
              Prisoner&apos;s Dilemma strategies. This is a deliberately
              smaller, reproducible model—not a reconstruction of those
              historical entrants or scoring rules.
            </p>
            <p>
              Each ordered pair, including self-play, runs{" "}
              {DEFAULT_TOURNAMENT_REPETITIONS} seeded matches at δ ={" "}
              {DEFAULT_TOURNAMENT_CONTINUATION_PROBABILITY}. Every cell is the
              exact mean of each match&apos;s per-round payoff; the displayed
              decimal is rounded only for reading.
            </p>
          </section>

          <fieldset className="tournament__roster">
            <legend>Roster</legend>
            <p>
              Select at least two strategies. Results recompute from the same
              seed.
            </p>
            <div className="tournament__roster-options">
              {defaultTournamentRoster.map((strategy) => (
                <label key={strategy}>
                  <input
                    checked={roster.includes(strategy)}
                    onChange={() => toggleStrategy(strategy)}
                    type="checkbox"
                  />
                  <span>{ipdStrategyById[strategy].name}</span>
                </label>
              ))}
            </div>
            <p
              aria-label="Tournament changes"
              aria-live="polite"
              className="sr-only"
              role="status"
            >
              {announcement}
            </p>
          </fieldset>

          <dl
            aria-label="Tournament configuration"
            className="tournament__config"
          >
            <div>
              <dt>Seed</dt>
              <dd>{result.config.masterSeed}</dd>
            </div>
            <div>
              <dt>Repetitions</dt>
              <dd>{result.config.repetitions} per ordered pair</dd>
            </div>
            <div>
              <dt>Noise</dt>
              <dd>Off</dd>
            </div>
          </dl>

          <section
            aria-labelledby="ranking-title"
            className="tournament__ranking"
          >
            <div className="tournament__section-heading">
              <div>
                <p className="eyebrow">Ranking</p>
                <h2 id="ranking-title">
                  Mean payoff across the selected field
                </h2>
              </div>
              <p>Exact fractions are available in the table below.</p>
            </div>
            <ol>
              {result.ranking.map((entry) => (
                <li key={entry.strategy}>
                  <span>{entry.position}</span>
                  <strong>{ipdStrategyById[entry.strategy].name}</strong>
                  <output title={formatRational(entry.payoff)}>
                    {decimalPayoff(entry.payoff)}
                  </output>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="heatmap-title"
            className="tournament__matrix"
          >
            <div className="tournament__section-heading">
              <div>
                <p className="eyebrow">Pairwise payoff matrix</p>
                <h2 id="heatmap-title">
                  How each strategy fares against every rival
                </h2>
              </div>
              <p>
                Row strategy&apos;s payoff per round; darker cells are higher.
              </p>
            </div>
            <div
              aria-label="Tournament payoff heatmap. Each cell also includes its numeric value; the accessible data table follows."
              className="tournament-heatmap__scroll"
              tabIndex={0}
            >
              <div
                className="tournament-heatmap"
                style={{ gridTemplateColumns }}
              >
                <span className="tournament-heatmap__corner">
                  Row → / rival ↓
                </span>
                {roster.map((strategy) => (
                  <strong className="tournament-heatmap__column" key={strategy}>
                    {ipdStrategyById[strategy].name}
                  </strong>
                ))}
                {result.matrix.flatMap((row) => [
                  <strong
                    className="tournament-heatmap__row"
                    key={row.strategy + "-label"}
                  >
                    {ipdStrategyById[row.strategy].name}
                  </strong>,
                  ...row.payoffs.map((entry) => (
                    <output
                      aria-label={
                        ipdStrategyById[row.strategy].name +
                        " against " +
                        ipdStrategyById[entry.opponent].name +
                        ": " +
                        formatRational(entry.payoff) +
                        " exact mean payoff per round, displayed as " +
                        decimalPayoff(entry.payoff) +
                        "."
                      }
                      className="tournament-heatmap__cell"
                      key={row.strategy + "-" + entry.opponent}
                      style={{
                        backgroundColor: heatColor(entry.payoff, low, high),
                      }}
                      title={"Exact: " + formatRational(entry.payoff)}
                    >
                      {decimalPayoff(entry.payoff)}
                    </output>
                  )),
                ])}
              </div>
            </div>

            <details className="tournament-table">
              <summary>View as an accessible data table</summary>
              <div className="tournament-table__scroll" tabIndex={0}>
                <table>
                  <caption>
                    Exact mean per-round payoff for each row strategy against
                    each column strategy.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Strategy</th>
                      {roster.map((strategy) => (
                        <th key={strategy} scope="col">
                          {ipdStrategyById[strategy].name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.matrix.map((row) => (
                      <tr key={row.strategy}>
                        <th scope="row">
                          {ipdStrategyById[row.strategy].name}
                        </th>
                        {row.payoffs.map((entry) => (
                          <td key={entry.opponent}>
                            <output
                              title={"Rounded: " + decimalPayoff(entry.payoff)}
                            >
                              {formatRational(entry.payoff)}
                            </output>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </div>
      ) : view === "evolution" ? (
        <EvolutionExperience />
      ) : (
        <FinitePopulationExperience />
      )}
    </section>
  );
}
