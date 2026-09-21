import { expect, test, type Page } from "@playwright/test";
const nursing = {
  name: "B.Sc. Nursing",
  slug: "bsc-nursing",
  fullName: "Bachelor of Science in Nursing",
  duration: "4 years",
  discipline: "Nursing",
  level: "Degree",
  admissionRoute: "institution-specific",
  admissionNotes: "Check the current nursing entrance and counselling prospectus.",
  eligibility: ["Class 12 PCB and English"],
  careerPath: ["Registered nursing"],
  aliases: ["BSc Nursing"],
  sourceUrls: ["https://indiannursingcouncil.org/eligibility-criteria"],
  reviewedOn: "2026-09-12",
};
const medicine = {
  ...nursing,
  name: "MBBS",
  slug: "mbbs",
  fullName: "Bachelor of Medicine and Bachelor of Surgery",
  discipline: "Medicine",
  admissionRoute: "neet-ug",
  aliases: [],
  admissionNotes: "Qualify NEET-UG.",
};
async function openCatalogue(page: Page) {
  const calls: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    calls.push(`${url.pathname}${url.search}`);
    let body: unknown = { data: [], pagination: { total: 0 } };
    if (url.pathname === "/api/v1/courses") body = { data: [nursing, medicine] };
    else if (url.pathname.startsWith("/api/v1/courses/"))
      body = {
        data: {
          course: url.pathname.endsWith("/mbbs") ? medicine : nursing,
          totalColleges: 0,
          feeRangeByOwnership: { government: null, privateOrDeemed: null },
        },
      };
    await route.fulfill({ json: body });
  });
  // Navigate from a page without a data loader, so client requests use the isolated fixture.
  await page.goto("/login");
  await page.getByPlaceholder("98765 43210").fill("9876543210");
  await expect(page.getByRole("button", { name: "Send OTP", exact: true })).toBeEnabled();
  await page.getByRole("link", { name: "Back to browsing" }).click();
  await page.getByRole("link", { name: "Explore all courses", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find your path in healthcare" })).toBeVisible();
  return calls;
}
test("nursing is searchable, has no invented fee/NEET claim, and links to its filtered colleges", async ({
  page,
}) => {
  const calls = await openCatalogue(page);
  await page.getByRole("textbox", { name: "Search courses" }).fill("BSc Nursing");
  await expect(page.getByRole("status").filter({ hasText: "1 courses" })).toBeVisible();
  await page.getByRole("link", { name: "Course details" }).click();
  await expect(page).toHaveURL(/courses\/bsc-nursing/);
  await expect(page.getByText("Fees: N/A", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Explore NEET cutoffs" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Official sources" })).toBeVisible();
  await page.getByRole("link", { name: "See B.Sc. Nursing colleges" }).click();
  await expect(page).toHaveURL(/course=bsc-nursing/);
  await expect(page.getByRole("combobox", { name: "Course", exact: true })).toHaveValue(
    "bsc-nursing",
  );
  expect(
    calls.some(
      (call) => call.startsWith("/api/v1/colleges?") && call.includes("course=bsc-nursing"),
    ),
  ).toBe(true);
});
test("course groups and qualification filters work on mobile; medicine retains NEET navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCatalogue(page);
  await page.getByRole("combobox", { name: "Field", exact: true }).selectOption("Medicine");
  await expect(page.getByRole("heading", { name: "MBBS", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "B.Sc. Nursing", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Qualification", exact: true }).selectOption("Diploma");
  await expect(page.getByRole("heading", { name: "No courses found" })).toBeVisible();
  await page.getByRole("combobox", { name: "Qualification", exact: true }).selectOption("Degree");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("link", { name: "Course details" }).click();
  await expect(page.getByRole("link", { name: "Explore NEET cutoffs" })).toBeVisible();
});
