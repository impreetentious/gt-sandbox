"use client";

import { useMemo, useState, type KeyboardEvent } from "react";

import { filterOrdinalTopology, ordinalTopology } from "@/engine/topology";
import { formatRational } from "@/engine/rational";

function matrixSummary(index: number) {
  const entry = ordinalTopology[index];
  if (!entry) return null;
  return entry.game.payoffs.map((row) =>
    row.map(
      ([rowPayoff, columnPayoff]) =>
        `${formatRational(rowPayoff)}, ${formatRational(columnPayoff)}`,
    ),
  );
}

export function TopologyAtlas() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const games = useMemo(() => filterOrdinalTopology(query), [query]);
  const selectedGame = games[selected] ?? games[0] ?? null;

  const moveSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    if (games.length === 0) return;
    const width = Math.min(12, games.length);
    const current = Math.min(selected, games.length - 1);
    const next =
      event.key === "ArrowRight"
        ? current + 1
        : event.key === "ArrowLeft"
          ? current - 1
          : event.key === "ArrowDown"
            ? current + width
            : event.key === "ArrowUp"
              ? current - width
              : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(Math.max(0, Math.min(games.length - 1, next)));
  };

  const matrix = selectedGame
    ? matrixSummary(ordinalTopology.indexOf(selectedGame))
    : null;

  return (
    <section className="topology-atlas" aria-labelledby="topology-title">
      <header className="topology-atlas__header">
        <p className="eyebrow">Methods / Robinson–Goforth atlas</p>
        <h1 className="display" id="topology-title">
          Every strict ordinal 2×2 game.
        </h1>
        <p className="lede">
          The atlas quotients the 576 labelled payoff rankings by row and column
          action relabelling, leaving 144 strategic structures. Select a tile to
          inspect its exact best-response class.
        </p>
      </header>

      <label className="topology-atlas__filter">
        <span>Filter by concept</span>
        <input
          aria-controls="topology-grid"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          placeholder="e.g. coordination, dilemma, matching pennies"
          type="search"
          value={query}
        />
      </label>
      <p className="topology-atlas__count" role="status">
        {games.length} of 144 games shown. Use arrow keys to move through the
        grid.
      </p>

      {selectedGame ? (
        <div className="topology-atlas__layout">
          <div
            aria-activedescendant={`topology-${selectedGame.id}`}
            aria-label="Ordinal game grid"
            className="topology-atlas__grid"
            id="topology-grid"
            onKeyDown={moveSelection}
            role="listbox"
            tabIndex={0}
          >
            {games.map((entry, index) => (
              <button
                aria-label={`${entry.id}, ${entry.structure}`}
                aria-selected={entry.id === selectedGame.id}
                className="topology-atlas__tile"
                id={`topology-${entry.id}`}
                key={entry.id}
                onClick={() => setSelected(index)}
                role="option"
                type="button"
              >
                <span>{entry.id.replace("ordinal-", "#")}</span>
                <strong>{entry.structure}</strong>
              </button>
            ))}
          </div>
          <aside aria-live="polite" className="topology-atlas__detail">
            <p className="eyebrow">Selected game</p>
            <h2>{selectedGame.structure}</h2>
            <p>{selectedGame.id.replace("ordinal-", "Ordinal game ")}</p>
            <table>
              <caption className="sr-only">
                Payoff matrix for the selected ordinal game
              </caption>
              <tbody>
                {matrix?.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, columnIndex) => (
                      <td key={columnIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="topology-atlas__help">
              Payoffs are ordinal ranks: higher is preferred. The label comes
              from the same exact classifier used in Build.
            </p>
          </aside>
        </div>
      ) : (
        <p className="topology-atlas__empty" role="status">
          No ordinal games match “{query}”. Try a strategic concept such as
          “battle” or “cycle”.
        </p>
      )}
    </section>
  );
}
