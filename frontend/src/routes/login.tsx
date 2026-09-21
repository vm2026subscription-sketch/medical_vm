import { BrandLogo } from "@/components/brand-logo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Table2, Heart, Mail, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Btn, Num, Pill, TextInput } from "@/components/kit";
import { useApp } from "@/lib/app-state";
import { ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in to MedPath by Vidyarthi Mitra — your seat strategy" },
      {
        name: "description",
        content:
          "Log in with your phone number or email OTP to access saved colleges, your AI plan and unlocked cutoffs.",
      },
      { property: "og:title", content: "Log in — MedPath by Vidyarthi Mitra" },
      { property: "og:description", content: "OTP login for your NEET counselling dashboard." },
    ],
  }),
  component: Login,
});

type Mode = "phone" | "email";

function Login() {
  const [mode, setMode] = useState<Mode>("phone");
  const [step, setStep] = useState<"identifier" | "otp">("identifier");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { user, authLoading, requestOtp, verifyOtp, requestEmailOtp, verifyEmailOtp } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) void navigate({ to: user.role === "admin" ? "/admin" : "/dashboard", replace: true });
  }, [user, navigate]);

  const fullPhone = `+91${phone}`;
  const identifierLabel = mode === "phone" ? `+91 ${phone || "•••••"}` : email || "•••••";

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep("identifier");
    setOtp("");
  };

  const sendOtp = async () => {
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
      setStep("otp");
      toast.success(res.devOnlyCode ? `OTP sent (dev code: ${res.devOnlyCode})` : "OTP sent");
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Could not send OTP. Is the API running?",
      );
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      if (mode === "phone") {
        await verifyOtp(fullPhone, otp);
      } else {
        await verifyEmailOtp(email, otp);
      }
      toast.success("Logged in");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Promo */}
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-ink via-ink-3 to-teal-700 p-10 lg:flex">
        <Link to="/" className="flex items-center gap-2 text-white">
          <BrandLogo light />
        </Link>
        <div>
          <h1 className="max-w-md text-[38px] leading-tight text-white">
            Your seat strategy, waiting for you.
          </h1>
          <ul className="mt-6 grid gap-3 text-[14px] text-teal-100">
            {[
              { icon: Heart, t: "Saved colleges and wishlist, synced" },
              { icon: Sparkles, t: "Your AI match plan with reasoning" },
              { icon: Table2, t: "Unlocked cutoffs across every college" },
            ].map((x) => (
              <li key={x.t} className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-[12px] bg-white/10 text-white">
                  <x.icon className="size-4" strokeWidth={1.6} />
                </span>
                {x.t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12px] text-teal-100/80">
          MedPath by Vidyarthi Mitra: guidance for your medical admission journey.
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-col justify-center px-5 py-10 md:px-16">
        <Link to="/" className="mb-8 self-start lg:hidden">
          <BrandLogo />
        </Link>
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-[13px] font-semibold text-muted hover:text-teal-700"
        >
          <ArrowLeft className="size-4" strokeWidth={1.6} /> Back to browsing
        </Link>
        <Pill tone="teal" dot>
          OTP login · no password
        </Pill>
        <h2 className="mt-3 text-[28px]">
          {step === "identifier" ? "Log in to MedPath" : "Enter the OTP"}
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          {step === "identifier"
            ? mode === "phone"
              ? "We'll send a 6-digit code to your mobile number."
              : "We'll send a 6-digit code to your email."
            : `Sent to ${identifierLabel} · valid for 5 minutes.`}
        </p>

        {step === "identifier" && (
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

        <div className="mt-4 grid max-w-sm gap-3">
          {step === "identifier" ? (
            <>
              {mode === "phone" ? (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                    Mobile number
                  </span>
                  <div className="flex gap-2">
                    <span className="num flex h-11 shrink-0 items-center rounded-[12px] border border-line bg-paper px-3 text-sm">
                      +91
                    </span>
                    <TextInput
                      disabled={authLoading}
                      inputMode="numeric"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="98765 43210"
                      className="num"
                    />
                  </div>
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                    Email address
                  </span>
                  <TextInput
                    disabled={authLoading}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="aarav@example.com"
                  />
                </label>
              )}
              <Btn onClick={sendOtp} disabled={sending || authLoading}>
                {sending ? "Sending…" : "Send OTP"}
              </Btn>
            </>
          ) : (
            <>
              <TextInput
                disabled={authLoading}
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="••••••"
                className="num text-center tracking-[0.5em]"
              />
              <Btn onClick={verify} disabled={verifying}>
                {verifying ? "Verifying…" : "Verify & continue"}
              </Btn>
              <button
                onClick={() => setStep("identifier")}
                className="text-[13px] font-semibold text-teal-700 hover:underline"
              >
                {mode === "phone" ? "Change number" : "Change email"}
              </button>
            </>
          )}

          <div className="my-1 flex items-center gap-3 text-[12px] text-muted-2">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <p className="text-[12px] text-muted-2">
            New here?{" "}
            <Link to="/signup" className="font-semibold text-teal-700 hover:underline">
              Create your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
