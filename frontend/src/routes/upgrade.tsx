import {
  confirmPayment,
  checkPayment,
  type CheckoutResponse,
  type PaymentStatus,
} from "@/lib/payment-confirmation";
import { BRAND } from "@/lib/brand";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  XCircle,
  Smartphone,
  CreditCard,
  Landmark,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Btn, BtnLink, Num, Panel, Pill, TextInput } from "@/components/kit";
import { useApp } from "@/lib/app-state";
import { fetchPlans, createCheckout } from "@/lib/api";
import { loadRazorpayScript } from "@/lib/razorpay";
import { ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upgrade")({
  head: () => ({
    meta: [
      { title: "Plans & pricing — Season Pass ₹99 | MedPath by Vidyarthi Mitra" },
      {
        name: "description",
        content:
          "Choose a MedPath plan: free browsing, the ₹99 Season Pass for all cutoffs, or Pro + Expert with a 1-to-1 counselling call.",
      },
      {
        property: "og:title",
        content: "MedPath by Vidyarthi Mitra plans — one-time ₹99 Season Pass",
      },
      {
        property: "og:description",
        content:
          "One-time payment, valid the whole counselling season. UPI, card, netbanking and wallets.",
      },
    ],
  }),
  component: Upgrade,
});

// Prices, duration and feature lists come from the published admin plan.
const PLAN_META: Record<
  string,
  { popular?: boolean; cta: string; variant: "ghost" | "gold" | "dark" }
> = {
  Free: { cta: "Free browsing", variant: "ghost" },
  "Season Pass": { popular: true, cta: "Pay securely", variant: "gold" },
  "Pro + Expert": { cta: "Pay securely", variant: "dark" },
};

const methods = [
  { key: "UPI", icon: Smartphone },
  { key: "Card", icon: CreditCard },
  { key: "Netbanking", icon: Landmark },
  { key: "Wallet", icon: Wallet },
];

interface BackendPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  durationDays: number;
}

function Upgrade() {
  const { refreshPremiumStatus, user } = useApp();
  const [plans, setPlans] = useState<BackendPlan[]>([]);
  const [plan, setPlan] = useState<string>("Season Pass");
  const [method, setMethod] = useState("UPI");
  const [coupon, setCoupon] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "failed" | "pending">("idle");
  const [paying, setPaying] = useState(false);
  const [lastAmount, setLastAmount] = useState(0);
  const [pendingPayment, setPendingPayment] = useState<string | null>(null);
  const applyPayment = async (result: PaymentStatus) => {
    setLastAmount(result.amount);
    if (result.status === "paid" && result.fulfillmentStatus === "fulfilled") {
      await refreshPremiumStatus();
      setStatus("success");
      setPendingPayment(null);
      sessionStorage.removeItem("medpath.pendingSubscription");
    } else setStatus("pending");
  };
  useEffect(() => {
    if (!user) return;
    const saved = sessionStorage.getItem("medpath.pendingSubscription");
    if (saved) {
      setPendingPayment(saved);
      setStatus("pending");
    }
  }, [user]);
  const retryConfirmation = async () => {
    if (!pendingPayment) return;
    setPaying(true);
    try {
      await applyPayment(await checkPayment(pendingPayment));
    } catch {
      toast.error(
        "Confirmation is unavailable. Keep your payment reference and try again; do not pay again if debited.",
      );
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    fetchPlans()
      .then((items) => {
        setPlans(items);
        setPlan(items.find((item) => item.price > 0)?.name || items[0]?.name || "");
      })
      .catch(() => toast.error("Could not load plans — is the API running?"));
  }, []);

  const selected = plans.find((p) => p.name === plan);
  const base = selected?.price ?? 0;

  const pay = async () => {
    if (!selected || paying) return;
    if (selected.price === 0) {
      toast("You're already on the Free plan");
      return;
    }
    if (!user) {
      toast.error("Log in first to purchase a plan");
      return;
    }

    setPaying(true);
    try {
      const order = await createCheckout(selected.id, coupon || undefined);
      setLastAmount(order.amount);
      setStatus("pending");
      setPendingPayment(order.paymentId);
      sessionStorage.setItem("medpath.pendingSubscription", order.paymentId);

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        toast.error("Could not load the payment widget. Check your connection and try again.");
        setPaying(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.razorpayKeyId,
        amount: order.amount * 100,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: BRAND.fullName,
        image: `${BRAND.siteUrl}/brand/vidyarthi-mitra.png`,
        description: `${plan} — season access`,
        theme: { color: "#0E8C86" },
        prefill: { contact: user.phone, email: user.email },
        timeout: 900,
        handler: async (response: CheckoutResponse) => {
          setStatus("pending");
          try {
            let result = await confirmPayment(order.paymentId, response);
            for (let i = 0; i < 4 && result.status !== "paid"; i++) {
              await new Promise((resolve) => setTimeout(resolve, 1500));
              result = await checkPayment(order.paymentId);
            }
            await applyPayment(result);
          } catch {
            toast.error("Payment confirmation is pending. Check status before paying again.");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setStatus("pending");
          },
        },
      });
      rzp.open();
      return;
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 0) {
        toast.error("Could not reach the payment order endpoint — is the backend running?");
      } else if (err instanceof ApiClientError) {
        toast.error(err.message);
      } else {
        toast.error("Could not start checkout");
      }
      setPaying(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <div className="text-center">
        <h1 className="text-[28px] md:text-[38px]">Choose your plan</h1>
        <p className="mt-2 text-sm text-muted">One-time · valid the whole counselling season</p>
      </div>

      {plans.length === 0 && (
        <p className="mt-6 text-center">
          No plans are available right now. Please try again later.
        </p>
      )}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const meta = PLAN_META[p.name] ?? { cta: "Pay securely", variant: "gold" as const };
          return (
            <div
              key={p.name}
              className={cn(
                "relative flex flex-col rounded-[22px] border bg-card p-5",
                meta.popular
                  ? "border-gold-100 shadow-gold lg:-mt-3 lg:pb-7"
                  : "border-line shadow-sh-1",
              )}
            >
              {meta.popular && (
                <span className="absolute -top-3 left-5">
                  <Pill tone="gold" dot>
                    Most popular
                  </Pill>
                </span>
              )}
              <h2 className="text-[19px]">{p.name}</h2>
              <p className="mt-1 text-[12.5px] text-muted">
                {p.price > 0
                  ? `Valid for ${p.durationDays} days from confirmation`
                  : "Free browsing"}
              </p>
              <p className="mt-3">
                <Num className="text-[36px] font-semibold leading-none">₹{p.price}</Num>
              </p>
              <ul className="mt-4 grid flex-1 gap-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13.5px]">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald" strokeWidth={1.6} />
                    <span className="text-ink">{f}</span>
                  </li>
                ))}
              </ul>
              <Btn
                variant={meta.variant}
                className="mt-5 w-full"
                onClick={() => {
                  setPlan(p.name);
                  toast.success(`${p.name} selected`);
                }}
              >
                {p.name === plan && p.price === 0 ? "Current plan" : meta.cta}
              </Btn>
            </div>
          );
        })}
      </div>

      {/* Payment */}
      <div className="mt-10 grid gap-5 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <Panel className="p-5">
          <h2 className="text-[19px]">Payment method</h2>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {methods.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-[14px] border px-3 py-4 text-[13px] font-semibold transition-all duration-[180ms]",
                  method === m.key
                    ? "border-teal-500 bg-teal-050 text-teal-700 ring-2 ring-teal-500/30"
                    : "border-line bg-card text-muted hover:border-teal-100",
                )}
              >
                <m.icon className="size-5" strokeWidth={1.6} />
                {m.key}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-muted-2">
            Razorpay Checkout opens on the actual payment step and lets you pick UPI, card,
            netbanking or wallet — this selector just previews your preference.
          </p>

          <div className="mt-4">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-2">
              Coupon code
            </span>
            <div className="flex gap-2">
              <TextInput
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="NEET25"
              />
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-2">
              Applied and validated when you pay — the discount shows in the Razorpay order summary.
            </p>
          </div>
        </Panel>

        <div className="grid gap-4 lg:sticky lg:top-24">
          <Panel className="p-5">
            <h2 className="text-[19px]">Order summary</h2>
            <dl className="mt-4 grid gap-2.5 text-[13.5px]">
              <Row k={plan} v={`₹${base}`} />
              <Row k="Coupon" v={coupon || "—"} />
              <Row k="Payment method" v={method} />
            </dl>
            <div className="mt-4 flex items-end justify-between border-t border-line-2 pt-4">
              <span className="text-[13px] text-muted">Before coupon</span>
              <Num className="text-[32px] font-semibold leading-none">₹{base}</Num>
            </div>
            <Btn
              variant="gold"
              className="mt-4 w-full"
              onClick={pay}
              disabled={paying || !selected || status === "pending"}
            >
              {paying ? "Opening secure checkout…" : `${PLAN_META[plan]?.cta ?? "Pay"} ₹${base}`}
            </Btn>
            <p className="mt-2 text-center text-[11.5px] text-muted-2">
              Final amount, including any valid coupon, appears in Razorpay checkout.
            </p>
          </Panel>

          {status === "pending" && (
            <Panel className="p-5">
              <h3 className="text-[18px]">Payment confirmation pending</h3>
              <p className="mt-2 text-sm">
                If your account was debited, do not pay again. Check the server status below.
              </p>
              <p className="mt-2 break-all text-xs">Reference: {pendingPayment}</p>
              <Btn className="mt-3" disabled={paying} onClick={retryConfirmation}>
                Check payment status
              </Btn>
              <Btn
                variant="ghost"
                className="mt-2"
                disabled={paying}
                onClick={() => {
                  setStatus("idle");
                  setPendingPayment(null);
                  sessionStorage.removeItem("medpath.pendingSubscription");
                }}
              >
                No debit? Start another checkout
              </Btn>
            </Panel>
          )}
          {status === "success" && (
            <Panel className="border-emerald/20 bg-emerald-050 p-5 text-center">
              <CheckCircle2 className="mx-auto size-8 text-emerald" strokeWidth={1.6} />
              <h3 className="mt-2 text-[18px]">Payment confirmed</h3>
              <p className="mt-1 text-[13px] text-muted">
                <Num>₹{lastAmount}</Num> received. Your premium access is now active.
              </p>
              <BtnLink to="/cutoffs" variant="primary" className="mt-4">
                See all cutoffs
              </BtnLink>
            </Panel>
          )}

          {status === "failed" && (
            <Panel className="border-rose/20 bg-rose-050 p-5 text-center">
              <XCircle className="mx-auto size-8 text-rose" strokeWidth={1.6} />
              <h3 className="mt-2 text-[18px]">Payment failed</h3>
              <p className="mt-1 text-[13px] text-muted">
                Payment could not be completed. If debited, check payment status before trying
                again.
              </p>
              <Btn variant="ghost" className="mt-4" onClick={() => setStatus("idle")}>
                Retry payment
              </Btn>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="num font-semibold">{v}</dd>
    </div>
  );
}
