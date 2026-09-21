import { expect, test, type Page } from "@playwright/test";

async function session(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("medpath.accessToken", "isolated-browser-test"),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { data: [] };
    if (path.endsWith("/profile/me"))
      body = {
        data: {
          user: { _id: "507f1f77bcf86cd799439011", name: "Student", role: "student" },
          profile: null,
        },
      };
    if (path.endsWith("/dashboard/overview"))
      body = {
        data: {
          isPremium: false,
          savedColleges: [
            {
              collegeId: {
                _id: "507f1f77bcf86cd799439012",
                name: "Published college",
                city: "Pune",
                state: "Maharashtra",
                ownership: "govt",
                feeMerit: null,
                feePrivate: null,
                closingRank: null,
              },
            },
          ],
          downloads: [],
          recentActivity: [],
          nextDeadline: null,
        },
      };
    await route.fulfill({ json: body });
  });
}

test("notification body, pagination and failed mark-read requests remain honest", async ({
  page,
}) => {
  await session(page);
  let failRead = true;
  await page.route("**/api/v1/notifications**", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: failRead ? 503 : 200,
        json: failRead ? { message: "Unavailable" } : { success: true },
      });
      return;
    }
    const current = new URL(route.request().url()).searchParams.get("page") || "1";
    await route.fulfill({
      json: {
        data: [
          {
            _id: "507f1f77bcf86cd799439015",
            title: `Notice ${current}`,
            body: "Check the official admission notice before applying.",
            createdAt: "2026-09-01T09:00:00Z",
            type: "general",
            isRead: false,
          },
        ],
        pagination: { totalPages: 2 },
      },
    });
  });
  await page.goto("/notifications");
  await expect(
    page.getByText("Check the official admission notice before applying."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText("Could not sync with server")).toBeVisible();
  await expect(page.getByText(/1 unread/)).toBeVisible();
  failRead = false;
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText(/0 unread/)).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Notice 2", { exact: true })).toBeVisible();
});

test("dashboard preserves unpublished fees and uses real section navigation without invented match badges", async ({
  page,
}) => {
  await session(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Published college", { exact: true })).toBeVisible();
  await expect(page.getByText("Fees: N/A", { exact: true })).toBeVisible();
  await expect(page.getByText(/^(Dream|Target|Safe)$/)).toHaveCount(0);
  await page.getByRole("link", { name: "Saved colleges", exact: true }).click();
  await expect(page).toHaveURL(/#saved-colleges$/);
});

for (const width of [360, 768]) {
  test(`public navigation, forms and payment layout fit ${width}px screens`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await session(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/v1/cutoffs?**", (route) =>
      route.fulfill({
        json: { data: [], totalCount: 0, lockedCount: 0, isPremium: false, page: 1, limit: 20 },
      }),
    );
    await page.route("**/api/v1/billing/plans", (route) =>
      route.fulfill({
        json: {
          data: [
            {
              _id: "507f1f77bcf86cd799439022",
              name: "Season Pass",
              price: 99,
              durationDays: 120,
              features: ["Published cutoff access"],
            },
          ],
        },
      }),
    );
    await page.goto("/dashboard");
    await expect(page.getByText("Published college", { exact: true })).toBeVisible();
    for (const label of [
      "Cutoffs",
      "AI seat match",
      "Counselling",
      "Compare",
      "Plans & payment",
      "Notifications",
      "Dashboard",
    ]) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.locator("header").getByRole("link", { name: label, exact: true }).last().click();
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      if (label === "Plans & payment") {
        await expect(page.getByText("Published cutoff access", { exact: true })).toBeVisible();
        await page.screenshot({ path: `test-results/payment-mobile-${width}.png`, fullPage: true });
      }
    }
    expect(errors).toEqual([]);
    await page.goto("/login");
    await expect(page.getByPlaceholder("98765 43210")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: "Create your account", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
  });
}
