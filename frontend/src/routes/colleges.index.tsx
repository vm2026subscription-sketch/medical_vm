import { createFileRoute, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BtnLink, Btn, CollegeCard, Dropdown, EmptyState, Num, SearchBar } from "@/components/kit";
import { CourseSelect } from "@/components/course-select";
import { QUOTAS, STATES } from "@/lib/catalog";
import { useCategoryOptions } from "@/lib/category-options";
import {
  collegeSearch,
  collegeQuery,
  FEE_FILTERS,
  type CollegeSearch,
} from "@/lib/college-filters";
import { fetchColleges, fetchCourses, toggleSaveCollege } from "@/lib/api";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/colleges/")({
  validateSearch: collegeSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [result, courses] = await Promise.allSettled([
      fetchColleges(collegeQuery(deps)),
      fetchCourses(),
    ]);
    return {
      colleges: result.status === "fulfilled" ? result.value.items : [],
      total: result.status === "fulfilled" ? result.value.total : 0,
      page: result.status === "fulfilled" ? result.value.page : deps.page || 1,
      totalPages: result.status === "fulfilled" ? result.value.totalPages : 1,
      courseOptions: courses.status === "fulfilled" ? courses.value : [],
      apiDown: result.status === "rejected",
      coursesDown: courses.status === "rejected",
    };
  },
  head: () => ({
    meta: [
      { title: "Medical, nursing & healthcare colleges — MedPath by Vidyarthi Mitra" },
      {
        name: "description",
        content:
          "Explore medical, nursing, pharmacy and allied health colleges across India. Filter published records by course, state, category, quota and tuition fee.",
      },
    ],
  }),
  component: CollegeListing,
});

const OWNERSHIPS = ["All ownership", "Government", "Private", "Deemed"];
const ownershipValues = ["", "govt", "private", "deemed"];

function CollegeListing() {
  const { colleges, total, page, totalPages, courseOptions, apiDown, coursesDown } =
    Route.useLoaderData();
  const filters = Route.useSearch();
  const categories = useCategoryOptions("colleges", filters.category);
  const navigate = Route.useNavigate();
  const router = useRouter();
  const pending = useRouterState({ select: (state) => state.isLoading });
  const { saved, toggleSaved, toggleCompare } = useApp();
  const [query, setQuery] = useState(filters.search || "");
  useEffect(() => setQuery(filters.search || ""), [filters.search]);
  const update = (patch: CollegeSearch) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch, page: patch.page || 1 }) });
  const reset = () => {
    setQuery("");
    void navigate({ search: {} });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <h1 className="text-[26px] md:text-[34px]">Colleges</h1>
      <p className="mt-1.5 text-sm text-muted">
        Explore medical, nursing, pharmacy and allied health colleges across India.
      </p>
      <BtnLink to="/courses" variant="link" size="sm">
        Explore all courses
      </BtnLink>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          update({ search: query.trim() || undefined });
        }}
      >
        <SearchBar
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search college, city or state"
          aria-label="Search colleges"
          maxLength={150}
          disabled={pending}
        />
        <Btn type="submit" disabled={pending}>
          Search
        </Btn>
      </form>
      <div className="mt-3 grid gap-3 rounded-[16px] border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <CourseSelect
          courses={courseOptions}
          value={filters.course || ""}
          onChange={(course) => update({ course: course || undefined })}
          disabled={pending || coursesDown}
        />
        <Dropdown
          label="State / UT"
          options={["All states / UTs", ...STATES]}
          value={filters.state || "All states / UTs"}
          onChange={(event) =>
            update({
              state: event.target.value === "All states / UTs" ? undefined : event.target.value,
            })
          }
          disabled={pending}
        />
        <Dropdown
          label="Ownership"
          options={OWNERSHIPS}
          value={OWNERSHIPS[ownershipValues.indexOf(filters.ownership || "")]}
          onChange={(event) =>
            update({
              ownership: ownershipValues[OWNERSHIPS.indexOf(event.target.value)] || undefined,
            })
          }
          disabled={pending}
        />
        <Dropdown
          label="Annual tuition"
          options={FEE_FILTERS.map((fee) => fee.label)}
          value={FEE_FILTERS.find((fee) => fee.value === (filters.fee || ""))?.label || "Any fee"}
          onChange={(event) =>
            update({
              fee: FEE_FILTERS.find((fee) => fee.label === event.target.value)?.value || undefined,
            })
          }
          disabled={pending}
        />
        <Dropdown
          label="Category"
          options={["All categories", ...categories]}
          value={filters.category || "All categories"}
          onChange={(event) =>
            update({
              category: event.target.value === "All categories" ? undefined : event.target.value,
            })
          }
          disabled={pending}
        />
        <Dropdown
          label="Quota"
          options={["All quotas", ...QUOTAS]}
          value={filters.quota || "All quotas"}
          onChange={(event) =>
            update({ quota: event.target.value === "All quotas" ? undefined : event.target.value })
          }
          disabled={pending}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        All published courses are available in the course menu. Category and quota filters use
        published seat or cutoff records. Fee filters include only colleges with a published tuition
        fee.
      </p>
      {coursesDown && (
        <div role="alert" className="mt-3 text-sm">
          The course list could not load.{" "}
          <Btn variant="link" onClick={() => void router.invalidate()}>
            Retry
          </Btn>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p role="status" className="mr-auto text-sm text-muted">
          {pending ? (
            "Updating colleges…"
          ) : (
            <>
              <Num>{total}</Num> matching colleges · Page <Num>{page}</Num> of{" "}
              <Num>{totalPages}</Num>
            </>
          )}
        </p>
        <Btn variant="link" size="sm" onClick={reset} disabled={pending}>
          Clear filters
        </Btn>
        <BtnLink to="/compare" variant="link" size="sm">
          Compare selected
        </BtnLink>
      </div>
      <div aria-busy={pending}>
        {apiDown ? (
          <div role="alert" className="mt-6 rounded-xl border border-line bg-card p-6">
            <p>Colleges could not load. Please try again.</p>
            <Btn className="mt-3" onClick={() => void router.invalidate()}>
              Retry colleges
            </Btn>
          </div>
        ) : colleges.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No colleges match these filters"
              sub="No published college records match this combination yet. Try another course or clear the filters."
              action={
                <Btn variant="ghost" onClick={reset}>
                  Show all colleges
                </Btn>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {colleges.map((college) => (
              <CollegeCard
                key={college.id}
                college={college}
                saved={saved.includes(college.id)}
                onSave={async () => {
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
                onCompare={() => {
                  toggleCompare(college.id);
                  toast.success("Compare list updated");
                }}
              />
            ))}
          </div>
        )}
      </div>
      {!apiDown && totalPages > 1 && (
        <nav aria-label="College pages" className="mt-6 flex items-center justify-center gap-4">
          <Btn
            variant="ghost"
            disabled={pending || page <= 1}
            onClick={() => update({ page: page - 1 })}
          >
            Previous
          </Btn>
          <span className="text-sm">
            {page} / {totalPages}
          </span>
          <Btn
            variant="ghost"
            disabled={pending || page >= totalPages}
            onClick={() => update({ page: page + 1 })}
          >
            Next
          </Btn>
        </nav>
      )}
    </div>
  );
}
