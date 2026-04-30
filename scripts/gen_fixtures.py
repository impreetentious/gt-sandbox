#!/usr/bin/env python3
"""Generate exact two-player Nash-equilibrium fixtures with isolated Gambit."""

from __future__ import annotations

import argparse
import json
import random
import subprocess
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Final


ROOT: Final = Path(__file__).resolve().parents[1]
DEFAULT_IMAGE: Final = "gt-sandbox/gambit-enummixed:16.6.0"
DEFAULT_OUTPUT: Final = ROOT / "fixtures" / "gambit-16.6.0.json"
SOURCE_SEED: Final = "gt-sandbox-p3-gambit-fixtures-v1"
GAMBIT_VERSION: Final = "16.6.0"


@dataclass(frozen=True)
class FixtureCase:
    id: str
    title: str
    row_actions: tuple[str, ...]
    column_actions: tuple[str, ...]
    payoffs: tuple[tuple[tuple[int, int], ...], ...]
    expectation: str = "equilibrium-set"


def catalog_cases() -> list[FixtureCase]:
    return [
        FixtureCase(
            "pd",
            "Prisoner's Dilemma",
            ("Cooperate", "Defect"),
            ("Cooperate", "Defect"),
            (((3, 3), (0, 5)), ((5, 0), (1, 1))),
        ),
        FixtureCase(
            "stag",
            "Stag Hunt",
            ("Stag", "Hare"),
            ("Stag", "Hare"),
            (((4, 4), (0, 3)), ((3, 0), (3, 3))),
        ),
        FixtureCase(
            "bos",
            "Battle of the Sexes",
            ("Yours", "Theirs"),
            ("Yours", "Theirs"),
            (((2, 1), (0, 0)), ((0, 0), (1, 2))),
        ),
        FixtureCase(
            "chicken",
            "Chicken",
            ("Swerve", "Straight"),
            ("Swerve", "Straight"),
            (((0, 0), (-1, 1)), ((1, -1), (-10, -10))),
        ),
        FixtureCase(
            "pennies",
            "Matching Pennies",
            ("Heads", "Tails"),
            ("Heads", "Tails"),
            (((1, -1), (-1, 1)), ((-1, 1), (1, -1))),
        ),
        FixtureCase(
            "ipd-stage",
            "Iterated Prisoner's Dilemma stage game",
            ("Cooperate", "Defect"),
            ("Cooperate", "Defect"),
            (((3, 3), (0, 5)), ((5, 0), (1, 1))),
        ),
        FixtureCase(
            "row-degenerate",
            "Row degeneracy witness",
            ("A", "B"),
            ("X", "Y"),
            (((0, 1), (0, 1)), ((1, 0), (1, 0))),
            "witness-only",
        ),
        FixtureCase(
            "column-degenerate",
            "Column degeneracy witness",
            ("A", "B"),
            ("X", "Y"),
            (((1, 0), (0, 1)), ((1, 0), (0, 1))),
            "witness-only",
        ),
        FixtureCase(
            "three-column-degenerate",
            "Off-support degeneracy witness",
            ("A", "B", "C"),
            ("X", "Y", "Z"),
            (
                ((0, 1), (0, 1), (0, 0)),
                ((1, 0), (1, 0), (1, 0)),
                ((2, 0), (2, 0), (2, 0)),
            ),
            "witness-only",
        ),
    ]


def random_cases() -> list[FixtureCase]:
    source = random.Random(SOURCE_SEED)
    cases: list[FixtureCase] = []

    for index in range(30):
        rows = source.randint(2, 4)
        columns = source.randint(2, 4)
        outcomes = rows * columns
        row_payoffs = source.sample(range(-100_000, 100_001), outcomes)
        column_payoffs = source.sample(range(-100_000, 100_001), outcomes)
        cursor = 0
        payoffs: list[tuple[tuple[int, int], ...]] = []

        for _ in range(rows):
            row: list[tuple[int, int]] = []
            for _ in range(columns):
                row.append((row_payoffs[cursor], column_payoffs[cursor]))
                cursor += 1
            payoffs.append(tuple(row))

        cases.append(
            FixtureCase(
                f"random-{index + 1:02d}",
                f"Seeded random {rows}x{columns} #{index + 1}",
                tuple(f"R{action + 1}" for action in range(rows)),
                tuple(f"C{action + 1}" for action in range(columns)),
                tuple(payoffs),
            )
        )

    return cases


def quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def to_nfg(case: FixtureCase) -> str:
    payoffs: list[str] = []

    for column in range(len(case.column_actions)):
        for row in range(len(case.row_actions)):
            row_payoff, column_payoff = case.payoffs[row][column]
            payoffs.extend((str(row_payoff), str(column_payoff)))

    return "\n".join(
        (
            f'NFG 1 R {quote(case.title)}',
            "{ " + " ".join(quote(player) for player in ("Row", "Column")) + " } "
            + "{ "
            + f"{len(case.row_actions)} {len(case.column_actions)}"
            + " }",
            " ".join(payoffs),
            "",
        )
    )


def image_id(image: str) -> str:
    result = subprocess.run(
        ["docker", "image", "inspect", "--format", "{{.Id}}", image],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def solve_case(image: str, case: FixtureCase) -> list[dict[str, list[str]]]:
    command = [
        "docker",
        "run",
        "--rm",
        "--interactive",
        "--network=none",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit=64",
        "--memory=512m",
        "--cpus=1",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777",
        "--user=65534:65534",
        "--entrypoint=/bin/sh",
        image,
        "-c",
        "cat > /tmp/game.nfg && gambit-enummixed -q /tmp/game.nfg",
    ]
    try:
        result = subprocess.run(
            command,
            input=to_nfg(case),
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as error:
        raise RuntimeError(
            f"Gambit failed for {case.id}: {error.stderr.strip()}"
        ) from error
    equilibria: list[dict[str, list[str]]] = []
    expected_values = len(case.row_actions) + len(case.column_actions)

    for line in result.stdout.splitlines():
        if not line.startswith("NE,"):
            continue

        probabilities = line.split(",")[1:]
        if len(probabilities) != expected_values:
            raise ValueError(f"Unexpected Gambit profile for {case.id}: {line}")

        equilibria.append(
            {
                "row": probabilities[: len(case.row_actions)],
                "column": probabilities[len(case.row_actions) :],
            }
        )

    if not equilibria:
        raise ValueError(f"Gambit returned no equilibria for {case.id}")

    return equilibria


def serialize_case(
    case: FixtureCase, equilibria: list[dict[str, list[str]]]
) -> dict[str, object]:
    return {
        "id": case.id,
        "title": case.title,
        "rowActions": list(case.row_actions),
        "columnActions": list(case.column_actions),
        "payoffs": [
            [[str(row), str(column)] for row, column in payoff_row]
            for payoff_row in case.payoffs
        ],
        "expectation": case.expectation,
        "equilibria": equilibria,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", default=DEFAULT_IMAGE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    arguments = parser.parse_args()

    cases = [*catalog_cases(), *random_cases()]
    serialized_cases = [
        serialize_case(case, solve_case(arguments.image, case)) for case in cases
    ]
    body = {
        "schemaVersion": 1,
        "provenance": {
            "solver": "gambit-enummixed",
            "command": "gambit-enummixed -q",
            "gambitVersion": GAMBIT_VERSION,
            "containerImage": arguments.image,
            "containerImageId": image_id(arguments.image),
            "sourceSeed": SOURCE_SEED,
            "network": "none",
            "hostMounts": "none",
        },
        "cases": serialized_cases,
    }
    encoded = json.dumps(body, indent=2, sort_keys=True) + "\n"
    manifest = {
        "fixture": arguments.output.name,
        "sha256": sha256(encoded.encode()).hexdigest(),
        "caseCount": len(serialized_cases),
        "gambitVersion": GAMBIT_VERSION,
        "sourceSeed": SOURCE_SEED,
    }
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(encoded)
    (arguments.output.parent / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    )


if __name__ == "__main__":
    main()
