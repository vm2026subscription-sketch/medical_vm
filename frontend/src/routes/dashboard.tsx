import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Heart, Download, FileText } from "lucide-react";
import { BtnLink, CollegeCard, Num, Panel, Pill, Skeleton } from "@/components/kit";
import type { College } from "@/lib/catalog";
import { fetchDashboardOverview } from "@/lib/api";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your counselling dashboard — MedPath by Vidyarthi Mitra" },
      {
        name: "description",
        content:
          "Track saved colleges, deadlines, downloads, bookings and payments through the NEET counselling season.",
      },
      { property: "og:title", content: "Student dashboard — MedPath by Vidyarthi Mitra" },
      {
        property: "og:description",
        content: "Saved colleges, next deadline countdown and your premium status.",
      },
    ],
  }),
  component: Dashboard,
});

const navItems = [
  { label: "Overview", icon: LayoutDashboard, section: "overview" },
  { label: "Saved colleges", icon: Heart, section: "saved-colleges" },
  { label: "Recent activity", icon: FileText, section: "recent-activity" },
  { label: "Downloads", icon: Download, section: "downloads" },
];

interface Overview {
  nextDeadline: { title: string; date: string; sourceUrl?: string } | null;
  isPremium: boolean;
  savedColleges: { collegeId: College & { _id: string }; tag?: string }[];
  downloads: { _id: string; title: string; type: string }[];
  recentActivity: {
    type: string;
    at: string;
    data: { counsellorId?: { userId?: { name?: string } }; result?: unknown[] };
  }[];
}

function activityText(item: Overview["recentActivity"][number]) {
  if (item.type === "booking")
    return `Booked a counselling session with ${item.data?.counsellorId?.userId?.name ?? "an expert"}`;
  if (item.type === "prediction")
    return `Ran an AI seat match (${item.data?.result?.length ?? 0} results)`;
  return "Activity";
}

function useCountdown(targetDate: string | null) {
  const [left, setLeft] = useState({ d: 0, h: 0, m: 0 });
  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();
    const tick = () => {
      const diff = Math.max(target - Date.now(), 0);
      setLeft({
        d: Math.floor(diff / (24 * 60 * 60 * 1000)),
        h: Math.floor((diff / (60 * 60 * 1000)) % 24),
        m: Math.floor((diff / (60 * 1000)) % 60),
      });
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [targetDate]);
  return left;
}

function Dashboard() {
  const { studentName, isAuthenticated, authLoading } = useApp();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchDashboardOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, attempt]);

  const left = useCountdown(overview?.nextDeadline?.date ?? null);

  if (authLoading)
    return (
      <div className="mx-auto max-w-6xl p-8">
        <Skeleton className="h-56" />
      </div>
    );
  if (!isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center md:px-6">
        <h1 className="text-[24px]">Log in to see your dashboard</h1>
        <p className="mt-2 text-sm text-muted">
          Your saved colleges, deadlines and premium status live here once you're signed in.
        </p>
        <BtnLink to="/login" variant="primary" className="mt-5">
          Log in
        </BtnLink>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <Skeleton className="h-8 w-64" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error)
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <p>Could not load your dashboard. Please try again.</p>
        <button className="mt-4 underline" onClick={() => setAttempt((value) => value + 1)}>
          Retry
        </button>
      </div>
    );

  const savedColleges = (overview?.savedColleges ?? []).map((saved) => saved.collegeId);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start">
        {/* Sidebar */}
        <Panel className="min-w-0 p-3 lg:sticky lg:top-24">
          <nav className="flex gap-1.5 overflow-x-auto lg:grid">
            {navItems.map((n) => (
              <a
                key={n.label}
                href={"#" + n.section}
                className="flex shrink-0 items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[13.5px] font-semibold text-muted hover:bg-paper"
              >
                <n.icon className="size-4" strokeWidth={1.6} />
                {n.label}
              </a>
            ))}
          </nav>
        </Panel>

        <div className="grid min-w-0 gap-5">
          <div id="overview" className="scroll-mt-24">
            <h1 className="text-[26px] md:text-[32px]">Welcome back, {studentName}</h1>
            <p className="mt-1 text-sm text-muted">
              {overview?.nextDeadline?.title ?? "No deadline scheduled yet."}
            </p>
          </div>

          {/* Top cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] bg-gradient-to-br from-ink-2 via-ink-3 to-teal-700 p-5 shadow-sh-2">
              <Pill tone="teal" dot>
                Next deadline
              </Pill>
              <p className="mt-3 text-[14px] text-teal-100">
                {overview?.nextDeadline?.title ?? "—"}
              </p>
              {overview?.nextDeadline ? (
                <div className="mt-3 flex items-end gap-3 text-white">
                  {[
                    { v: left.d, l: "days" },
                    { v: left.h, l: "hrs" },
                    { v: left.m, l: "mins" },
                  ].map((x) => (
                    <div key={x.l}>
                      <Num className="text-[34px] font-semibold leading-none">
                        {String(x.v).padStart(2, "0")}
                      </Num>
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-teal-100">
                        {x.l}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-teal-100">
                  No verified upcoming deadline has been published.
                </p>
              )}
              {overview?.nextDeadline?.sourceUrl && (
                <a
                  className="mt-3 inline-block text-xs text-teal-100 underline"
                  href={overview.nextDeadline.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View official notice
                </a>
              )}
            </div>

            <div className="rounded-[22px] border border-gold-100 bg-gold-050 p-5">
              <Pill tone="gold" dot>
                {overview?.isPremium ? "Premium ✦ active" : "Free plan"}
              </Pill>
              <p className="mt-3 text-[15px] font-semibold">
                {overview?.isPremium
                  ? "Season Pass · all cutoffs unlocked"
                  : "Unlock every college's cutoffs"}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {overview?.isPremium
                  ? "Includes seat matrix downloads and premium alerts."
                  : "One-time ₹99, valid the whole counselling season."}
              </p>
              <BtnLink
                to="/upgrade"
                variant={overview?.isPremium ? "ghost" : "gold"}
                className="mt-4"
              >
                {overview?.isPremium ? "Manage plan" : "Unlock ₹99"}
              </BtnLink>
            </div>
          </div>

          {/* Saved shelf */}
          <div id="saved-colleges" className="scroll-mt-24">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-[20px]">Saved colleges</h2>
              <BtnLink to="/colleges" variant="link" size="sm">
                Browse more
              </BtnLink>
            </div>
            {savedColleges.length === 0 ? (
              <p className="text-[13.5px] text-muted-2">
                No saved colleges yet — browse and tap Save on any card.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {savedColleges.map((college) => (
                  <CollegeCard key={college.id} college={college} />
                ))}
              </div>
            )}
          </div>

          {/* Bottom panels */}
          <div className="grid gap-4 md:grid-cols-2">
            <Panel className="p-5">
              <h2 id="recent-activity" className="scroll-mt-24 text-[18px]">
                Recent activity
              </h2>
              {!overview?.recentActivity || overview.recentActivity.length === 0 ? (
                <p className="mt-4 text-[13.5px] text-muted-2">
                  Nothing yet — book a call or run an AI match to see activity here.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {overview.recentActivity.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 border-b border-line-2 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-[13.5px]">{activityText(a)}</span>
                      <Num className="shrink-0 text-[11.5px] text-muted-2">
                        {new Date(a.at).toLocaleDateString("en-IN")}
                      </Num>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="p-5">
              <h2 id="downloads" className="scroll-mt-24 text-[18px]">
                Download history
              </h2>
              {!overview?.downloads || overview.downloads.length === 0 ? (
                <p className="mt-4 text-[13.5px] text-muted-2">No downloads yet.</p>
              ) : (
                <ul className="mt-4 grid gap-2.5">
                  {overview.downloads.map((d) => (
                    <li
                      key={d._id}
                      className="flex items-center gap-3 rounded-[12px] bg-paper px-3.5 py-3"
                    >
                      <FileText className="size-4 shrink-0 text-teal-700" strokeWidth={1.6} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                        {d.title}
                      </span>
                      <Num className="text-[11.5px] text-muted-2">{d.type}</Num>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
