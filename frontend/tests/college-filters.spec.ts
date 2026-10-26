import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";
const { courses } = createRequire(import.meta.url)("../../backend/src/data/medicalCourses.js") as {
  courses: { name: string; slug: string; discipline: string }[];
};

async function openColleges(page: Page) {
  const calls: URL[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    calls.push(url);
    let body: unknown = { data: [] };
    if (url.pathname === "/api/v1/courses") body = { data: courses };
    if (url.pathname.endsWith("/categories")) body = { data: ["SOURCE-CUSTOM / W"] };
    if (url.pathname === "/api/v1/colleges") {
      const currentPage = Number(url.searchParams.get("page") || 1);
      body = {
        data: [
          {
            _id: "000000000000000000000001",
            name: `Published nursing college, page ${currentPage}`,
            city: "Ahmedabad",
            state: "Gujarat",
            ownership: "private",
            courses: ["B.Sc. Nursing", "GNM", "ANM", "B.Pharm"],
            seats: 60,
            feeMerit: null,
            feePrivate: null,
            feeFrom: null,
            closingRank: null,
          },
        ],
        pagination: { total: 25, page: currentPage, totalPages: 2, limit: 24 },
      };
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/login");
  await page.getByPlaceholder("98765 43210").fill("9876543210");
  await expect(page.getByRole("button", { name: "Send OTP", exact: true })).toBeEnabled();
  await page.getByRole("link", { name: "Back to browsing" }).click();
  await page.getByRole("link", { name: "Colleges", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Colleges", exact: true })).toBeVisible();
  return calls;
}

for (const [years, penalty, expectedYears, expectedPenalty] of [
  [null, null, "N/A", "N/A"],
  [1, null, "1 year", "N/A"],
  [null, 1000000, "N/A", "₹10,00,000"],
  [0, 0, "No bond", "₹0"],
] as const) {
  test(`college bond display distinguishes ${years}/${penalty} from zero`, async ({ page }) => {
    await openColleges(page);
    await page.route("**/api/v1/colleges/000000000000000000000001", async (route) => {
      await route.fulfill({
        json: {
          data: {
            college: {
              _id: "000000000000000000000001",
              name: "Published nursing college",
              city: "Ahmedabad",
              state: "Gujarat",
              ownership: "private",
              courses: ["B.Sc. Nursing"],
              seats: 60,
              bondYears: years,
              bondPenalty: penalty,
              bondPublished: true,
            },
            cutoffs: { locked: false, rows: [], lockedCount: 0 },
          },
        },
      });
    });
    await page
      .getByRole("link", { name: "Published nursing college, page 1", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Published nursing college", exact: true }),
    ).toBeVisible();
    for (const [label, expected] of [
      ["Service bond", expectedYears],
      ["Bond penalty", expectedPenalty],
    ]) {
      await expect(
        page.locator("dt").filter({ hasText: label }).locator("..").locator("dd"),
      ).toHaveText(expected);
    }
  });
}

for (const amount of [null, 0]) {
  test(`college detail displays ${amount === null ? "N/A for unknown fees" : "zero for confirmed free fees"}`, async ({
    page,
  }) => {
    await openColleges(page);
    await page.route("**/api/v1/colleges/000000000000000000000001", async (route) => {
      await route.fulfill({
        json: {
          data: {
            college: {
              _id: "000000000000000000000001",
              name: "Published nursing college",
              city: "Ahmedabad",
              state: "Gujarat",
              ownership: "private",
              courses: ["B.Sc. Nursing"],
              seats: 60,
              feeMerit: amount,
              feePrivate: amount,
              feeFrom: amount,
              hostelMess: amount,
              hostelFeePublished: amount !== null,
            },
            cutoffs: { locked: false, rows: [], lockedCount: 0 },
          },
        },
      });
    });
    await page
      .getByRole("link", { name: "Published nursing college, page 1", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Published nursing college", exact: true }),
    ).toBeVisible();
    for (const label of [
      "State merit fee / yr",
      "Private / management fee / yr",
      "Hostel + mess / yr",
    ]) {
      const row = page.locator("dt").filter({ hasText: label }).locator("..").locator("dd");
      await expect(row).toHaveText(amount === null ? "N/A" : "₹0");
    }
    if (amount === null) {
      await page.getByRole("button", { name: "Facilities", exact: true }).click();
      await page.evaluate(() => {
        const banner = document.createElement("div");
        banner.textContent =
          "LOCAL EXAMPLE ONLY — Sample college, 60 total seats, fees unavailable. Round-wise seat matrix is not connected to this page yet.";
        banner.style.cssText =
          "padding:18px 24px;background:#fff4ce;color:#172a40;font:600 15px/1.5 sans-serif;text-align:center;border-bottom:1px solid #e2c16a";
        document.body.prepend(banner);
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await page.screenshot({
        path: "test-results/college-seats-fees-example.png",
        fullPage: true,
      });
    }
  });
}

test("all 50 courses and all states/UTs are available on mobile with the restored theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openColleges(page);
  const course = page.getByRole("combobox", { name: "Course", exact: true });
  await expect(course).toBeVisible();
  await expect(course.locator("option")).toHaveCount(courses.length + 1);
  await expect(course.locator("optgroup")).toHaveCount(9);
  const state = page.getByRole("combobox", { name: "State / UT", exact: true });
  await expect(state).toBeVisible();
  await expect(state.locator("option")).toHaveCount(37);
  await state.selectOption("Dadra and Nagar Haveli and Daman and Diu");
  await expect(state).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-teal-600").trim(),
    ),
  ).toBe("#0e8c86");
  await expect(page.getByText("Fees: N/A", { exact: true })).toBeVisible();
  await expect(page.getByText("Not published", { exact: true })).toBeVisible();
  await expect(page.getByText("B.Pharm", { exact: true }).last()).toBeVisible();
});

test("course, state, category, quota, fee and search reach the API; paging and back retain filters", async ({
  page,
}) => {
  const calls = await openColleges(page);
  const select = async (name: string, value: string) => {
    const input = page.getByRole("combobox", { name, exact: true });
    await expect(input).toBeEnabled();
    await input.selectOption(value);
    await expect(
      page.getByRole("status").filter({ hasText: "25 matching colleges" }),
    ).toBeVisible();
    await expect(input).toHaveValue(value);
  };
  await select("Course", "bsc-nursing");
  await select("State / UT", "Gujarat");
  await select("Category", "OBC");
  await select("Quota", "Management");
  await select("Annual tuition", "₹1–5 lakh");
  await page.getByRole("textbox", { name: "Search colleges" }).fill("Nursing West");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/search=Nursing/);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("link", { name: "Published nursing college, page 2" })).toBeVisible();
  const latest = calls.filter((call) => call.pathname === "/api/v1/colleges").at(-1)!;
  expect(Object.fromEntries(latest.searchParams)).toMatchObject({
    course: "bsc-nursing",
    state: "Gujarat",
    category: "OBC",
    quota: "Management",
    minFee: "100000",
    maxFee: "500000",
    search: "Nursing West",
    page: "2",
    limit: "24",
  });
  await page.goBack();
  await expect(page.getByRole("link", { name: "Published nursing college, page 1" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Course", exact: true })).toHaveValue(
    "bsc-nursing",
  );
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Course", exact: true })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "State / UT", exact: true })).toHaveValue(
    "All states / UTs",
  );
});

test("published source categories appear in college and cutoff filters without losing their exact code", async ({
  page,
}) => {
  const calls = await openColleges(page);
  const category = page.getByRole("combobox", { name: "Category", exact: true });
  await expect(category.locator('option[value="SOURCE-CUSTOM / W"]')).toHaveCount(1);
  await category.selectOption("SOURCE-CUSTOM / W");
  await expect(
    page.getByRole("link", { name: "Published nursing college, page 1", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      calls
        .filter((call) => call.pathname === "/api/v1/colleges")
        .at(-1)
        ?.searchParams.get("category"),
    )
    .toBe("SOURCE-CUSTOM / W");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Published nursing college, page 2", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(category).toHaveValue("SOURCE-CUSTOM / W");
  await page.route("**/api/v1/cutoffs?**", async (route) => {
    calls.push(new URL(route.request().url()));
    await route.fulfill({
      json: { data: [], totalCount: 0, lockedCount: 0, isPremium: false, page: 1, limit: 20 },
    });
  });
  await page.getByRole("link", { name: "Cutoffs", exact: true }).first().click();
  await expect(category.locator('option[value="SOURCE-CUSTOM / W"]')).toHaveCount(1);
  await category.selectOption("SOURCE-CUSTOM / W");
  await expect
    .poll(() =>
      calls
        .filter((call) => call.pathname === "/api/v1/cutoffs")
        .at(-1)
        ?.searchParams.get("category"),
    )
    .toBe("SOURCE-CUSTOM / W");
  await page.route("**/api/v1/cutoffs/categories", async (route) => {
    await route.fulfill({ json: { data: ["SOURCE-CUSTOM / W", "NEWLY PUBLISHED"] } });
  });
  await page.getByRole("button", { name: "Refresh cutoffs", exact: true }).click();
  await expect(category.locator('option[value="NEWLY PUBLISHED"]')).toHaveCount(1);
});

test("cutoff page provides premium pagination and state filtering, with recoverable errors", async ({
  page,
}) => {
  await openColleges(page);
  let fail = false;
  const calls: URL[] = [];
  await page.route("**/api/v1/cutoffs?**", async (route) => {
    const url = new URL(route.request().url());
    calls.push(url);
    if (fail) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
    const currentPage = Number(url.searchParams.get("page") || 1);
    await route.fulfill({
      json: {
        isPremium: true,
        data: [
          {
            id: `row-${currentPage}`,
            collegeName: `Cutoff college page ${currentPage}`,
            courseName: "MBBS",
            category: "OBC",
            quota: "State",
            year: 2026,
            closingRank: 1000,
            seats: 10,
          },
        ],
        totalCount: 25,
        lockedCount: 0,
        page: currentPage,
        limit: 20,
      },
    });
  });
  await page.getByRole("link", { name: "Cutoffs", exact: true }).first().click();
  await expect(page.getByText("Cutoff college page 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Cutoff college page 2", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "State / UT", exact: true }).selectOption("Gujarat");
  await expect(page.getByText("Cutoff college page 1", { exact: true })).toBeVisible();
  expect(calls.at(-1)!.searchParams.get("state")).toBe("Gujarat");
  fail = true;
  await page.getByRole("combobox", { name: "Category", exact: true }).selectOption("OBC");
  await expect(page.getByRole("alert")).toContainText("Cutoffs could not load");
  fail = false;
  await page.getByRole("button", { name: "Retry cutoffs", exact: true }).click();
  await expect(page.getByText("Cutoff college page 1", { exact: true })).toBeVisible();
});
