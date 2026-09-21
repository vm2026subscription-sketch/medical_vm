import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  Btn,
  BtnLink,
  Dropdown,
  LockOverlay,
  Num,
  Panel,
  Pill,
  SearchBar,
  Skeleton,
} from "@/components/kit";
import {
  COURSE_CODES,
  QUOTAS,
  YEARS,
  STATES,
  rank as fmtRank,
  type CutoffRow,
} from "@/lib/catalog";
import { fetchCutoffs } from "@/lib/api";
import { useCategoryOptions } from "@/lib/category-options";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cutoffs")({
  head: () => ({
    meta: [
      { title: "NEET-UG cutoffs by category & quota — MedPath by Vidyarthi Mitra" },
      {
        name: "description",
        content:
          "Category and quota-wise NEET-UG closing ranks for MBBS, BDS and AYUSH colleges, with seat counts and year-on-year trend.",
      },
      { property: "og:title", content: "NEET-UG cutoff explorer — MedPath by Vidyarthi Mitra" },
      {
        property: "og:description",
        content:
          "Closing ranks by college, category, quota and year. Five rows free, full database with the ₹99 Season Pass.",
      },
    ],
  }),
  component: CutoffPage,
});

function CutoffPage() {
  const [q, setQ] = useState("");
  const [course, setCourse] = useState("All courses");
  const [category, setCategory] = useState("All categories");
  const [retry, setRetry] = useState(0);
  const categories = useCategoryOptions(
    "cutoffs",
    category === "All categories" ? undefined : category,
    retry,
  );
  const [quota, setQuota] = useState("All quotas");
  const [year, setYear] = useState("All years");
  const [state, setState] = useState("All states / UTs");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [error, setError] = useState(false);
  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const [loading, setLoading] = useState(true);
  const [free, setFree] = useState<CutoffRow[]>([]);
  const [maskedPreview, setMaskedPreview] = useState<CutoffRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [lockedCount, setLockedCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params: Record<string, string> = {
      page: String(page),
      limit: "20",
    };
    if (category !== "All categories") params["category"] = category;
    if (quota !== "All quotas") params["quota"] = quota;
    if (year !== "All years") params["year"] = year;
    if (state !== "All states / UTs") params["state"] = state;
    if (course !== "All courses") params["course"] = course.toLowerCase();
    if (q) params["search"] = q;

    const timer = setTimeout(() => {
      fetchCutoffs(params)
        .then((res) => {
          if (cancelled) return;
          setFree(res.rows);
          setMaskedPreview(res.maskedPreview);
          setTotalCount(res.totalCount);
          setLockedCount(res.lockedCount);
          setIsPremium(res.isPremium);
          setLimit(res.limit);
          setPage(res.page);
        })
        .catch(() => {
          if (!cancelled) {
            setError(true);
            setFree([]);
            setMaskedPreview([]);
            setTotalCount(0);
            setLockedCount(0);
          }
        })
        .finally(() => !cancelled && setLoading(false));
    }, 250); // small debounce so typing in search doesn't fire a request per keystroke

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, course, category, quota, year, state, page, retry]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <h1 className="text-[26px] md:text-[34px]">Cutoff explorer</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-muted">
        Closing ranks straight from each round's allotment result. Pick your category and quota —
        the numbers change a lot between them.
      </p>

      <Panel className="mt-5 p-4">
        <SearchBar
          value={q}
          onChange={(e) => changeFilter(setQ, e.target.value)}
          placeholder="Search a college"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Dropdown
            label="Course"
            options={["All courses", ...COURSE_CODES]}
            value={course}
            onChange={(e) => changeFilter(setCourse, e.target.value)}
          />
          <Dropdown
            label="Category"
            options={["All categories", ...categories]}
            value={category}
            onChange={(e) => changeFilter(setCategory, e.target.value)}
          />
          <Dropdown
            label="Quota"
            options={["All quotas", ...QUOTAS]}
            value={quota}
            onChange={(e) => changeFilter(setQuota, e.target.value)}
          />
          <Dropdown
            label="Year"
            options={["All years", ...YEARS]}
            value={year}
            onChange={(e) => changeFilter(setYear, e.target.value)}
          />
          <Dropdown
            label="State / UT"
            options={["All states / UTs", ...STATES]}
            value={state}
            onChange={(e) => changeFilter(setState, e.target.value)}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          NEET course filters are shown here. For nursing, pharmacy and other healthcare options,{" "}
          <BtnLink to="/courses" variant="link" size="sm">
            explore all courses
          </BtnLink>
          .
        </p>
      </Panel>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Btn
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => setRetry((value) => value + 1)}
        >
          Refresh cutoffs
        </Btn>
        <span className="text-xs text-muted">Newest year and counselling round first</span>
        <p className="text-[14px] font-semibold">
          <Num>{totalCount}</Num> cutoff records match
        </p>
        {!isPremium && (
          <Pill tone="gold" dot>
            <Num>{free.length}</Num> shown free
          </Pill>
        )}
        {isPremium && (
          <Pill tone="emerald" dot>
            Season Pass active · all rows
          </Pill>
        )}
        <Pill tone="sky">
          {quota} · {category} · {year}
        </Pill>
      </div>

      {loading ? (
        <div className="mt-3 grid gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <div role="alert" className="mt-4 rounded-xl border border-line bg-card p-5">
          Cutoffs could not load.{" "}
          <Btn variant="link" onClick={() => setRetry((value) => value + 1)}>
            Retry cutoffs
          </Btn>
        </div>
      ) : (
        <>
          <Panel className="mt-3 overflow-hidden">
            <div className="overflow-x-auto">
              <Table rows={free} />
            </div>
          </Panel>

          <div className="mt-3">
            {isPremium ? (
              lockedCount === 0 && (
                <p className="px-1 text-[12.5px] text-muted">
                  Showing <Num>{free.length}</Num> of <Num>{totalCount}</Num> matching rows · Page{" "}
                  {page} of {Math.max(1, Math.ceil(totalCount / limit))}.
                </p>
              )
            ) : lockedCount > 0 ? (
              <LockOverlay
                title={`${lockedCount} more cutoff records are locked`}
                desc="Every category, quota and round for every matching college, plus downloadable seat matrix and choice-filling order."
              >
                <div className="rounded-[16px] border border-line bg-card">
                  <Table rows={maskedPreview} masked />
                </div>
              </LockOverlay>
            ) : null}
          </div>
          {isPremium && totalCount > limit && (
            <nav aria-label="Cutoff pages" className="mt-5 flex items-center justify-center gap-4">
              <Btn
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Btn>
              <span className="text-sm">
                {page} / {Math.ceil(totalCount / limit)}
              </span>
              <Btn
                variant="ghost"
                disabled={page >= Math.ceil(totalCount / limit)}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Btn>
            </nav>
          )}
        </>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-muted-2">
        Cutoffs are last-round closing ranks and are indicative only. Verify with the official
        counselling authority before locking your choices.
      </p>
    </div>
  );
}

function Table({ rows, masked = false }: { rows: CutoffRow[]; masked?: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[13px] text-muted-2">
        No cutoffs match these filters yet.
      </p>
    );
  }
  return (
    <table className="w-full min-w-[680px] border-collapse text-left">
      <thead className="bg-paper">
        <tr className="text-[11px] uppercase tracking-wider text-muted-2">
          <th className="px-4 py-3 font-semibold">College</th>
          <th className="px-4 py-3 font-semibold">Category</th>
          <th className="px-4 py-3 font-semibold">Quota</th>
          <th className="px-4 py-3 font-semibold">{`Year close(s)`}</th>
          <th className="px-4 py-3 font-semibold">Seats</th>
          {!masked && <th className="px-4 py-3 font-semibold">Trend</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.id}
            className="border-t border-line-2 transition-colors duration-[180ms] hover:bg-teal-050/60"
          >
            <td className="px-4 py-3.5">
              <p
                className={cn(
                  "text-[14px] font-semibold leading-snug",
                  masked && "blur-[3px] select-none",
                )}
              >
                {r.college}
              </p>
              <p className="text-[12px] text-muted">{r.course}</p>
              <p className="text-xs text-muted">
                {r.authority} {r.round}
              </p>
            </td>
            <td className="px-4 py-3.5 text-[13.5px]">{r.category}</td>
            <td className="px-4 py-3.5">
              <Pill tone={r.quota === "AIQ" ? "sky" : "gray"}>{r.quota}</Pill>
            </td>
            <td className="px-4 py-3.5">
              <Num
                className={cn("text-[14.5px] font-semibold", masked && "blur-[3px] select-none")}
              >
                {masked ? "••••••" : fmtRank(r.closingRank)}
              </Num>
              <p className="num text-[11px] text-muted-2">{r.year}</p>
            </td>
            <td className="px-4 py-3.5">
              <Num className={cn("text-[13.5px]", masked && "blur-[3px] select-none")}>
                {masked ? "••" : r.seats}
              </Num>
            </td>
            {!masked && (
              <td className="px-4 py-3.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold",
                    r.trend === "tighter" ? "bg-rose-050 text-rose" : "bg-emerald-050 text-emerald",
                  )}
                >
                  {r.trend === "tighter" ? (
                    <TrendingUp className="size-3.5" strokeWidth={1.6} />
                  ) : (
                    <TrendingDown className="size-3.5" strokeWidth={1.6} />
                  )}
                  <Num>{fmtRank(r.delta)}</Num>
                </span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
