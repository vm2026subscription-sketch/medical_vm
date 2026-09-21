import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const collegeId = "507f1f77bcf86cd799439012";
async function fixture(
  page: Page,
  role: "admin" | "student" = "admin",
  loggedIn = true,
  editor = false,
  needsCorrection = false,
) {
  if (loggedIn)
    await page.addInitScript(() => {
      localStorage.setItem("medpath.accessToken", "test-access");
      localStorage.setItem("medpath.refreshToken", "test-refresh");
    });
  const user = {
    id: "507f1f77bcf86cd799439011",
    _id: "507f1f77bcf86cd799439011",
    name: "Test Admin",
    role,
  };
  const college = {
    _id: collegeId,
    name: "Example Medical College",
    city: "Pune",
    state: "Maharashtra",
    ownership: "govt",
    isActive: true,
    nmcApproved: true,
    images: [] as string[],
  };
  const calls: string[] = [];
  const sample = {
    collegeCode: "COL-001",
    name: "Example Medical College",
    city: "Pune",
    state: "Maharashtra",
    ownership: "govt",
    images: "https://example.com/existing.png",
  };
  const batch = {
    _id: "507f1f77bcf86cd799439099",
    entity: "colleges",
    source: "Official source",
    filename: "colleges.csv",
    fileId: "507f1f77bcf86cd799439098",
    status: "draft",
    revision: 0,
    headers: Object.keys(sample),
    mapping: Object.fromEntries(Object.keys(sample).map((k) => [k, k])),
    defaults: {},
    totals: { total: 1 },
    createdAt: new Date().toISOString(),
  };
  let created = false;
  let validationCount = 0;
  let mapped: Record<string, string> = { ...sample };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/api/v1", "");
    calls.push(`${req.method()} ${path}${url.search}`);
    let body: unknown = { success: true, data: [] };
    if (path === "/profile/me") body = { data: { user, profile: null } };
    else if (path === "/dashboard/overview")
      body = {
        data: {
          isPremium: false,
          savedColleges: [],
          recentActivity: [],
          downloads: [],
          nextDeadline: null,
        },
      };
    else if (path === "/auth/otp/request") body = { data: { sent: true } };
    else if (path === "/auth/otp/verify")
      body = { data: { user, accessToken: "test-access", refreshToken: "test-refresh" } };
    else if (path === "/admin/session")
      body = {
        data: {
          role: editor ? "data_editor" : "super_admin",
          permissions: editor ? ["imports:write"] : ["*"],
        },
      };
    else if (path === "/admin/analytics/dashboard")
      body = {
        data: {
          generatedAt: new Date().toISOString(),
          totals: { revenue: 198, students: 2, bookings: 1, activeSubscriptions: 2 },
          catalog: {
            colleges: 1,
            activeColleges: 1,
            missingImages: 1,
            links: 1,
            fees: 1,
            cutoffs: 1,
            seats: 1,
            courses: 1,
            missingFees: 0,
            missingCutoffs: 0,
          },
          series: [{ date: "2026-09-11", revenue: 198, students: 2, bookings: 1 }],
          states: [{ _id: "Maharashtra", count: 1 }],
          paymentStatus: [{ _id: "paid", count: 2 }],
        },
      };
    else if (path === "/colleges" || path === "/admin/catalog/colleges")
      body = { data: [college], pagination: { total: 1, page: 1, totalPages: 1 } };
    else if (path === "/admin/imports/meta")
      body = {
        data: [
          {
            entity: "colleges",
            fields: Object.entries(sample).map(([key, value]) => ({
              key,
              example: value,
              required: key !== "images",
              type: "text",
            })),
            sample,
          },
          ...Object.entries({
            "hostel-fees": { collegeCode: "COL-001", year: "2026", amount: "85000" },
            bonds: {
              collegeCode: "COL-001",
              courseSlug: "mbbs",
              years: "1",
              penaltyAmount: "1000000",
            },
            courses: { name: "MBBS", slug: "mbbs" },
            "college-courses": { collegeCode: "COL-001", courseSlug: "mbbs", totalSeats: "150" },
            fees: {
              collegeCode: "COL-001",
              courseSlug: "mbbs",
              year: "2026",
              tier: "merit",
              tuition: "100000",
              otherCharges: "15000",
              hostelMess: "85000",
            },
            "seat-matrix": {
              collegeCode: "COL-001",
              courseSlug: "mbbs",
              year: "2026",
              seats: "15",
            },
            cutoffs: {
              collegeCode: "COL-001",
              courseSlug: "mbbs",
              category: "General",
              quota: "State",
              authority: "MCC",
              round: "Round1",
              year: "2026",
              closingRank: "12345",
            },
          }).map(([entity, values]) => ({
            entity,
            sample: values,
            fields: Object.entries(values).map(([key, example]) => ({
              key,
              example,
              required: ![
                "tuition",
                "otherCharges",
                "hostelMess",
                "amount",
                "years",
                "penaltyAmount",
              ].includes(key),
              type: "text",
            })),
          })),
        ],
      };
    else if (path === "/admin/imports/templates/fees")
      body = {
        data: {
          filename: "fees-sample.xlsx",
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          base64: readFileSync(
            new URL("../../samples/imports/fees-sample.xlsx", import.meta.url),
          ).toString("base64"),
        },
      };
    else if (path === "/admin/imports/categories") body = { data: ["SOURCE-CUSTOM / W"] };
    else if (path === "/admin/imports/presets") body = { data: [] };
    else if (path === "/admin/imports/inspect")
      body = { data: { sheets: ["Data", "Instructions"], sheet: "Data", total: 1 } };
    else if (path === "/admin/imports/colleges")
      body = { data: { colleges: [{ ...college, importCode: "COL-001" }], page: 1, total: 1 } };
    else if (path === "/admin/imports")
      body = {
        data: {
          batches:
            created &&
            (!url.searchParams.get("status") || url.searchParams.get("status") === batch.status)
              ? [batch]
              : [],
          total: created ? 1 : 0,
          page: 1,
        },
      };
    else if (
      ["/admin/imports/upload", "/admin/imports/from-record", "/admin/imports/manual"].includes(
        path,
      )
    ) {
      created = true;
      if (path === "/admin/imports/manual") {
        const data = req.postDataJSON();
        batch.entity = data.entity;
        batch.filename = "Manual entry";
        mapped = data.input;
        batch.headers = Object.keys(data.input);
        batch.mapping = Object.fromEntries(batch.headers.map((key) => [key, key]));
      }
      body = { data: batch };
    } else if (path === `/admin/imports/${batch._id}`)
      body = {
        data: {
          batch,
          rows: [
            {
              row: 2,
              input: sample,
              ...(batch.status !== "draft" ? { mapped } : {}),
              errors:
                batch.status === "needs_correction" ? ["name: please check the college name"] : [],
              ...(batch.status !== "draft"
                ? {
                    prepared: {
                      action: "update",
                      before: { name: "Old name" },
                      document: mapped,
                      changedFields: ["name"],
                    },
                  }
                : {}),
            },
          ],
          page: 1,
        },
      };
    else if (path === `/admin/imports/${batch._id}/validate`) {
      const data = req.postDataJSON();
      mapped = { ...mapped, ...data.overrides?.["2"] };
      batch.status = needsCorrection && validationCount++ === 0 ? "needs_correction" : "ready";
      batch.revision++;
      batch.source = data.source ?? batch.source;
      batch.mapping = data.mapping;
      batch.defaults = data.defaults || {};
      body = { data: batch };
    } else if (path === `/admin/imports/${batch._id}/submit`) {
      batch.status = "submitted";
      batch.revision++;
      body = { data: batch };
    } else if (path === `/admin/imports/${batch._id}/publish`) {
      batch.status = "published";
      batch.revision++;
      body = { data: batch };
    } else if (path === `/admin/imports/${batch._id}/reject`) {
      batch.status = "rejected";
      batch.revision++;
      body = { data: batch };
    } else if (path === "/admin/imports/images")
      body = { data: { url: "https://example.com/campus.png" } };
    else if (path === "/admin/setup")
      body = { data: { cloudinary: true, email: false, sms: false, payments: true } };
    else if (path === "/admin/deadline") body = { data: null };
    else if (path === "/courses") body = { data: [{ slug: "mbbs", name: "MBBS" }] };
    await route.fulfill({ json: body });
  });
  return calls;
}

test("admin login redirects to overview and homepage navigation reflects the session", async ({
  page,
}) => {
  await fixture(page, "admin", false);
  await page.goto("/login");
  await page.getByPlaceholder("98765 43210").fill("9876543210");
  await page.getByRole("button", { name: "Send OTP" }).click();
  await page.locator('input[maxlength="6"]').fill("123456");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await expect(page.getByRole("heading", { name: "Your platform at a glance" })).toBeVisible();
  await expect(page.getByText("₹198", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/admin-overview.png", fullPage: true });
  await page.getByRole("link", { name: "View website" }).click();
  await expect(page).toHaveTitle(/MedPath by Vidyarthi Mitra/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://medical.vidyarthimitra.org/",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://medical.vidyarthimitra.org/brand/social-preview.png",
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.ico");
  await expect(
    page.locator("header").getByRole("link", { name: "MedPath by Vidyarthi Mitra", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Demo workspace" })).toHaveCount(0);
  await expect(page.getByText("Safe seats", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Explore colleges" })).toBeVisible();
  await expect(
    page.locator("header").getByRole("link", { name: "Admin", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByRole("link", { name: "Log in", exact: true }),
  ).toHaveCount(0);
  await page.locator("header").getByRole("button", { name: "Log out" }).click();
  await expect(page.locator("header").getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(
    page.locator("header").getByRole("link", { name: "Admin", exact: true }),
  ).toHaveCount(0);
});

test("dashboard photo count opens only published colleges without photos and clears on normal navigation", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: /Colleges without photos/ }).click();
  await expect(
    page.getByRole("heading", { name: "Colleges without photos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Example Medical College", exact: true }),
  ).toBeVisible();
  const lastQuery = () =>
    new URLSearchParams(
      calls
        .filter((call) => call.startsWith("GET /admin/catalog/colleges?"))
        .at(-1)
        ?.split("?")[1],
    );
  expect(lastQuery().get("missingImages")).toBe("true");
  expect(lastQuery().get("active")).toBe("true");
  await expect(page.getByRole("combobox", { name: "Publication filter" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit via draft", exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Admin sections" })
    .getByRole("button", { name: "Colleges & photos", exact: true })
    .click();
  await expect(page.getByRole("combobox", { name: "Publication filter" })).toBeVisible();
  await expect.poll(() => lastQuery().get("missingImages")).toBeNull();
});

for (const missing of ["fees", "cutoffs"] as const) {
  test(`dashboard missing ${missing} list retains search and paging, and prefills a reviewed entry on mobile`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fixture(page);
    const calls: URL[] = [];
    await page.route("**/api/v1/admin/catalog/college-courses?**", async (route) => {
      const url = new URL(route.request().url());
      calls.push(url);
      const current = Number(url.searchParams.get("page") || 1);
      const empty = url.searchParams.get("search") === "not-found";
      await route.fulfill({
        json: {
          data: empty
            ? []
            : [
                {
                  _id: "507f1f77bcf86cd799439088",
                  collegeId: {
                    _id: collegeId,
                    collegeCode: "COL-REMAIN",
                    name: `Remaining college page ${current}`,
                    city: "Pune",
                  },
                  courseId: { name: "MBBS", slug: "mbbs" },
                  totalSeats: 100,
                },
              ],
          pagination: { total: empty ? 0 : 21, page: current, totalPages: empty ? 1 : 2 },
        },
      });
    });
    await page.goto("/admin");
    await page.getByRole("button", { name: new RegExp(`Course links without ${missing}`) }).click();
    await expect(
      page.getByRole("cell", { name: "Remaining college page 1", exact: true }),
    ).toBeVisible();
    expect(calls.at(-1)?.searchParams.get("missingData")).toBe(missing);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: "Remaining college page 2", exact: true }),
    ).toBeVisible();
    expect(calls.at(-1)?.searchParams.get("missingData")).toBe(missing);
    await page.getByRole("textbox", { name: "Search records" }).fill("COL-REMAIN");
    await expect.poll(() => calls.at(-1)?.searchParams.get("search")).toBe("COL-REMAIN");
    await expect(
      page.getByRole("cell", { name: "Remaining college page 1", exact: true }),
    ).toBeVisible();
    expect(calls.at(-1)?.searchParams.get("page")).toBe("1");
    expect(calls.at(-1)?.searchParams.get("missingData")).toBe(missing);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.getByRole("textbox", { name: "Search records" }).fill("not-found");
    await expect(
      page.getByText("No matching records need attention. Clear the filter to view all records."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear attention filter", exact: true }).click();
    await expect.poll(() => calls.at(-1)?.searchParams.get("missingData")).toBeNull();
    await page
      .getByRole("navigation", { name: "Admin sections" })
      .getByRole("button", { name: "Overview", exact: true })
      .click();
    await page.getByRole("button", { name: new RegExp(`Course links without ${missing}`) }).click();
    await page
      .getByRole("button", { name: missing === "fees" ? "Add fees" : "Add cutoff", exact: true })
      .click();
    await expect(page.getByLabel("College code", { exact: false }).first()).toHaveValue(
      "COL-REMAIN",
    );
    await expect(page.getByRole("combobox", { name: "Course *", exact: true })).toHaveValue("mbbs");
    await expect(page.getByPlaceholder("e.g. MCC UG counselling 2026")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Check & preview", exact: true })).toBeVisible();
  });
}

test("student cannot render or request the admin console", async ({ page }) => {
  const calls = await fixture(page, "student");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
  expect(calls.some((call) => call.includes("/admin/"))).toBe(false);
});

test("spreadsheet becomes a draft and must be validated and submitted before publication", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Data entry", exact: true }).click();
  await page.getByRole("button", { name: /01 Colleges/ }).click();
  await expect(page.getByRole("button", { name: "Download sample Excel" })).toBeVisible();
  await page.getByPlaceholder("e.g. MCC UG counselling 2026").fill("Official source");
  await page.locator('input[type="file"]').setInputFiles({
    name: "colleges.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "collegeCode,name,city,state,ownership\nCOL-001,Example,Pune,Maharashtra,govt",
    ),
  });
  await expect(page.getByLabel("Worksheet")).toHaveValue("Data");
  await page.getByRole("button", { name: "Check & preview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Colleges preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve & publish", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Map name", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Send for approval" }).click();
  await page.getByRole("button", { name: "Review & publish", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Waiting for your approval" })).toBeVisible();
  await page.getByRole("button", { name: "Open entry" }).click();
  await page.getByRole("button", { name: "Approve & publish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Published.");
  expect(calls).toContain("POST /admin/imports/upload");
  expect(calls.some((c) => c.includes("bulk-import"))).toBe(false);
  await page.screenshot({ path: "test-results/import-review.png", fullPage: true });
});

test("college edits and photos stay in a draft until approval", async ({ page }) => {
  const calls = await fixture(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Colleges & photos", exact: true }).click();
  await page.getByRole("button", { name: "Edit via draft" }).click();
  await expect(page.getByRole("heading", { name: "Colleges preview" })).toBeVisible();
  await page.locator("summary").filter({ hasText: "Row 2" }).click();
  await page.getByLabel("Add college photo").setInputFiles({
    name: "campus.png",
    mimeType: "image/png",
    buffer: Buffer.from("mock image"),
  });
  await expect(page.getByRole("status")).toContainText("Photo uploaded");
  await page.locator("summary").filter({ hasText: "More details (optional)" }).click();
  await expect(page.getByLabel("Photo links", { exact: false })).toHaveValue(
    "https://example.com/existing.png|https://example.com/campus.png",
  );
  await page.getByRole("button", { name: "Save & check again" }).click();
  await expect(page.getByRole("button", { name: "Send for approval" })).toBeEnabled();
  expect(calls).toContain("POST /admin/imports/images");
  expect(calls.some((c) => c.includes("PATCH /admin/catalog/colleges"))).toBe(false);
  expect(calls.some((c) => c.endsWith("/publish"))).toBe(false);
});

test("data-entry role sees only its workspace; main admin has settings and no help tab", async ({
  page,
}) => {
  await fixture(page, "admin", true, true);
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Admin sections" });
  await expect(nav.getByRole("button", { name: "Data entry", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Entry history" })).toBeVisible();
  await expect(nav.getByRole("button")).toHaveCount(2);
  await expect(nav.getByRole("button", { name: "Review & publish", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve & publish", exact: true })).toHaveCount(0);
});

test("site settings replaces help and subscription forms have examples", async ({ page }) => {
  await fixture(page);
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Setup & help" })).toHaveCount(0);
  await page.getByRole("button", { name: "Site settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Data-entry team" })).toBeVisible();
  await expect(page.getByPlaceholder("data.operator@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Subscription plans", exact: true }).click();
  await page.getByRole("button", { name: /Add/ }).click();
  await expect(page.getByPlaceholder("e.g. Cutoff access")).toBeVisible();
  await expect(page.getByPlaceholder("99", { exact: true })).toBeVisible();
});

test("admin access grants and removes on mobile, protects self and reports failures", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await fixture(page);
  const targetId = "507f1f77bcf86cd799439077";
  const owner = {
    _id: "assignment-owner",
    userId: {
      _id: "507f1f77bcf86cd799439011",
      name: "Owner",
      email: "owner@example.com",
      isActive: true,
    },
    roleId: { name: "super_admin" },
  };
  const target = {
    _id: "assignment-new",
    userId: {
      _id: targetId,
      name: "New Admin",
      email: "new.admin.with.long.address@example.com",
      isActive: true,
    },
    roleId: { name: "super_admin" },
  };
  let granted = false,
    fail = false;
  const mutations: string[] = [];
  await page.route("**/api/v1/admin/admin-access**", async (route) => {
    const req = route.request();
    if (req.method() !== "GET") {
      mutations.push(req.method());
      if (fail)
        return route.fulfill({ status: 503, json: { message: "Access service unavailable" } });
      if (req.method() === "POST") {
        expect(req.postDataJSON()).toEqual({ identifier: target.userId.email });
        granted = true;
      } else {
        expect(req.url()).toContain(targetId);
        granted = false;
      }
    }
    await route.fulfill({ json: { success: true, data: granted ? [owner, target] : [owner] } });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Users", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Admin access", exact: true })).toBeVisible();
  expect(
    (await page.getByRole("textbox", { name: "Admin user email or phone" }).boundingBox())!.height,
  ).toBeGreaterThanOrEqual(40);
  await expect(
    page.getByRole("button", { name: "Remove admin access", exact: true }),
  ).toBeDisabled();
  await page.getByRole("textbox", { name: "Admin user email or phone" }).fill(target.userId.email);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Make admin", exact: true }).click();
  expect(mutations).toHaveLength(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Make admin", exact: true }).click();
  await expect(page.getByText("New Admin", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Admin access granted");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: "test-results/admin-access-mobile.png", fullPage: true });
  const remove = page
    .getByRole("listitem")
    .filter({ hasText: "New Admin" })
    .getByRole("button", { name: "Remove admin access", exact: true });
  fail = true;
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(page.getByRole("alert")).toContainText("Access service unavailable");
  await expect(page.getByText("New Admin", { exact: true })).toBeVisible();
  fail = false;
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(page.getByText("New Admin", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Admin access removed");
  await page.getByRole("button", { name: "Site settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Admin access", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("entry starts with seven sections and a short manual form; editor can send and track it", async ({
  page,
}) => {
  const calls = await fixture(page, "admin", true, true);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "What would you like to add?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^0[1-7] / })).toHaveCount(7);
  await page.screenshot({ path: "test-results/simple-data-entry.png", fullPage: true });
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("button", { name: /02 Courses/ }).click();
  await page.getByRole("button", { name: "Fill a form", exact: true }).click();
  await page.getByRole("textbox", { name: "Name *", exact: true }).fill("MBBS");
  await page.getByLabel("Course code", { exact: false }).fill("mbbs");
  await page.getByPlaceholder("e.g. MCC UG counselling 2026").fill("Official course prospectus");
  await page.getByRole("button", { name: "Check & preview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Courses preview" })).toBeVisible();
  await page.getByRole("button", { name: "Send for approval" }).click();
  await expect(page.getByRole("button", { name: "Approve & publish", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Entry history", exact: true }).click();
  await expect(page.locator("span").filter({ hasText: /^Waiting for approval$/ })).toBeVisible();
  expect(calls).toContain("POST /admin/imports/manual");
  expect(calls.some((c) => c.endsWith("/publish"))).toBe(false);
});

test("college-course manual entry accepts N/A intake without coercing it to zero", async ({
  page,
}) => {
  await fixture(page, "admin", true, true);
  await page.goto("/admin");
  await page.getByRole("button", { name: /03 College courses/ }).click();
  await page.getByRole("button", { name: "Fill a form", exact: true }).click();
  await page.getByPlaceholder("150 or N/A").fill("N/A");
  await page.locator('input[list="entry-college-codes"]').fill("COL-001");
  await page.getByRole("combobox", { name: "Course *", exact: true }).selectOption("mbbs");
  await page.getByPlaceholder("e.g. MCC UG counselling 2026").fill("Official prospectus");
  const submitted = page.waitForRequest(
    (request) => request.url().endsWith("/admin/imports/manual") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Check & preview", exact: true }).click();
  expect((await submitted).postDataJSON().input.totalSeats).toBe("N/A");
  await expect(page.getByRole("heading", { name: "College courses preview" })).toBeVisible();
});

test("invalid rows are corrected in the preview before sending, and unsaved edits block navigation", async ({
  page,
}) => {
  await fixture(page, "admin", true, true, true);
  await page.goto("/admin");
  await page.getByRole("button", { name: /01 Colleges/ }).click();
  await page.getByPlaceholder("e.g. MCC UG counselling 2026").fill("Official source");
  await page.getByLabel("Choose Excel or CSV file").setInputFiles({
    name: "colleges.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name\nExample"),
  });
  await page.getByRole("button", { name: "Check & preview", exact: true }).click();
  await expect(page.getByText("Needs changes", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send for approval" })).toHaveCount(0);
  await page.locator("summary").filter({ hasText: "Row 2" }).click();
  await expect(
    page.getByText("name: please check the college name", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Name *", exact: true })
    .fill("Corrected Medical College");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Entry history", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Colleges preview" })).toBeVisible();
  await page.getByRole("button", { name: "Save & check again" }).click();
  await expect(page.getByRole("button", { name: "Send for approval" })).toBeEnabled();
  await page.getByRole("button", { name: "Send for approval" }).click();
  await expect(page.getByRole("status")).toContainText("Sent for approval");
});

test("mobile homepage has admin navigation and a working logout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto("/admin");
  await page.getByRole("link", { name: "View website" }).click();
  await expect(
    page.locator("header").getByRole("link", { name: "Admin", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("link", { name: "Admin console", exact: true })).toBeVisible();
  await page.locator("header").getByRole("button", { name: "Log out" }).click();
  await expect(
    page.locator("header").getByRole("link", { name: "Log in", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/brand-mobile-home.png", fullPage: true });
});

test("main admin can delete one or selected records with dependency checks and confirmation", async ({
  page,
}) => {
  await fixture(page);
  let ids: string[] = [];
  let deleted = false;
  let blocked = true;
  await page.route("**/api/v1/admin/catalog-deletion/**", async (route) => {
    const body = route.request().postDataJSON();
    ids = body.ids;
    if (route.request().url().endsWith("/preview"))
      return route.fulfill({
        json: {
          data: {
            count: ids.length,
            fingerprint: "a".repeat(64),
            records: ids.map((id) => ({ _id: id, label: "Example Medical College" })),
            dependencies: blocked ? [{ section: "college-courses", count: 1 }] : [],
          },
        },
      });
    expect(body.reason).toBe("Duplicate entry");
    deleted = true;
    return route.fulfill({ json: { data: { deletedCount: ids.length } } });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Colleges & photos", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Delete these linked records first");
  await expect(page.getByRole("button", { name: /Confirm delete/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  blocked = false;
  await page.getByRole("checkbox", { name: "Select all records on this page" }).check();
  await page.getByRole("button", { name: "Delete selected (1)", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm delete (1)", exact: true }),
  ).toBeDisabled();
  await page.getByRole("textbox", { name: "Reason for deletion" }).fill("Duplicate entry");
  await page.getByRole("button", { name: "Confirm delete (1)", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(deleted).toBe(true);
  expect(ids).toEqual([collegeId]);
});

for (const amounts of [
  { tuition: "100000", otherCharges: "15000", hostelMess: "85000" },
  { tuition: "N/A", otherCharges: "N/A", hostelMess: "N/A" },
  { tuition: "", otherCharges: "", hostelMess: "" },
]) {
  test(`data editor enters tuition, other charges and hostel together: ${amounts.tuition || "blank"}`, async ({
    page,
  }) => {
    const calls = await fixture(page, "admin", true, true);
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: /07 Service bonds/ })).toBeVisible();
    await page.getByRole("button", { name: /04 Fees/ }).click();
    await expect(page.getByText("Which fees are you adding?")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Fee section" })).toHaveCount(0);
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download sample Excel", exact: true }).click();
    expect((await downloaded).suggestedFilename()).toBe("fees-sample.xlsx");
    expect(calls.some((call) => call.startsWith("GET /admin/imports/templates/fees"))).toBe(true);
    await page.getByRole("button", { name: "Fill a form", exact: true }).click();
    await page.getByLabel("College code", { exact: false }).first().fill("COL-001");
    await page.getByRole("combobox", { name: "Course *", exact: true }).selectOption("mbbs");
    await page.getByLabel("Admission year", { exact: false }).fill("2026");
    await page.getByRole("combobox", { name: "Fee type *", exact: true }).selectOption("merit");
    for (const [label, value] of [
      [/Annual tuition/, amounts.tuition],
      [/Other charges/, amounts.otherCharges],
      [/Annual hostel/, amounts.hostelMess],
    ] as const) {
      const input = page.getByRole("textbox", { name: label });
      await input.fill("1");
      await input.fill(value);
    }
    await page.getByPlaceholder("e.g. MCC UG counselling 2026").fill("Official fee notice 2026");
    const submitted = page.waitForRequest(
      (req) => req.url().includes("/admin/imports/manual") && req.method() === "POST",
    );
    await page.getByRole("button", { name: "Check & preview", exact: true }).click();
    expect((await submitted).postDataJSON()).toMatchObject({
      entity: "fees",
      input: amounts,
    });
  });
}

for (const value of ["N/A", ""]) {
  test(`bond form accepts ${value || "blank"} for years and penalty`, async ({ page }) => {
    await fixture(page, "admin", true, true);
    await page.goto("/admin");
    await page.getByRole("button", { name: /07 Service bonds/ }).click();
    await page.getByRole("button", { name: "Fill a form", exact: true }).click();
    await page.getByLabel("College code", { exact: false }).first().fill("COL-001");
    await page.getByRole("combobox", { name: "Course *", exact: true }).selectOption("mbbs");
    for (const name of [/Service bond years/, /Bond penalty/]) {
      const field = page.getByRole("textbox", { name });
      await field.fill("1");
      await field.fill(value);
    }
    await page.getByPlaceholder("e.g. MCC UG counselling 2026").fill("Official bond notice");
    const submitted = page.waitForRequest(
      (req) => req.url().includes("/admin/imports/manual") && req.method() === "POST",
    );
    await page.getByRole("button", { name: "Check & preview", exact: true }).click();
    expect((await submitted).postDataJSON()).toMatchObject({
      entity: "bonds",
      input: { years: value, penaltyAmount: value },
    });
  });
}

test("cutoff category offers source suggestions and submits an arbitrary exact code", async ({
  page,
}) => {
  await fixture(page, "admin", true, true);
  await page.goto("/admin");
  await page.getByRole("button", { name: /06 Cutoffs/ }).click();
  await page.getByRole("button", { name: "Fill a form", exact: true }).click();
  await page.getByLabel("College code", { exact: false }).first().fill("COL-001");
  await page.getByRole("combobox", { name: "Course *", exact: true }).selectOption("mbbs");
  await page.getByLabel("Admission year", { exact: false }).fill("2026");
  await page.getByLabel("Counselling authority", { exact: false }).fill("State authority");
  await page.getByRole("combobox", { name: "Quota *", exact: true }).selectOption("State");
  await page
    .getByRole("combobox", { name: "Counselling round *", exact: true })
    .selectOption("Round1");
  await page.getByLabel("Closing rank", { exact: false }).fill("12345");
  const category = page.getByRole("combobox", { name: /^Category/ });
  await expect(category).toHaveAttribute("maxlength", "80");
  for (const code of ["DEF1", "DEF2 W", "HOPEN", "NTB(W)", "SOURCE-CUSTOM / W"]) {
    await expect(page.locator(`datalist option[value="${code}"]`)).toHaveCount(1);
  }
  await category.fill("NEW CODE (W)");
  await page.getByPlaceholder("e.g. MCC UG counselling 2026").fill("Official cutoff notice");
  const submitted = page.waitForRequest(
    (req) => req.url().includes("/admin/imports/manual") && req.method() === "POST",
  );
  await page.getByRole("button", { name: "Check & preview", exact: true }).click();
  expect((await submitted).postDataJSON()).toMatchObject({
    entity: "cutoffs",
    input: { category: "NEW CODE (W)" },
  });
});

test("main admin sees unified Fees and can still manage saved shared hostel records", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Admin sections" });
  await expect(nav.getByRole("button", { name: "Hostel & mess fees", exact: true })).toHaveCount(0);
  await nav.getByRole("button", { name: "Fees", exact: true }).click();
  await expect(page.getByRole("group", { name: "Fee section" })).toHaveCount(0);
  await expect
    .poll(() => calls.some((call) => call.startsWith("GET /admin/catalog/fees?")))
    .toBe(true);
  await page.getByText("Manage saved college-wide hostel amounts", { exact: true }).click();
  await expect
    .poll(() => calls.some((call) => call.startsWith("GET /admin/catalog/hostel-fees?")))
    .toBe(true);
  await expect(nav.getByRole("button", { name: "Service bonds", exact: true })).toBeVisible();
});
