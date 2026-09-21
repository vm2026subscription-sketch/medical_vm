import { expect, test, type Page } from "@playwright/test";
const paymentId = "507f1f77bcf86cd799439055";
async function fixture(page: Page, delayed: boolean) {
  await page.addInitScript(() => {
    localStorage.setItem("medpath.accessToken", "isolated-payment-test");
    window.Razorpay = class {
      options: Record<string, unknown>;
      constructor(options: Record<string, unknown>) {
        this.options = options;
      }
      open() {
        void (this.options["handler"] as (r: unknown) => Promise<void>)({
          razorpay_order_id: "order_isolated",
          razorpay_payment_id: "pay_isolated",
          razorpay_signature: "a".repeat(64),
        });
      }
    };
  });
  let verified = false;
  const calls: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    calls.push(path);
    let body: unknown = { data: [] };
    if (path === "/profile/me")
      body = {
        data: {
          user: { _id: "507f1f77bcf86cd799439011", name: "Student", role: "student" },
          profile: null,
        },
      };
    if (path === "/dashboard/overview")
      body = {
        data: {
          isPremium: verified,
          savedColleges: [],
          downloads: [],
          recentActivity: [],
          nextDeadline: null,
        },
      };
    if (path === "/billing/plans")
      body = {
        data: [
          {
            _id: "507f1f77bcf86cd799439033",
            name: "Season Pass",
            price: 99,
            durationDays: 120,
            features: ["Published cutoff access"],
          },
        ],
      };
    if (path === "/billing/checkout")
      body = {
        data: {
          paymentId,
          razorpayOrderId: "order_isolated",
          razorpayKeyId: "rzp_test_isolated",
          amount: 99,
          currency: "INR",
        },
      };
    if (path === "/billing/verify" || path === `/billing/payments/${paymentId}`) {
      if (path === "/billing/verify") {
        expect(route.request().postDataJSON()).toMatchObject({
          paymentId,
          razorpay_order_id: "order_isolated",
          razorpay_payment_id: "pay_isolated",
          razorpay_signature: "a".repeat(64),
        });
        if (delayed) {
          await route.fulfill({ status: 503, json: { message: "Pending confirmation" } });
          return;
        }
      }
      verified = true;
      body = {
        data: {
          paymentId,
          status: "paid",
          fulfillmentStatus: "fulfilled",
          amount: 99,
          message: "",
          purpose: "subscription",
        },
      };
    }
    await route.fulfill({ json: body });
  });
  return calls;
}
test("checkout confirms server signature and activation before showing success", async ({
  page,
}) => {
  const calls = await fixture(page, false);
  await page.goto("/upgrade");
  await expect(page.getByText("Published cutoff access")).toBeVisible();
  await expect(page.getByText("Valid for 120 days from confirmation")).toBeVisible();
  await page.getByRole("button", { name: "Pay securely ₹99", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment confirmed", exact: true })).toBeVisible();
  expect(calls).toContain("/billing/verify");
  expect(
    await page.evaluate(() => sessionStorage.getItem("medpath.pendingSubscription")),
  ).toBeNull();
});
test("failed confirmation stays pending and survives reload for server recovery without a second order", async ({
  page,
}) => {
  const calls = await fixture(page, true);
  await page.goto("/upgrade");
  await page.getByRole("button", { name: "Pay securely ₹99", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment confirmation pending" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment confirmed", exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  await page.getByRole("button", { name: "Check payment status" }).click();
  await expect(page.getByRole("heading", { name: "Payment confirmed", exact: true })).toBeVisible();
  expect(calls.filter((path) => path === "/billing/checkout")).toHaveLength(1);
});
