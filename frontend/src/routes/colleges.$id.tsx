import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, GitCompare, MapPin, ShieldCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Btn, LockOverlay, Num, Panel, Pill } from "@/components/kit";
import { ApiUnreachable } from "@/components/api-unreachable";
import { inr, rank as fmtRank, type CutoffRow } from "@/lib/catalog";
import { fetchCollege, toggleSaveCollege, type CollegeDetail } from "@/lib/api";
import { ApiClientError } from "@/lib/api-client";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/colleges/$id")({
  loader: async ({ params }) => {
    try {
      const detail = await fetchCollege(params.id);
      return { detail, apiDown: false as const };
    } catch (err) {
      // Distinguish "the backend is unreachable" (network error, status 0, or a 5xx) from a
      // genuine "this college id doesn't exist" (a real 404 from the backend). Only the
      // latter should render a not-found page — the former should say so clearly instead
      // of silently pretending the college doesn't exist.
      if (err instanceof ApiClientError && err.status !== 0 && err.status < 500) {
        throw notFound();
      }
      return { detail: null, apiDown: true as const };
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData || !loaderData.detail)
      return {
        meta: [
          { title: "College unavailable — MedPath by Vidyarthi Mitra" },
          { name: "robots", content: "noindex" },
        ],
      };
    const c = loaderData.detail.college;
    const title = `${c.name}, ${c.city} — fees, cutoffs & seats | MedPath by Vidyarthi Mitra`;
    const description = `${c.name} in ${c.city}: ${c.seats == null ? "intake information unavailable" : `${c.seats} seats`}, ${c.ownership} ownership, ${c.feeFrom != null ? `fees from ${inr(c.feeFrom)} per year` : "published fee information"} and category-wise cutoffs.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CollegeDetails,
});

const TABS = ["Overview", "Facilities", "Admission process"] as const;

function CollegeDetails() {
  const { detail, apiDown } = Route.useLoaderData();
  if (apiDown || !detail) return <ApiUnreachable />;
  return <CollegeContent key={detail.college.id} initial={detail} />;
}

function CollegeContent({ initial }: { initial: CollegeDetail }) {
  const [detail, setDetail] = useState(initial);
  const { college, cutoffs } = detail;
  const { saved, toggleSaved, compare, toggleCompare, premium, user, authLoading } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [cover, setCover] = useState(0);
  useEffect(() => {
    let current = true;
    if (!authLoading) {
      setDetail(initial);
      fetchCollege(initial.college.id)
        .then((data) => {
          if (current) setDetail(data);
        })
        .catch(() => {});
    }
    return () => {
      current = false;
    };
  }, [initial, user?.id, premium, authLoading]);

  const free = cutoffs.rows;
  const lockedCount = cutoffs.lockedCount;
  const isLocked = cutoffs.locked;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      {/* Header */}
      <Panel className="overflow-hidden">
        <div className="h-48 bg-gradient-to-br from-teal-700 to-ink-3 md:h-80">
          {college.images?.[cover] && (
            <img
              src={college.images[cover]}
              alt={`${college.name} campus`}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          )}
        </div>
        {(college.images?.length || 0) > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {college.images!.map((url, index) => (
              <button
                key={url}
                aria-label={`View campus photo ${index + 1}`}
                aria-pressed={cover === index}
                onClick={() => setCover(index)}
                className={cn(
                  "shrink-0 overflow-hidden rounded-lg border-2",
                  cover === index ? "border-teal-600" : "border-transparent",
                )}
              >
                <img
                  src={url}
                  alt={`Campus photo ${index + 1}`}
                  loading="lazy"
                  className="h-14 w-20 object-cover"
                />
              </button>
            ))}
          </div>
        )}
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-1.5">
                <Pill
                  tone={
                    college.ownership === "Government"
                      ? "teal"
                      : college.ownership === "Deemed"
                        ? "sky"
                        : "gray"
                  }
                  dot
                >
                  {college.ownership}
                </Pill>
                <Pill tone="sky" dot>
                  {college.quota} quota
                </Pill>
                {college.courses.map((c) => (
                  <Pill key={c} tone="teal">
                    {c}
                  </Pill>
                ))}
              </div>
              <h1 className="mt-3 text-[26px] leading-tight md:text-[34px]">{college.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" strokeWidth={1.6} /> {college.city}, {college.state}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4" strokeWidth={1.6} /> {college.affiliation}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Btn
                variant="ghost"
                onClick={async () => {
                  const nowSaved = !saved.includes(college.id);
                  toggleSaved(college.id);
                  try {
                    await toggleSaveCollege(college.id, nowSaved);
                    toast.success(nowSaved ? "Saved to your list" : "Removed from saved");
                  } catch {
                    toggleSaved(college.id);
                    toast.error("Log in to save colleges");
                  }
                }}
              >
                <Heart
                  className={cn("size-4", saved.includes(college.id) && "fill-rose text-rose")}
                  strokeWidth={1.6}
                />
                {saved.includes(college.id) ? "Saved" : "Save"}
              </Btn>
              <Btn
                variant="ghost"
                onClick={() => {
                  toggleCompare(college.id);
                  toast.success("Compare list updated");
                }}
              >
                <GitCompare className="size-4" strokeWidth={1.6} />
                {compare.includes(college.id) ? "In compare" : "Add to compare"}
              </Btn>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line-2 pt-5 md:grid-cols-4">
            {[
              { k: "Total seats", v: college.seats == null ? "N/A" : String(college.seats) },
              {
                k: "Latest cutoff preview",
                v: college.closingRank ? fmtRank(college.closingRank) : "—",
              },
              {
                k: "Merit fee / yr",
                v: college.feeMeritPublished ? inr(college.feeMerit) : "N/A",
              },
              {
                k: "Bond",
                v:
                  college.bondYears == null
                    ? "N/A"
                    : college.bondYears
                      ? `${college.bondYears} yr`
                      : "None",
              },
            ].map((s) => (
              <div key={s.k} className="rounded-[12px] bg-paper p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-2">{s.k}</p>
                <Num className="text-[19px] font-semibold">{s.v}</Num>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {college.closingRank > 0 && (
        <p className="mt-3 text-sm text-muted">
          Latest cutoff preview: {college.closingRankCourse} · {college.closingRankCategory} ·{" "}
          {college.quota} · {college.closingRankYear} · {college.closingRankRound}. Other categories
          and rounds are listed below.
        </p>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Cutoffs */}
        <div className="grid gap-5">
          <Panel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[19px]">Category & year-wise cutoffs</h2>
              <Pill tone="gold" dot>
                {premium ? "Premium unlocked" : `${free.length} rows free`}
              </Pill>
            </div>
            <div className="mt-4 overflow-x-auto">
              <CutoffTable rows={free} />
            </div>
            {isLocked && lockedCount > 0 && (
              <div className="mt-3">
                <LockOverlay
                  title={`${lockedCount} more cutoff rows are locked`}
                  desc="Unlock every category, quota and round for this college — plus every college in the database."
                  cta="Unlock ₹99"
                >
                  <div className="overflow-hidden">
                    <MaskedCutoffTable count={Math.min(lockedCount, 5)} />
                  </div>
                </LockOverlay>
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <div className="flex gap-1.5 overflow-x-auto border-b border-line-2 pb-3">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-[180ms]",
                    tab === t
                      ? "bg-teal-600 text-white"
                      : "text-muted hover:bg-teal-050 hover:text-teal-700",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="pt-4 text-[13.5px] leading-relaxed text-muted">
              {tab === "Overview" && (
                <p>
                  {college.name} is a {college.ownership.toLowerCase()} institution in{" "}
                  {college.city} offering {college.courses.join(", ")} with{" "}
                  <Num>{college.seats ?? "N/A"}</Num> sanctioned seats. Admission is through NEET-UG
                  counselling under the {college.quota} quota, affiliated to {college.affiliation}.
                </p>
              )}
              {tab === "Facilities" && (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {college.facilities.length === 0 && (
                    <li className="text-muted-2">No facilities listed yet.</li>
                  )}
                  {college.facilities.map((f) => (
                    <li key={f} className="rounded-[12px] bg-paper px-3 py-2.5 text-ink">
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              {tab === "Admission process" && (
                <ol className="grid gap-2.5">
                  {[
                    "Qualify NEET-UG with the category-wise cut-off percentile.",
                    `Register for ${college.quota === "AIQ" ? "MCC all-India" : `${college.state} state`} counselling and pay the fee.`,
                    "List this college in your choice order before the round deadline.",
                    "On allotment, report with originals and pay the first-year fee.",
                  ].map((s, i) => (
                    <li key={s} className="flex gap-3">
                      <Num className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-050 text-[12px] font-semibold text-teal-700">
                        {i + 1}
                      </Num>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Panel>
        </div>

        {/* Fees & bond */}
        <div className="grid gap-5">
          <Panel className="p-5">
            <h2 className="text-[19px]">Fees & bond</h2>
            <dl className="mt-4 grid gap-2.5">
              {[
                {
                  k: "State merit fee / yr",
                  v: college.feeMeritPublished ? inr(college.feeMerit) : "N/A",
                },
                {
                  k: "Private / management fee / yr",
                  v: college.feePrivatePublished ? inr(college.feePrivate) : "N/A",
                },
                {
                  k: "Hostel + mess / yr",
                  v: college.hostelFeePublished ? inr(college.hostelMess) : "N/A",
                },
                {
                  k: "Service bond",
                  v:
                    college.bondYears == null
                      ? "N/A"
                      : college.bondYears
                        ? `${college.bondYears} year`
                        : "No bond",
                },
                {
                  k: "Bond penalty",
                  v: college.bondPenalty == null ? "N/A" : inr(college.bondPenalty),
                },
              ].map((r) => (
                <div
                  key={r.k}
                  className="flex items-center justify-between gap-3 rounded-[12px] bg-paper px-3.5 py-3"
                >
                  <dt className="text-[13px] text-muted">{r.k}</dt>
                  <dd>
                    <Num className="text-[15px] font-semibold">{r.v}</Num>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted-2">
              Fees are indicative, sourced from the latest published fee-regulating authority
              notification.
            </p>
          </Panel>

          <Panel className="p-5">
            <h2 className="text-[19px]">Published cutoff data</h2>
            <p className="mt-3 text-[13px] text-muted">
              {free.length > 0
                ? `${free.length} published rows are shown in the cutoff table. Compare records for the same course, category, quota and round.`
                : "Cutoff history will appear after verified records are published."}
            </p>
            {isLocked && lockedCount > 0 && (
              <p className="mt-3 text-[13px] text-muted">
                Your current access includes a preview. A subscription unlocks the remaining
                records.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CutoffTable({ rows }: { rows: CutoffRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-2">
        No cutoff data published yet for this college.
      </p>
    );
  }
  return (
    <table className="w-full min-w-[520px] border-collapse text-left">
      <thead>
        <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted-2">
          <th className="py-2.5 pr-3 font-semibold">Category</th>
          <th className="py-2.5 pr-3 font-semibold">Course / round</th>
          <th className="py-2.5 pr-3 font-semibold">Quota</th>
          <th className="py-2.5 pr-3 font-semibold">Year</th>
          <th className="py-2.5 pr-3 font-semibold">Closing rank</th>
          <th className="py-2.5 pr-3 font-semibold">Seats</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id + r.year} className="border-b border-line-2 last:border-0">
            <td className="py-3 pr-3 text-[13.5px] font-medium">{r.category}</td>
            <td className="py-3 pr-3 text-sm">
              {r.course}
              <p className="text-xs text-muted">
                {r.authority} {r.round}
              </p>
            </td>
            <td className="py-3 pr-3">
              <Pill tone={r.quota === "AIQ" ? "sky" : "gray"}>{r.quota}</Pill>
            </td>
            <td className="py-3 pr-3">
              <Num className="text-[13.5px]">{r.year}</Num>
            </td>
            <td className="py-3 pr-3">
              <Num className="text-[14px] font-semibold">{fmtRank(r.closingRank)}</Num>
            </td>
            <td className="py-3 pr-3">
              <Num className="text-[13.5px]">{r.seats}</Num>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Renders visually-blurred placeholder rows (no real data) purely so the LockOverlay has
// something with the right shape to blur behind it — the actual locked values never leave
// the backend for a non-premium request.
function MaskedCutoffTable({ count }: { count: number }) {
  return (
    <table className="w-full min-w-[520px] border-collapse text-left">
      <thead>
        <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted-2">
          <th className="py-2.5 pr-3 font-semibold">Category</th>
          <th className="py-2.5 pr-3 font-semibold">Quota</th>
          <th className="py-2.5 pr-3 font-semibold">Year</th>
          <th className="py-2.5 pr-3 font-semibold">Closing rank</th>
          <th className="py-2.5 font-semibold">Trend</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: count }).map((_, i) => (
          <tr key={i} className="border-b border-line-2 last:border-0">
            <td className="py-3 pr-3 text-[13.5px] font-medium">••••••</td>
            <td className="py-3 pr-3">
              <Pill tone="gray">•••</Pill>
            </td>
            <td className="py-3 pr-3">
              <Num className="text-[13.5px]">••••</Num>
            </td>
            <td className="py-3 pr-3">
              <Num className="text-[14px] font-semibold">••••••</Num>
            </td>
            <td className="py-3">
              <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted-2">
                <TrendingUp className="size-3.5" strokeWidth={1.6} />
                ••••
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
