import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "/",
  "/play/pd/",
  "/play/stag-hunt/",
  "/play/battle-of-the-sexes/",
  "/play/chicken/",
  "/play/matching-pennies/",
  "/play/iterated-pd/",
  "/hot-seat/pd/",
  "/hot-seat/stag-hunt/",
  "/hot-seat/battle-of-the-sexes/",
  "/hot-seat/chicken/",
  "/hot-seat/matching-pennies/",
  "/repeat/",
  "/auctions/first-price/",
  "/auctions/second-price/",
  "/auctions/common-value/",
  "/classroom/",
  "/evolve/",
  "/build/",
  "/methods/",
  "/extensive/entry-deterrence/",
  "/extensive/ultimatum/",
  "/extensive/centipede/",
  "/nplayer/public-goods/",
];

test("every static route is same-origin, CSP-protected, and accessible", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? "http://127.0.0.1:4002").origin;
  const offOriginRequests: string[] = [];
  const cspErrors: string[] = [];

  page.on("request", (request) => {
    const url = request.url();
    if (new URL(url).origin !== origin) {
      offOriginRequests.push(url);
    }
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /content security policy|\bcsp\b/i.test(message.text())
    ) {
      cspErrors.push(message.text());
    }
  });

  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.ok(), `route should load: ${route}`).toBeTruthy();
    expect(response?.headers()["content-security-policy"]).toContain(
      "default-src 'self'",
    );
    await expect(page.getByRole("main")).toBeVisible();
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(
      accessibilityScanResults.violations,
      `axe violations on ${route}`,
    ).toEqual([]);
  }

  expect(offOriginRequests).toEqual([]);
  expect(cspErrors).toEqual([]);
});

test("the primary routes can be opened with the keyboard", async ({ page }) => {
  const routes = [
    { name: "Play", heading: "Prisoner's Dilemma" },
    {
      name: "Evolve",
      heading: "A finite tournament of repeatable strategies.",
    },
    { name: "Build", heading: "Shape the incentives." },
    { name: "Methods", heading: "Correctness is the product." },
  ];

  for (const [index, route] of routes.entries()) {
    await page.goto("/");

    for (let tab = 0; tab < index + 2; tab += 1) {
      await page.keyboard.press("Tab");
    }

    await expect(
      page.getByRole("link", { name: route.name, exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();
  }
});

test("the exported game route works as a direct deep link", async ({
  page,
}) => {
  await page.goto("/play/pd/");
  await expect(
    page.getByRole("heading", { name: "Prisoner's Dilemma" }),
  ).toBeVisible();
});

test("the PD session completes keyboard-only and stays accessible", async ({
  page,
}) => {
  await page.goto("/play/pd/");

  const arena = page.locator(".pd-session");
  const holdPrice = page.getByRole("button", {
    name: "Hold price (key 1)",
  });
  await holdPrice.focus();

  for (let round = 1; round <= 10; round += 1) {
    await page.keyboard.press("1");
    await expect(arena).toHaveAttribute("data-round", String(round));

    if (round < 10) {
      await expect(holdPrice).toBeFocused();
    }
  }

  await expect(page.getByRole("button", { name: "Play again" })).toBeFocused();
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("the PD outcome highlight has a static reduced-motion path", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/pd/");

  const holdPrice = page.getByRole("button", {
    name: "Hold price (key 1)",
  });
  await holdPrice.focus();
  await page.keyboard.press("1");

  const outcome = page.getByTestId("matrix-cell-0-0");
  await expect(outcome).toHaveAttribute("data-highlight", "current");
  await expect(outcome).toHaveCSS("transition-duration", "0s");
});

test("the PD analysis drawer is keyboard-operable and accessible", async ({
  page,
}) => {
  await page.goto("/play/pd/");

  const holdPrice = page.getByRole("button", {
    name: "Hold price (key 1)",
  });
  await holdPrice.focus();

  for (let round = 0; round < 3; round += 1) {
    await page.keyboard.press("1");
    await expect(page.locator(".pd-session")).toHaveAttribute(
      "data-round",
      String(round + 1),
    );
  }

  const drawer = page.locator(".analysis-drawer");
  const summary = drawer.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(drawer).toHaveAttribute("open", "");

  const firstElimination = page.getByRole("button", {
    name: "Show elimination 1 of 2",
  });
  await firstElimination.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Step 1: You: Undercut eliminates Hold price."),
  ).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("each P5 one-shot game completes by keyboard and remains accessible", async ({
  page,
}) => {
  const games = [
    { route: "/play/stag-hunt/", button: "Stag (key 1)", rounds: 10 },
    {
      route: "/play/battle-of-the-sexes/",
      button: "Yours (key 1)",
      rounds: 10,
    },
    { route: "/play/chicken/", button: "Swerve (key 1)", rounds: 10 },
    {
      route: "/play/matching-pennies/",
      button: "Heads (key 1)",
      rounds: 20,
    },
  ];

  for (const game of games) {
    await page.goto(game.route);
    const choice = page.getByRole("button", { name: game.button });
    await choice.focus();

    for (let round = 1; round <= game.rounds; round += 1) {
      await page.keyboard.press("1");
      await expect(page.locator(".one-shot-session")).toHaveAttribute(
        "data-round",
        String(round),
      );
    }

    await expect(
      page.getByRole("button", { name: "Play again" }),
    ).toBeFocused();
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  }
});

test("the IPD mystery flow reveals its strategy and seeded counterfactual", async ({
  page,
}) => {
  await page.goto("/play/iterated-pd/");
  await page.getByLabel("Choose IPD rival").selectOption("mystery");
  await expect(
    page.getByText(
      "Identity stays hidden until the reveal. The seeded environment is already fixed.",
    ),
  ).toBeVisible();

  const session = page.locator(".ipd-session");
  const cooperate = page.getByRole("button", { name: "Cooperate (key 1)" });
  await cooperate.focus();

  for (let round = 0; round < 100; round += 1) {
    if (
      await page
        .getByRole("button", { name: "Play again" })
        .isVisible()
        .catch(() => false)
    ) {
      break;
    }

    const before = await session.getAttribute("data-round");
    await page.keyboard.press("1");
    await expect(session).not.toHaveAttribute("data-round", before ?? "");
  }

  await expect(page.getByRole("button", { name: "Play again" })).toBeFocused();
  await expect(
    page.getByText(/Tit for Tat in your seat would have scored/),
  ).toBeVisible();
  await expect(page.getByLabel(/state diagram/)).toBeVisible();
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("the hot-seat game conceals Player 1's move and completes by keyboard", async ({
  page,
}) => {
  await page.goto("/hot-seat/pd/");
  await expect(
    page.getByRole("heading", { name: "Prisoner's Dilemma" }),
  ).toBeVisible();

  const session = page.locator(".hot-seat-session");

  for (let round = 1; round <= 10; round += 1) {
    const p1Undercut = page.getByRole("button", {
      name: "Player 1: Undercut (key 2)",
    });
    await p1Undercut.focus();
    await page.keyboard.press("2");

    const handover = page.getByTestId("hot-seat-handover");
    await expect(handover).toBeVisible();
    await expect(handover).not.toContainText("Undercut");
    await page.getByRole("button", { name: "Player 2 is ready" }).click();

    await page
      .getByRole("button", { name: "Player 2: Undercut (key 2)" })
      .click();
    await expect(session).toHaveAttribute("data-round", String(round));
    await page
      .getByRole("button", { name: /Next round|See the analysis/ })
      .click();
  }

  await expect(session).toHaveAttribute("data-phase", "complete");
  await expect(page.getByRole("button", { name: "Play again" })).toBeFocused();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("the classroom builds an assignment link and aggregates a session file", async ({
  page,
}) => {
  await page.goto("/classroom/");
  await expect(
    page.getByRole("heading", { name: "Run it with a class." }),
  ).toBeVisible();

  const link = page.getByLabel("Assignment link", { exact: true });
  await expect(link).toHaveValue(/\/play\/pd\/\?/);

  const session = JSON.stringify({
    schema: "gt-sandbox/session",
    version: 1,
    kind: "hot-seat",
    game: "pd",
    title: "Prisoner's Dilemma",
    rowLabel: "Player 1",
    columnLabel: "Player 2",
    rounds: [
      {
        round: 1,
        rowAction: "a",
        columnAction: "b",
        rowPayoff: "4",
        columnPayoff: "4",
      },
    ],
    rowTotal: "4",
    columnTotal: "4",
  });
  await page.getByLabel("Add session files").setInputFiles({
    name: "student.json",
    mimeType: "application/json",
    buffer: Buffer.from(session),
  });
  await expect(page.getByTestId("classroom-aggregate")).toBeVisible();
  await expect(page.getByText(/1 session loaded/)).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("the second-price auction proves truthfulness and completes a session", async ({
  page,
}) => {
  await page.goto("/auctions/second-price/");
  await expect(
    page.getByRole("heading", { name: "Second-price sealed bid" }),
  ).toBeVisible();
  await expect(page.getByText(/weakly dominant/)).toBeVisible();

  for (let round = 1; round <= 8; round += 1) {
    await page.getByRole("button", { name: "Submit bid" }).click();
    await expect(page.getByTestId("auction-result")).toBeVisible();
    await page
      .getByRole("button", { name: /Next round|Finish session/ })
      .click();
  }

  await expect(page.getByRole("button", { name: "Play again" })).toBeFocused();
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("the common-value auction surfaces the winner's curse", async ({
  page,
}) => {
  await page.goto("/auctions/common-value/");
  await expect(
    page.getByText(/Bidding your own signal loses money/),
  ).toBeVisible();
});

test("the repeat surface shows the folk-theorem threshold and switches games", async ({
  page,
}) => {
  await page.goto("/repeat/");
  await expect(
    page.getByRole("heading", { name: "Iterate any game." }),
  ).toBeVisible();
  await expect(
    page.getByText(/continuation probability is at least 1\/2/),
  ).toBeVisible();

  await page.getByLabel("Stage game").selectOption("pennies");
  await expect(
    page.getByText(/Cooperation cannot be sustained here/),
  ).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("the tournament heatmap can be filtered and exposes its table fallback", async ({
  page,
}) => {
  await page.goto("/evolve/");

  await expect(
    page.getByRole("heading", {
      name: "A finite tournament of repeatable strategies.",
    }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Always Cooperate" }).click();
  await expect(
    page.getByRole("status", { name: "Tournament changes" }),
  ).toHaveText(
    "Always Cooperate removed from the tournament. 7 strategies selected.",
  );

  await page.getByText("View as an accessible data table").click();
  await expect(
    page.getByRole("table", {
      name: "Exact mean per-round payoff for each row strategy against each column strategy.",
    }),
  ).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("the evolution trajectory is keyboard-operable, reduced-motion safe, and narrow-screen accessible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/evolve/");

  await page.getByRole("tab", { name: "Evolution" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Population shares under a fixed environment",
    }),
  ).toBeVisible();

  const scrubber = page.getByRole("slider", { name: "Generation scrubber" });
  await expect(scrubber).toHaveValue("0");
  await scrubber.focus();
  await page.keyboard.press("End");
  await expect(scrubber).toHaveValue("100");
  await expect(
    page.locator('[aria-label="Population at generation 100"]'),
  ).toBeVisible();

  await page
    .getByText("View each generation as an accessible data table")
    .click();
  await expect(
    page.getByRole("table", {
      name: "Population share at every generation for this seeded evolution run.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("a bounded evolution URL restores its complete seeded configuration", async ({
  page,
}) => {
  await page.goto(
    "/evolve/?ev=1&s=alld%2Ctft&x=0.2%2C0.8&d=0.9&n=0.05&r=10&seed=42&cap=400&g=80",
  );
  await page.getByRole("tab", { name: "Evolution" }).click();

  await expect(
    page.getByRole("slider", { name: "Continuation probability" }),
  ).toHaveValue("0.9");
  await expect(page.getByRole("slider", { name: "Action noise" })).toHaveValue(
    "0.05",
  );
  await expect(page.getByLabel("Evolution seed")).toHaveValue("42");
  await expect(
    page.getByRole("slider", { name: "Generation scrubber" }),
  ).toHaveAttribute("max", "80");
});

test("a PD play share link restores the encoded persona and seed", async ({
  page,
}) => {
  const search =
    "?v=1&title=Prisoner%27s+Dilemma&row=Cooperate&row=Defect&col=Cooperate&col=Defect&p=3%2C3%3B0%2C5%3B5%2C0%3B1%2C1&persona=always%3AD&seed=1234567";
  await page.goto(`/play/pd/${search}`);

  const rivalSelect = page.getByLabel("Choose rival");
  await expect(rivalSelect).toHaveValue("always:D");
  await expect(page.getByText(/Cynic/).first()).toBeVisible();
});

test("a canonical payoff edit changes the game structure and survives a direct link", async ({
  page,
}) => {
  await page.goto("/play/pd/");
  const workbench = page.getByTestId("game-workbench");

  await workbench.getByLabel("Your payoff for row 2, column 1").fill("2");
  await workbench.getByLabel("Rival payoff for row 1, column 2").fill("2");
  await expect(
    workbench.getByRole("heading", {
      name: "This is a coordination (assurance) game.",
    }),
  ).toBeVisible();
  await expect(workbench.locator(".game-workbench__badges em")).toHaveCount(2);
  await expect(page).toHaveURL(/\?v=1&/);

  const sharedUrl = page.url();
  await page.goto(sharedUrl);
  await expect(
    page.getByTestId("game-workbench").getByRole("heading", {
      name: "This is a coordination (assurance) game.",
    }),
  ).toBeVisible();
});

test("the 4×4 editor contains wide labels at narrow width and 200% zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/build/");
  await page.getByLabel("Number of row actions").selectOption("4");
  await page.getByLabel("Number of column actions").selectOption("4");
  await page.getByLabel("Row action 4").fill("R".repeat(40));
  await page.getByLabel("Column action 4").fill("C".repeat(40));
  await expect(
    page.getByLabel("Rival payoff for row 4, column 4"),
  ).toBeVisible();

  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".game-workbench__matrix-scroll")
      .evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("the launch home remembers its single onboarding preference", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Choose first. Open Analysis second." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Choose first. Open Analysis second." }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(window.localStorage))).toEqual([
    "seenOnboarding",
  ]);
});

test("key launch surfaces retain visible state in forced colors", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/play/pd/");
  const holdPrice = page.getByRole("button", { name: "Hold price (key 1)" });
  await holdPrice.click();
  await expect(page.getByTestId("matrix-cell-0-0")).toHaveAttribute(
    "data-highlight",
    "current",
  );
  await expect(page.getByTestId("matrix-cell-0-0")).toHaveCSS(
    "outline-style",
    "solid",
  );
});

test("unknown game slugs serve the exported not-found page", async ({
  page,
}) => {
  const response = await page.goto("/play/unknown/");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This payoff does not exist." }),
  ).toBeVisible();
});

test("the finite-population tab computes exact fixation and stays accessible", async ({
  page,
}) => {
  await page.goto("/evolve/");
  await page.getByRole("tab", { name: "Finite population" }).click();
  await expect(
    page.getByRole("heading", {
      name: "In a small population, luck outranks fitness.",
    }),
  ).toBeVisible();

  // Stag Hunt at N = 20: ESS calls both stable, yet Hare is favoured.
  await expect(page.getByTestId("finite-disagreement")).toBeVisible();

  // Neutral drift must land on exactly 1/N with no selection pressure.
  await page.getByLabel("Game").selectOption("neutral");
  const size = page.getByRole("slider", { name: /Population size/ });
  await size.fill("8");
  await expect(page.getByTestId("finite-fixation")).toContainText("1/8");
  await expect(page.getByTestId("finite-disagreement")).toHaveCount(0);

  await page
    .getByText("View the fixation curve as an accessible data table")
    .click();
  await expect(
    page.getByRole("table", { name: /Exact fixation probability for Red/ }),
  ).toBeVisible();

  // Long exact rationals must not push the page horizontally.
  await page.getByLabel("Game").selectOption("stag-hunt");
  await size.fill("60");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("the public-goods surface prices free-riding and exposes the dilemma window", async ({
  page,
}) => {
  await page.goto("/nplayer/public-goods/");
  await expect(
    page.getByRole("heading", {
      name: "Everyone gains if everyone gives. Nobody gains by giving.",
    }),
  ).toBeVisible();

  // Default N=4, MPCR=2/5, half contributors → pot 15, free-ride pays 16.
  await page.getByRole("button", { name: "0", exact: true }).click();
  await expect(page.getByTestId("pg-narration")).toContainText(
    "the pot held 15",
  );
  await expect(page.getByTestId("pg-narration")).toContainText(
    "You earned 16.",
  );

  const drawer = page.locator(".analysis-drawer");
  await drawer.locator("summary").click();
  await expect(page.getByText(/sits inside the dilemma window/)).toBeVisible();

  await page.getByRole("button", { name: "Show the exact sweep" }).click();
  await expect(
    page.getByRole("table", {
      name: /Your payoff and total welfare at every contribution/,
    }),
  ).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("entry deterrence plays through both incumbent policies and reveals SPNE", async ({
  page,
}) => {
  await page.goto("/extensive/entry-deterrence/");
  await expect(
    page.getByRole("heading", { name: "Entry Deterrence" }),
  ).toBeVisible();

  const session = page.locator(".extensive-session");
  // Rational Incumbent → In should land on the accommodate terminal, payoffs (1, 1).
  await page.getByRole("button", { name: "In", exact: true }).click();
  await expect(session).toHaveAttribute("data-round", "1");
  await expect(page.getByText(/Outcome: Entrant 1, Incumbent 1/)).toBeVisible();

  // Open analysis; SPNE headline is present.
  const drawer = page.locator(".analysis-drawer");
  await drawer.locator("summary").click();
  await expect(drawer).toHaveAttribute("open", "");
  await expect(
    page.getByText(/Backward induction predicts entry/),
  ).toBeVisible();

  // Reset; switch to Committed Incumbent; enter and get punished.
  await page.getByRole("button", { name: "Play again" }).click();
  await page.getByRole("radio", { name: /Committed Incumbent/ }).check();
  await page.getByRole("button", { name: "In", exact: true }).click();
  await expect(
    page.getByText(/Outcome: Entrant -1, Incumbent -1/),
  ).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
