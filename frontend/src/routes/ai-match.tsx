import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Btn,
  BtnLink,
  Dropdown,
  Num,
  Panel,
  Pill,
  ProbabilityBar,
  Skeleton,
  TextInput,
  bandMeta,
} from "@/components/kit";
import { CATEGORIES, COURSE_CODES, STATES, type Band } from "@/lib/catalog";
import { runPredictor } from "@/lib/api";
import type { MatchResult } from "@/lib/catalog";
import { useApp } from "@/lib/app-state";
import { ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-match")({
  head: () => ({
    meta: [
      { title: "AI seat match — predict your NEET college | MedPath by Vidyarthi Mitra" },
      {
        name: "description",
        content:
          "Enter your NEET rank, category, home state and budget to get Safe, Target and Dream college matches with seat probability.",
      },
      { property: "og:title", content: "AI seat match — MedPath by Vidyarthi Mitra" },
      {
        property: "og:description",
        content:
          "Safe / Target / Dream college predictions with probability scores and plain-language reasoning.",
      },
    ],
  }),
  component: AiMatch,
});

const TABS = [
  { key: "all", label: "Best match" },
  { key: "dream", label: "Dream" },
  { key: "target", label: "Target" },
  { key: "safe", label: "Safe" },
] as const;

function AiMatch() {
  const { rank, setRank, isAuthenticated } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [value, setValue] = useState(rank ? String(rank) : "");
  const [category, setCategory] = useState(CATEGORIES[0] ?? "General");
  const [homeState, setHomeState] = useState("Maharashtra");
  const [budget, setBudget] = useState("600000");
  const [selectedCourses, setSelectedCourses] = useState<string[]>(
    COURSE_CODES.filter((c) => ["MBBS", "BDS", "BAMS"].includes(c)),
  );
  const [results, setResults] = useState<MatchResult[]>([]);

  const filtered = results.filter((r) => (tab === "all" ? true : r.band === tab));
  const counts = {
    dream: results.filter((r) => r.band === "dream").length,
    target: results.filter((r) => r.band === "target").length,
    safe: results.filter((r) => r.band === "safe").length,
  };

  const toggleCourse = (code: string) =>
    setSelectedCourses((cur) =>
      cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code],
    );

  const generate = async () => {
    const n = Number(value.replace(/[^0-9]/g, ""));
    if (!n) {
      toast.error("Enter your All India Rank to generate a match");
      return;
    }
    if (!isAuthenticated) {
      toast.error("Log in to generate an AI match — it's saved to your account");
      return;
    }
    if (selectedCourses.length === 0) {
      toast.error("Pick at least one course");
      return;
    }
    setRank(n);
    setLoading(true);
    try {
      const predictorInput: Parameters<typeof runPredictor>[0] = {
        rank: n,
        category,
        state: homeState,
        courses: selectedCourses.map((c) => c.toLowerCase()),
      };
      const budgetNum = Number(budget);
      if (budgetNum) predictorInput.budget = budgetNum;
      const res = await runPredictor(predictorInput);
      setResults(res);
      setRan(true);
      toast.success("Match refreshed for rank " + n.toLocaleString("en-IN"));
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Could not generate a match right now",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="violet" dot>
          AI seat match
        </Pill>
        <Pill tone="gray">Based on prior years' allotment data</Pill>
      </div>
      <h1 className="mt-3 text-[26px] md:text-[34px]">Where your rank can realistically land</h1>

      <div className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr] lg:items-start">
        {/* Input panel */}
        <Panel className="border-violet-100 bg-violet-050 p-5">
          <h2 className="text-[18px]">Your details</h2>
          <div className="mt-4 grid gap-3.5">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                All India Rank
              </span>
              <TextInput
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="54120"
                className="num"
              />
            </label>
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
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                Max tuition / year
              </span>
              <TextInput
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
                className="num"
              />
            </label>
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                Courses
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COURSE_CODES.map((c) => (
                  <CourseChip
                    key={c}
                    code={c}
                    on={selectedCourses.includes(c)}
                    onToggle={() => toggleCourse(c)}
                  />
                ))}
              </div>
            </div>
            <Btn variant="violet" onClick={generate} className="mt-1 w-full" disabled={loading}>
              <Sparkles className="size-4" strokeWidth={1.6} />{" "}
              {loading ? "Generating…" : "Generate my match"}
            </Btn>
            <p className="text-center text-[11.5px] text-muted-2">
              Estimates only — always cross-check the official seat matrix. Matches use AIQ or your
              home-state quota. A tuition limit requires published merit fees and excludes
              hostel/mess charges.
            </p>
          </div>
        </Panel>

        {/* Results */}
        <div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors duration-[180ms]",
                  tab === t.key
                    ? "border-violet-600 bg-violet-600 text-white"
                    : "border-line bg-card text-muted hover:border-violet-100 hover:text-violet-600",
                )}
              >
                {t.label}
                {t.key !== "all" && ` ${counts[t.key]}`}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            {loading ? (
              [0, 1, 2].map((i) => (
                <Panel key={i} className="p-5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-3 h-5 w-2/3" />
                  <Skeleton className="mt-3 h-2 w-full" />
                </Panel>
              ))
            ) : !ran ? (
              <Panel className="p-8 text-center text-[13.5px] text-muted-2">
                Enter your rank and hit "Generate my match" to see your Dream, Target and Safe
                colleges.
              </Panel>
            ) : filtered.length === 0 ? (
              <Panel className="p-8 text-center text-[13.5px] text-muted-2">
                No colleges found in this bucket for your inputs.
              </Panel>
            ) : (
              filtered.map((r) => <ResultCard key={r.id} {...r} />)
            )}
          </div>

          <div className="mt-5 rounded-[22px] border border-gold-100 bg-gold-050 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[17px]">Get your suggested choice-filling order</h3>
                <p className="mt-1 text-[13px] text-muted">
                  The exact sequence to submit — safe seats protected, dream seats still in play.
                </p>
              </div>
              <BtnLink to="/upgrade" variant="gold" className="shrink-0">
                Unlock ₹99
              </BtnLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseChip({ code, on, onToggle }: { code: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors duration-[180ms]",
        on ? "border-violet-600 bg-violet-100 text-violet-600" : "border-line bg-card text-muted",
      )}
    >
      {code}
    </button>
  );
}

function ResultCard({
  band,
  probability,
  college,
  course,
  reason,
}: {
  band: Band;
  probability: number;
  college: string;
  course: string;
  reason: string;
}) {
  const meta = bandMeta[band];
  return (
    <Panel className="p-5 transition-shadow duration-[180ms] hover:shadow-sh-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Pill tone={meta.tone} dot>
            {meta.label} · <Num>{probability}%</Num>
          </Pill>
          <h3 className="mt-2.5 text-[17px] leading-snug">{college}</h3>
          <p className="text-[13px] text-muted">{course}</p>
        </div>
        <Num className={cn("shrink-0 text-[34px] font-semibold leading-none", meta.text)}>
          {probability}%
        </Num>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{reason}</p>
      <div className="mt-3.5">
        <ProbabilityBar band={band} value={probability} />
      </div>
    </Panel>
  );
}
