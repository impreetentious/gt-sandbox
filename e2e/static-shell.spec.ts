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
    { name: "Evolve", heading: "Watch a strategy population change." },
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

test("unknown game slugs serve the exported not-found page", async ({
  page,
}) => {
  const response = await page.goto("/play/unknown/");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This payoff does not exist." }),
  ).toBeVisible();
});
