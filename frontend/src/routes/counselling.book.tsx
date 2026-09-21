import {
  confirmPayment,
  checkPayment,
  type CheckoutResponse,
  type PaymentStatus,
} from "@/lib/payment-confirmation";
import { BRAND } from "@/lib/brand";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, MessageSquare, ListChecks, RefreshCw, Star, Video } from "lucide-react";
import { toast } from "sonner";
import { Btn, Num, Panel, Pill, Skeleton } from "@/components/kit";
import type { Counsellor } from "@/lib/catalog";
import { fetchCounsellors, fetchServices, fetchSlots, holdSlot, createBooking } from "@/lib/api";
import { loadRazorpayScript } from "@/lib/razorpay";
import { useApp } from "@/lib/app-state";
import { ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/counselling/book")({
  head: () => ({
    meta: [
      { title: "Book 1-to-1 NEET counselling with an expert — MedPath by Vidyarthi Mitra" },
      {
        name: "description",
        content:
          "Pick an expert, choose a slot and get a focused Google Meet call covering your rank, budget and choice-filling order.",
      },
      {
        property: "og:title",
        content: "Book 1-to-1 NEET counselling — MedPath by Vidyarthi Mitra",
      },
      {
        property: "og:description",
        content: "Expert call with a written action plan, chat follow-up and free reschedule.",
      },
    ],
  }),
  component: BookCounselling,
});

function nextSevenDays() {
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      iso: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: String(d.getDate()),
      month: d.toLocaleDateString("en-IN", { month: "short" }),
    };
  });
}

interface Service {
  id: string;
  name: string;
  price: number;
  durationMins: number;
}
interface Slot {
  id: string;
  time: string;
  available: boolean;
}

function BookCounselling() {
  const { user, isAuthenticated } = useApp();
  const week = nextSevenDays();

  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [expert, setExpert] = useState<string | null>(null);
  const [day, setDay] = useState(week[0]!.iso);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [paying, setPaying] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const applyPayment = (result: PaymentStatus) => {
    if (result.status === "paid" && result.fulfillmentStatus === "fulfilled") {
      setConfirmed(true);
      setPendingPayment(null);
      setPaymentMessage("");
      sessionStorage.removeItem("medpath.pendingBooking");
      toast.success("Payment and booking confirmed. The team will share your meeting details.");
    } else
      setPaymentMessage(
        result.message ||
          "Payment confirmation pending. If debited, do not pay again; check status below.",
      );
  };
  useEffect(() => {
    if (!user) return;
    const saved = sessionStorage.getItem("medpath.pendingBooking");
    if (saved) {
      setPendingPayment(saved);
      setPaymentMessage(
        "A previous checkout needs confirmation. Check its status before paying again.",
      );
    }
  }, [user]);
  const retryConfirmation = async () => {
    if (!pendingPayment) return;
    setPaying(true);
    try {
      applyPayment(await checkPayment(pendingPayment));
    } catch {
      toast.error("Could not check payment. Keep your reference and try again.");
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchCounsellors(), fetchServices()])
      .then(([c, s]) => {
        setCounsellors(c);
        setServices(s);
        if (c[0]) setExpert(c[0].id);
      })
      .catch(() => toast.error("Could not load counsellors — is the API running?"));
  }, []);

  useEffect(() => {
    if (!expert) return;
    setLoadingSlots(true);
    setSlotId(null);
    setHoldToken(null);
    fetchSlots(expert, day)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [expert, day]);

  useEffect(() => {
    if (!holdToken || confirmed) return;
    const t = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [holdToken, confirmed]);

  const chosen = counsellors.find((c) => c.id === expert);
  const service = services[0];
  const mm = String(Math.floor(secs / 60));
  const ss = String(secs % 60).padStart(2, "0");

  const selectSlot = async (s: Slot) => {
    if (!isAuthenticated) {
      toast.error("Log in to hold a slot");
      return;
    }
    if (!s.available) return;
    try {
      const res = await holdSlot(s.id);
      setSlotId(s.id);
      setHoldToken(res.holdToken);
      const secondsLeft = Math.round((new Date(res.heldUntil).getTime() - Date.now()) / 1000);
      setSecs(Math.max(secondsLeft, 0));
      toast.success("Slot held for you");
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "That slot just got taken — try another",
      );
      // Refresh the list since the slot we tried is likely no longer open.
      if (expert)
        fetchSlots(expert, day)
          .then(setSlots)
          .catch(() => {});
    }
  };

  const payAndConfirm = async () => {
    if (!slotId || !holdToken || !service || paying || pendingPayment) return;
    setPaying(true);
    try {
      const order = await createBooking({ slotId, holdToken, serviceId: service.id });
      setPendingPayment(order.paymentId);
      sessionStorage.setItem("medpath.pendingBooking", order.paymentId);
      setPaymentMessage("Checkout started. Check status before paying again if debited.");
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        toast.error("Could not load the payment widget");
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
        description: `Counselling session with ${chosen?.name ?? "an expert"}`,
        theme: { color: "#DE8A1B" },
        prefill: { contact: user?.phone, email: user?.email },
        timeout: 900,
        handler: async (response: CheckoutResponse) => {
          try {
            let result = await confirmPayment(order.paymentId, response);
            for (let i = 0; i < 4 && result.status !== "paid"; i++) {
              await new Promise((resolve) => setTimeout(resolve, 1500));
              result = await checkPayment(order.paymentId);
            }
            applyPayment(result);
          } catch {
            setPaymentMessage("Server confirmation is pending. Check status before paying again.");
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
      return;
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not start checkout");
      setPaying(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <h1 className="text-[26px] md:text-[34px]">Book a 1-to-1 counselling call</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-muted">
        Focused minutes on your rank, your budget and the exact order to fill your choices.
      </p>

      {pendingPayment && (
        <Panel className="mt-5 p-5">
          <p>{paymentMessage}</p>
          <p className="mt-2 break-all text-xs">Reference: {pendingPayment}</p>
          <Btn className="mt-3" disabled={paying} onClick={retryConfirmation}>
            Check payment status
          </Btn>
          <Btn
            variant="ghost"
            disabled={paying}
            className="mt-2"
            onClick={() => {
              setPendingPayment(null);
              setPaymentMessage("");
              sessionStorage.removeItem("medpath.pendingBooking");
            }}
          >
            No debit? Return to checkout
          </Btn>
        </Panel>
      )}
      <div className="mt-6 grid gap-5 lg:grid-cols-[300px_1fr_320px] lg:items-start">
        {/* Experts */}
        <Panel className="p-5">
          <h2 className="text-[18px]">Choose your expert</h2>
          {counsellors.length === 0 ? (
            <div className="mt-4 grid gap-2.5">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="mt-4 grid gap-2.5">
              {counsellors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setExpert(c.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[14px] border p-3.5 text-left transition-all duration-[180ms]",
                    expert === c.id
                      ? "border-teal-500 bg-teal-050 ring-2 ring-teal-500/40"
                      : "border-line bg-card hover:border-teal-100",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">
                    {c.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold">{c.name}</span>
                    <span className="block text-[12px] leading-snug text-muted">{c.specialty}</span>
                    <span className="mt-1.5 flex items-center gap-2 text-[11.5px] text-muted-2">
                      <span className="inline-flex items-center gap-1 text-gold-600">
                        <Star className="size-3.5 fill-gold-500 text-gold-500" strokeWidth={1.6} />
                        <Num className="font-semibold">{c.rating}</Num>
                      </span>
                      <Num>{c.calls}</Num> calls
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              const other = counsellors.find((c) => c.id !== expert);
              if (other) {
                setExpert(other.id);
                toast.success("Matched you with the next available expert");
              }
            }}
            className="mt-3 text-[13px] font-semibold text-teal-700 underline-offset-4 hover:underline"
          >
            or match me with anyone available
          </button>
        </Panel>

        {/* Date + slots */}
        <Panel className="p-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-teal-700" strokeWidth={1.6} />
            <h2 className="text-[18px]">Pick a date & time</h2>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {week.map((d) => (
              <button
                key={d.iso}
                onClick={() => setDay(d.iso)}
                className={cn(
                  "rounded-[12px] border py-2.5 text-center transition-colors duration-[180ms]",
                  day === d.iso
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-line bg-card hover:border-teal-100",
                )}
              >
                <span className="block text-[10.5px] font-semibold uppercase tracking-wide opacity-80">
                  {d.day}
                </span>
                <Num className="block text-[16px] font-semibold">{d.date}</Num>
              </button>
            ))}
          </div>

          {loadingSlots ? (
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="mt-5 text-[13.5px] text-muted-2">
              No slots published for this expert on this date yet.
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={s.id}
                  disabled={!s.available}
                  onClick={() => selectSlot(s)}
                  className={cn(
                    "num rounded-[12px] border py-2.5 text-[13.5px] font-semibold transition-colors duration-[180ms]",
                    !s.available &&
                      "cursor-not-allowed border-line-2 bg-board text-muted-2 line-through",
                    s.available &&
                      slotId === s.id &&
                      "border-teal-600 bg-teal-050 text-teal-700 ring-2 ring-teal-500/30",
                    s.available &&
                      slotId !== s.id &&
                      "border-line bg-card text-ink hover:border-teal-100",
                  )}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-[12px] text-muted-2">
            All times shown in IST · greyed slots are already booked or held.
          </p>
        </Panel>

        {/* Summary */}
        <div className="lg:sticky lg:top-24">
          <Panel className="p-5 shadow-sh-2">
            <h2 className="text-[18px]">Booking summary</h2>
            <dl className="mt-4 grid gap-2.5 text-[13.5px]">
              {[
                ["Service", service ? `${service.name} · ${service.durationMins} min` : "—"],
                ["Expert", chosen?.name ?? "—"],
                [
                  "Date & time",
                  slotId
                    ? `${day} · ${slots.find((s) => s.id === slotId)?.time} IST`
                    : "Pick a slot",
                ],
                ["Platform", "Google Meet"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className={cn("text-right font-semibold", k === "Date & time" && "num")}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex items-end justify-between border-t border-line-2 pt-4">
              <span className="text-[13px] text-muted">Total</span>
              <Num className="text-[30px] font-semibold leading-none">₹{service?.price ?? "—"}</Num>
            </div>

            {confirmed ? (
              <div className="mt-4 rounded-[14px] border border-emerald/20 bg-emerald-050 p-4 text-center">
                <p className="text-[14px] font-semibold text-emerald">Payment captured</p>
                <p className="mt-1 text-[12.5px] text-muted">
                  The Meet link is sent once the payment webhook confirms — usually within seconds.
                </p>
              </div>
            ) : (
              <>
                <Btn
                  variant="gold"
                  className="mt-4 w-full"
                  onClick={payAndConfirm}
                  disabled={!slotId || !holdToken || paying}
                >
                  {paying ? "Opening secure checkout…" : "Pay & confirm slot"}
                </Btn>
                {holdToken && (
                  <p className="mt-2 text-center text-[12px] text-muted">
                    Slot held for{" "}
                    <Num className="font-semibold text-ink">
                      {mm}:{ss}
                    </Num>
                  </p>
                )}
              </>
            )}

            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
              <RefreshCw className="size-3.5" strokeWidth={1.6} /> Free reschedule up to 6 hours
              before the call.
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line-2 pt-4">
              <Pill tone="teal" dot>
                <MessageSquare className="size-3" strokeWidth={1.6} /> 7-day chat
              </Pill>
              <Pill tone="teal" dot>
                <ListChecks className="size-3" strokeWidth={1.6} /> Action plan
              </Pill>
              <Pill tone="teal" dot>
                <Video className="size-3" strokeWidth={1.6} /> Follow-up call
              </Pill>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
