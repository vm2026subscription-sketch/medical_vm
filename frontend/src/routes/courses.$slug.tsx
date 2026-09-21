import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { BtnLink, Num, Panel, Pill } from "@/components/kit";
import { ApiUnreachable } from "@/components/api-unreachable";
import { inr } from "@/lib/catalog";
import { fetchCourse, fetchCourses } from "@/lib/api";
import { ApiClientError } from "@/lib/api-client";

export const Route = createFileRoute("/courses/$slug")({
  loader: async ({ params }) => {
    try {
      const [course, allCourses] = await Promise.all([fetchCourse(params.slug), fetchCourses()]);
      return { course, allCourses, apiDown: false as const };
    } catch (err) {
      if (err instanceof ApiClientError && err.status !== 0 && err.status < 500) {
        throw notFound();
      }
      return { course: null, allCourses: [], apiDown: true as const };
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData || !loaderData.course)
      return {
        meta: [
          { title: "Course unavailable — MedPath by Vidyarthi Mitra" },
          { name: "robots", content: "noindex" },
        ],
      };
    const c = loaderData.course;
    const title = `${c.code} — ${c.name}: eligibility, fees & career | MedPath by Vidyarthi Mitra`;
    const description = `${c.code} (${c.duration}): NEET-UG eligibility, government vs private fee range and the career path after graduation.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CoursePage,
});

function CoursePage() {
  const { course, allCourses, apiDown } = Route.useLoaderData();
  if (apiDown || !course) return <ApiUnreachable />;
  const max = Math.max(course.privateFee?.[1] || 0, course.govFee?.[1] || 0, 1);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <div className="mb-4">
        <BtnLink to="/courses" variant="link" size="sm">
          All courses
        </BtnLink>
      </div>
      <Pill tone="teal" dot>
        {course.duration}
      </Pill>
      <h1 className="mt-3 text-[28px] leading-tight md:text-[40px]">
        {course.code} — {course.name}
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">{course.about}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Pill>{course.discipline}</Pill>
        {course.level && <Pill>{course.level}</Pill>}
      </div>
      <Panel className="mt-5 p-5">
        <h2 className="text-[19px]">Admission route</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{course.admissionNotes}</p>
      </Panel>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Panel className="p-5">
          <h2 className="text-[19px]">Eligibility</h2>
          <ul className="mt-4 grid gap-2.5">
            {course.eligibility.map((e) => (
              <li key={e} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-600" strokeWidth={1.6} />
                <span className="text-ink">{e}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-[19px]">Fee range by ownership</h2>
          <p className="mt-1 text-[13px] text-muted">Annual tuition, excluding hostel and mess.</p>
          <div className="mt-5 grid gap-5">
            <FeeBar
              label="Government"
              range={course.govFee}
              max={max}
              bar="bg-emerald"
              tone="emerald"
              note="Safe on budget"
            />
            <FeeBar
              label="Private / Deemed"
              range={course.privateFee}
              max={max}
              bar="bg-gold-600"
              tone="gold"
              note="Plan finances early"
            />
          </div>
        </Panel>
      </div>

      <Panel className="mt-5 p-5">
        <h2 className="text-[19px]">Career path</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {course.career.map((c, i) => (
            <span key={c} className="flex items-center gap-2">
              <span className="rounded-full border border-teal-100 bg-teal-050 px-3.5 py-2 text-[13px] font-semibold text-teal-700">
                {c}
              </span>
              {i < course.career.length - 1 && (
                <ArrowRight className="size-4 text-muted-2" strokeWidth={1.6} />
              )}
            </span>
          ))}
        </div>
      </Panel>

      <div className="mt-5 flex flex-wrap gap-2">
        <BtnLink to="/colleges" search={{ course: course.slug }} variant="primary">
          See {course.code} colleges
        </BtnLink>
        {course.admissionRoute === "neet-ug" && (
          <BtnLink to="/cutoffs" variant="ghost">
            Explore NEET cutoffs
          </BtnLink>
        )}
      </div>

      {course.sourceUrls.length > 0 && (
        <Panel className="mt-5 p-5">
          <h2 className="text-[19px]">Official sources</h2>
          <p className="mt-2 text-xs text-muted">
            Reviewed {course.reviewedOn || "by the catalogue team"}. Verify the current
            admission-year prospectus before applying.
          </p>
          <ul className="mt-3 grid gap-2">
            {course.sourceUrls
              .filter((url) => url.startsWith("https://"))
              .map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sm text-teal-700 underline"
                  >
                    {new URL(url).hostname}
                    {new URL(url).pathname === "/" ? "" : new URL(url).pathname}
                  </a>
                </li>
              ))}
          </ul>
        </Panel>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {allCourses
          .filter((c) => c.slug !== course.slug)
          .filter((c) => c.discipline === course.discipline)
          .slice(0, 6)
          .map((c) => (
            <BtnLink
              key={c.slug}
              to="/courses/$slug"
              params={{ slug: c.slug }}
              variant="ghost"
              size="sm"
            >
              {c.code}
            </BtnLink>
          ))}
      </div>
    </div>
  );
}

function FeeBar({
  label,
  range,
  max,
  bar,
  tone,
  note,
}: {
  label: string;
  range: [number, number] | null;
  max: number;
  bar: string;
  tone: "emerald" | "gold";
  note: string;
}) {
  if (!range)
    return (
      <div>
        <p className="text-[13.5px] font-semibold">{label}</p>
        <p className="mt-2 text-sm text-muted">Fees: N/A</p>
      </div>
    );
  const left = (range[0] / max) * 100;
  const width = Math.max(((range[1] - range[0]) / max) * 100, 6);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold">{label}</span>
        <Pill tone={tone}>{note}</Pill>
      </div>
      <div className="relative mt-2 h-2.5 w-full rounded-full bg-board">
        <div
          className={`absolute h-full rounded-full ${bar}`}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
      <p className="mt-2 text-[13px] text-muted">
        <Num className="font-semibold text-ink">{inr(range[0])}</Num> –{" "}
        <Num className="font-semibold text-ink">{inr(range[1])}</Num> / year
      </p>
    </div>
  );
}
