import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { BtnLink, EmptyState, Num, Panel, Skeleton } from "@/components/kit";
import { inr, rank as fmtRank, type College } from "@/lib/catalog";
import { fetchCollege } from "@/lib/api";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare medical colleges side by side — MedPath by Vidyarthi Mitra" },
      {
        name: "description",
        content:
          "Compare fees, seats, cutoffs, ownership, hostel and location for shortlisted medical, dental and AYUSH colleges.",
      },
      { property: "og:title", content: "Compare colleges — MedPath by Vidyarthi Mitra" },
      {
        property: "og:description",
        content: "Aligned side-by-side comparison of fees, seats and cutoffs.",
      },
    ],
  }),
  component: Compare,
});

function Compare() {
  const { compare, toggleCompare } = useApp();
  const [list, setList] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    if (compare.length === 0) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      compare.map((id) =>
        fetchCollege(id)
          .then((d) => d.college)
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (current) setList(results.filter((c): c is College => c !== null));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [compare]);

  const rows: { label: string; get: (c: College) => string; mono?: boolean }[] = [
    { label: "Location", get: (c) => `${c.city}, ${c.state}` },
    { label: "Ownership", get: (c) => c.ownership },
    { label: "Courses", get: (c) => c.courses.join(", ") },
    { label: "Total seats", get: (c) => (c.seats == null ? "N/A" : String(c.seats)), mono: true },
    {
      label: "Latest closing rank",
      get: (c) => (c.closingRank ? fmtRank(c.closingRank) : "—"),
      mono: true,
    },
    {
      label: "Cutoff context",
      get: (c) =>
        [c.closingRankCourse, c.closingRankCategory, c.quota, c.closingRankYear, c.closingRankRound]
          .filter(Boolean)
          .join(" · "),
    },
    {
      label: "Merit fee / yr",
      get: (c) => (c.feeMeritPublished ? inr(c.feeMerit) : "N/A"),
      mono: true,
    },
    {
      label: "Hostel + mess / yr",
      get: (c) => (c.hostelFeePublished ? inr(c.hostelMess) : "N/A"),
      mono: true,
    },
    {
      label: "Service bond",
      get: (c) => (c.bondYears == null ? "N/A" : c.bondYears ? `${c.bondYears} yr` : "None"),
    },
    {
      label: "Bond penalty",
      get: (c) => (c.bondPenalty == null ? "N/A" : inr(c.bondPenalty)),
      mono: true,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] md:text-[34px]">
            Comparing <Num>{list.length}</Num> colleges
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Same rows, aligned across colleges — no scrolling back and forth.
          </p>
        </div>
        <BtnLink to="/colleges" variant="ghost">
          <Plus className="size-4" strokeWidth={1.6} /> Add college
        </BtnLink>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : list.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing to compare yet"
            sub="Add two or three colleges from the listing and their fees, seats and cutoffs will line up here."
            action={<BtnLink to="/colleges">Browse colleges</BtnLink>}
          />
        </div>
      ) : (
        <Panel className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card px-4 py-4 text-[11px] uppercase tracking-wider text-muted-2">
                  Attribute
                </th>
                {list.map((c) => {
                  return (
                    <th
                      key={c.id}
                      className="min-w-[200px] border-l border-line-2 px-4 py-4 align-top"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="mt-2 text-[14.5px] font-semibold leading-snug">{c.name}</p>
                        </div>
                        <button
                          aria-label="Remove"
                          onClick={() => {
                            toggleCompare(c.id);
                            toast.success("Removed from compare");
                          }}
                          className="shrink-0 text-muted-2 hover:text-rose"
                        >
                          <X className="size-4" strokeWidth={1.6} />
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-line-2">
                  <th className="sticky left-0 bg-card px-4 py-3.5 text-[13px] font-semibold text-muted">
                    {r.label}
                  </th>
                  {list.map((c) => (
                    <td key={c.id} className="border-l border-line-2 px-4 py-3.5 text-[13.5px]">
                      <span className={r.mono ? "num font-semibold" : ""}>{r.get(c)}</span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-line-2">
                <th className="sticky left-0 bg-card px-4 py-3.5" />
                {list.map((c) => (
                  <td key={c.id} className="border-l border-line-2 px-4 py-3.5">
                    <BtnLink to="/colleges/$id" params={{ id: c.id }} variant="ghost" size="sm">
                      View details
                    </BtnLink>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Panel>
      )}

      {list.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <p className="self-center text-sm text-muted">
            Your comparison selection is kept in this browser.
          </p>
          <BtnLink to="/counselling/book" variant="gold">
            Ask an expert which to pick
          </BtnLink>
        </div>
      )}
    </div>
  );
}
