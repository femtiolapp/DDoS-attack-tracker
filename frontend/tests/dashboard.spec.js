import { test, expect } from "@playwright/test";

test("switches between DDoS pairs and general HTTP countries without inventing destinations", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const http = url.pathname.includes("/traffic/");
    const series = url.searchParams.get("dataset").includes("timeseries");
    const row = http
      ? {
          ...pair,
          id: "http-country",
          sourceCountry: "US",
          targetCountry: null,
          targetLatitude: null,
          targetLongitude: null,
          value: 22.3,
          dataset: "http_locations",
          endpoint: "/radar/http/top/locations",
        }
      : pair;
    return route.fulfill({
      json: {
        status,
        total: series ? 0 : 1,
        observations: series ? [] : [row],
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("td.share-cell")).toContainText("12.50%");
  await page
    .getByRole("combobox", { name: "Traffic type" })
    .selectOption("http");
  await expect(
    page.getByRole("columnheader", { name: "CLIENT COUNTRY", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "BILLING TARGET" }),
  ).toHaveCount(0);
  await expect(page.locator("td.share-cell")).toContainText("22.30%");
  await expect(
    page.getByRole("button", { name: "Toggle country-pair arcs" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Toggle country-pair arcs" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("combobox", { name: "Billing target country" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "HTTP details for United States" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Client country; no destination data",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.screenshot({
    path: "test-results/http-traffic-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Traffic type" })
    .selectOption("ddos");
  await expect(page.locator("td.share-cell")).toContainText("12.50%");
  await expect(
    page.getByRole("columnheader", { name: "BILLING TARGET" }),
  ).toBeVisible();
});

const status = {
  status: "ok",
  mode: "demo",
  dataStatus: "recently_fetched",
  lastSuccessfulUpdate: "2026-10-23T12:00:00Z",
  error: null,
};
const pair = {
  id: "test-pair",
  sourceCountry: "DE",
  targetCountry: "US",
  sourceLatitude: 51.16,
  sourceLongitude: 10.45,
  targetLatitude: 39.8,
  targetLongitude: -98.5,
  windowStart: "2026-10-22T12:00:00Z",
  windowEnd: "2026-10-23T12:00:00Z",
  timestamp: "2026-10-23T12:00:00Z",
  collectedAt: "2026-10-23T12:00:00Z",
  upstreamUpdatedAt: "2026-10-23T10:30:00Z",
  value: 12.5,
  metricType: "percentage",
  dataSource: "demo",
  dataset: "pairs",
  endpoint: "/radar/attacks/layer7/top/attacks",
  metadata: {
    dateRange: [
      { startTime: "2026-10-22T12:00:00Z", endTime: "2026-10-23T12:00:00Z" },
    ],
  },
};

async function mock(page, empty = false) {
  await page.route("**/api/attacks/**", (route) => {
    const url = new URL(route.request().url()),
      rows =
        url.searchParams.get("dataset") === "timeseries"
          ? []
          : empty
            ? []
            : [pair];
    return route.fulfill({
      json: { status, total: rows.length, observations: rows },
    });
  });
}

test("serves real cached backend data through the proxy and renders the globe", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  const response = await page.request.get("/api/attacks/latest");
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.observations.length).toBeGreaterThan(0);
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("3D view unavailable")).toHaveCount(0);
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("demo labeling, filters, detail dialog, export and display controls", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/");
  await expect(page.getByText("DEMO MODE", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Origin country", exact: true })
    .selectOption("DE");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("spinbutton", { name: "Minimum reported pair share" })
    .fill("13");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page
    .getByRole("button", { name: "Details for Germany to United States" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("12.50%", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toContain("demo");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByLabel("Show country-pair arcs").uncheck();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("button", { name: "Toggle country-pair arcs" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Expand globe" }).click();
  await expect(page.locator(".globe-expanded")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".globe-expanded")).toHaveCount(0);
});

test("empty datasets and mobile layout remain usable", async ({ page }) => {
  await mock(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByText("No geographic observations available", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export JSON" }),
  ).toBeDisabled();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll("main *")]
      .filter(
        (el) =>
          el.getBoundingClientRect().right > 390 &&
          el.getBoundingClientRect().width > 10,
      )
      .map((el) => ({
        tag: el.tagName,
        className: typeof el.className === "string" ? el.className : "",
        width: Math.round(el.getBoundingClientRect().width),
      }))
      .slice(0, 15),
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
    JSON.stringify(overflow),
  ).toBeLessThanOrEqual(390);
});

test("historical window selection and connection interruption preserve context", async ({
  page,
}) => {
  let fail = false;
  const earlier = {
    ...pair,
    id: "earlier",
    value: 4,
    metadata: {
      dateRange: [
        { startTime: "2026-10-21T12:00:00Z", endTime: "2026-10-22T12:00:00Z" },
      ],
    },
  };
  await page.route("**/api/attacks/**", (route) => {
    if (fail)
      return route.fulfill({ status: 503, body: "Temporarily unavailable" });
    const url = new URL(route.request().url());
    const rows =
      url.searchParams.get("dataset") === "timeseries"
        ? []
        : url.pathname.endsWith("history")
          ? [pair, earlier]
          : [pair];
    return route.fulfill({
      json: { status, total: rows.length, observations: rows },
    });
  });
  await page.goto("/");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("combobox", { name: "History range" }).selectOption("7");
  await expect(
    page.getByRole("combobox", { name: "Published window" }).locator("option"),
  ).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Published window" })
    .selectOption({ index: 1 });
  await expect(page.locator("td.share-cell")).toContainText("4.00%");
  fail = true;
  await page.getByRole("button", { name: "Refresh data" }).click();
  await expect(page.getByRole("alert")).toContainText("HTTP 503");
  await expect(page.locator("td.share-cell")).toContainText("4.00%");
});
