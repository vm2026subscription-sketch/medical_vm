import { BrandLogo } from "@/components/brand-logo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Mail, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Btn, Dropdown, Num, Panel, Pill, TextInput } from "@/components/kit";
import { CATEGORIES, COURSE_CODES, STATES } from "@/lib/catalog";
import { updateProfile, runPredictor } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your MedPath by Vidyarthi Mitra account" },
      {
        name: "description",
        content:
          "Sign up in three steps and get college matches tuned to your NEET rank, category and home state.",
      },
      { property: "og:title", content: "Sign up — MedPath by Vidyarthi Mitra" },
      {
        property: "og:description",
        content: "Three quick steps to your personalised NEET counselling plan.",
      },
    ],
  }),
  component: Signup,
});

const steps = ["Basic info", "Your NEET details", "Done"];
type Mode = "phone" | "email";

function Signup() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("phone");
  const [otpStage, setOtpStage] = useState<"idle" | "sent" | "verified">("idle");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [neetRank, setNeetRank] = useState("");
  const [marks, setMarks] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0] ?? "General");
  const [homeState, setHomeState] = useState("Maharashtra");

  const [counts, setCounts] = useState({ safe: 0, target: 0, dream: 0 });

  const { requestOtp, verifyOtp, requestEmailOtp, verifyEmailOtp, setRank } = useApp();
  const navigate = useNavigate();

  const fullPhone = `+91${phone}`;

  const switchMode = (m: Mode) => {
    setMode(m);
    setOtpStage("idle");
    setOtp("");
  };

  const sendOtp = async () => {
    if (!name.trim()) {
      toast.error("Enter your full name");
      return;
    }
    if (mode === "phone" && phone.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    if (mode === "email" && !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSending(true);
    try {
      const res = mode === "phone" ? await requestOtp(fullPhone) : await requestEmailOtp(email);
      setOtpStage("sent");
      toast.success(res.devOnlyCode ? `OTP sent (dev code: ${res.devOnlyCode})` : "OTP sent");
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Could not send OTP. Is the API running?",
      );
    } finally {
      setSending(false);
    }
  };

  const verifyAndContinue = async () => {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setSending(true);
    try {
      if (mode === "phone") {
        await verifyOtp(fullPhone, otp, name.trim());
      } else {
        await verifyEmailOtp(email, otp, name.trim());
      }
      setOtpStage("verified");
      setStep(1);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Verification failed");
    } finally {
      setSending(false);
    }
  };

  const saveNeetDetails = async () => {
    const rankNum = Number(neetRank);
    if (!rankNum || rankNum <= 0) {
      toast.error("Enter a valid NEET rank");
      return;
    }
    setSaving(true);
    try {
      const profileUpdate: Parameters<typeof updateProfile>[0] = {
        neetRank: rankNum,
        category,
        homeState,
      };
      if (marks) profileUpdate.marks = Number(marks);
      await updateProfile(profileUpdate);
      setRank(rankNum);
      toast.success("Profile saved");

      // Real seat-match run using what we just collected, so step 2 shows genuine counts.
      setMatching(true);
      const results = await runPredictor({
        rank: rankNum,
        category,
        state: homeState,
        courses: COURSE_CODES.map((c) => c.toLowerCase()),
      });
      setCounts({
        safe: results.filter((r) => r.band === "safe").length,
        target: results.filter((r) => r.band === "target").length,
        dream: results.filter((r) => r.band === "dream").length,
      });
      setStep(2);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not save your details");
    } finally {
      setSaving(false);
      setMatching(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo />
          </Link>
          <Link to="/login" className="text-[13px] font-semibold text-teal-700 hover:underline">
            I have an account
          </Link>
        </div>

        {/* Stepper */}
        <div className="mt-8 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "num flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                      i < step
                        ? "bg-emerald text-white"
                        : i === step
                          ? "bg-teal-600 text-white"
                          : "bg-board text-muted-2",
                    )}
                  >
                    {i < step ? <Check className="size-3.5" strokeWidth={2} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "hidden text-[12.5px] font-semibold sm:block",
                      i === step ? "text-ink" : "text-muted-2",
                    )}
                  >
                    {s}
                  </span>
                </div>
                <div
                  className={cn("mt-2 h-1 rounded-full", i <= step ? "bg-teal-600" : "bg-board")}
                />
              </div>
            </div>
          ))}
        </div>

        <Panel className="mt-6 p-5 md:p-6">
          {step === 0 && (
            <>
              <h1 className="text-[22px]">Create your account</h1>
              <p className="mt-1 text-[13px] text-muted">
                Takes under a minute. No payment needed yet.
              </p>

              {otpStage === "idle" && (
                <div className="mt-5 flex gap-1.5 rounded-[12px] bg-paper p-1">
                  <button
                    onClick={() => switchMode("phone")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[13px] font-semibold transition-colors duration-[180ms]",
                      mode === "phone" ? "bg-card text-teal-700 shadow-sh-1" : "text-muted",
                    )}
                  >
                    <Smartphone className="size-4" strokeWidth={1.6} /> Phone
                  </button>
                  <button
                    onClick={() => switchMode("email")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[13px] font-semibold transition-colors duration-[180ms]",
                      mode === "email" ? "bg-card text-teal-700 shadow-sh-1" : "text-muted",
                    )}
                  >
                    <Mail className="size-4" strokeWidth={1.6} /> Email
                  </button>
                </div>
              )}

              <div className="mt-5 grid gap-3.5">
                <Field label="Full name">
                  <TextInput
                    placeholder="Aarav Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={otpStage !== "idle"}
                  />
                </Field>

                {mode === "phone" ? (
                  <Field label="Mobile number">
                    <div className="flex gap-2">
                      <span className="num flex h-11 shrink-0 items-center rounded-[12px] border border-line bg-paper px-3 text-sm">
                        +91
                      </span>
                      <TextInput
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="98765 43210"
                        className="num"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                        disabled={otpStage !== "idle"}
                      />
                    </div>
                  </Field>
                ) : (
                  <Field label="Email address">
                    <TextInput
                      type="email"
                      placeholder="aarav@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={otpStage !== "idle"}
                    />
                  </Field>
                )}

                {otpStage === "sent" && (
                  <Field label="Enter the 6-digit OTP">
                    <TextInput
                      inputMode="numeric"
                      maxLength={6}
                      className="num text-center tracking-[0.5em]"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="••••••"
                    />
                  </Field>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-[22px]">Your NEET details</h1>
              <p className="mt-1 text-[13px] text-muted">
                This is what powers your matches — you can edit it later.
              </p>
              <div className="mt-5 grid gap-3.5">
                <Field label="All India Rank">
                  <TextInput
                    inputMode="numeric"
                    placeholder="54120"
                    className="num"
                    value={neetRank}
                    onChange={(e) => setNeetRank(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                </Field>
                <Field label="NEET marks">
                  <TextInput
                    inputMode="numeric"
                    placeholder="512"
                    className="num"
                    value={marks}
                    onChange={(e) => setMarks(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                </Field>
                <Dropdown
                  label="Category"
                  options={CATEGORIES}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
                <Dropdown
                  label="Home state"
                  options={STATES}
                  value={homeState}
                  onChange={(e) => setHomeState(e.target.value)}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div className="py-6 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-050 text-emerald">
                <Check className="size-6" strokeWidth={1.6} />
              </span>
              <h1 className="mt-3 text-[22px]">You're all set</h1>
              <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-muted">
                We found{" "}
                <Num className="font-semibold text-ink">
                  {counts.safe + counts.target + counts.dream}
                </Num>{" "}
                colleges matching your rank — <Num>{counts.safe}</Num> safe,{" "}
                <Num>{counts.target}</Num> target and <Num>{counts.dream}</Num> dream.
              </p>
              <Pill tone="violet" className="mt-4" dot>
                AI match ready
              </Pill>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            {step === 1 && (
              <Btn variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft className="size-4" strokeWidth={1.6} /> Back
              </Btn>
            )}
            {step === 0 &&
              (otpStage === "sent" ? (
                <Btn className="flex-1" onClick={verifyAndContinue} disabled={sending}>
                  {sending ? "Verifying…" : "Verify & continue"}{" "}
                  <ArrowRight className="size-4" strokeWidth={1.6} />
                </Btn>
              ) : (
                <Btn className="flex-1" onClick={sendOtp} disabled={sending}>
                  {sending ? "Sending…" : "Send OTP"}{" "}
                  <ArrowRight className="size-4" strokeWidth={1.6} />
                </Btn>
              ))}
            {step === 1 && (
              <Btn className="flex-1" onClick={saveNeetDetails} disabled={saving || matching}>
                {matching ? "Finding your matches…" : saving ? "Saving…" : "Continue"}{" "}
                <ArrowRight className="size-4" strokeWidth={1.6} />
              </Btn>
            )}
            {step === 2 && (
              <Btn className="flex-1" onClick={() => navigate({ to: "/ai-match" })}>
                See my matches <ArrowRight className="size-4" strokeWidth={1.6} />
              </Btn>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-2">
        {label}
      </span>
      {children}
    </label>
  );
}
