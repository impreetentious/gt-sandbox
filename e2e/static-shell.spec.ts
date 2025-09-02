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
  "/evolve/",
  "/build/",
  "/methods/",
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
  }

  expect(offOriginRequests).toEqual([]);
  expect(cspErrors).toEqual([]);

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
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

test("unknown game slugs serve the exported not-found page", async ({
  page,
}) => {
  const response = await page.goto("/play/unknown/");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This payoff does not exist." }),
  ).toBeVisible();
});
