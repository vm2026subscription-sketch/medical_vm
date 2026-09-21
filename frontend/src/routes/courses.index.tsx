import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, GraduationCap } from "lucide-react";
import { ApiUnreachable } from "@/components/api-unreachable";
import { BtnLink, Dropdown, Panel, Pill, SearchBar } from "@/components/kit";
import { fetchCourses } from "@/lib/api";

export const Route = createFileRoute("/courses/")({
  loader: async () => {
    try {
      return { courses: await fetchCourses(), apiDown: false };
    } catch {
      return { courses: [], apiDown: true };
    }
  },
  head: () => ({
    meta: [
      { title: "Medical & healthcare courses after 12th | MedPath by Vidyarthi Mitra" },
      {
        name: "description",
        content:
          "Explore medicine, nursing, pharmacy, rehabilitation and allied-health courses after Class 12. Compare eligibility, duration and admission routes.",
      },
      { property: "og:title", content: "Explore courses after 12th | MedPath by Vidyarthi Mitra" },
    ],
  }),
  component: Courses,
});
function Courses() {
  const { courses, apiDown } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("All fields");
  const [level, setLevel] = useState("All qualifications");
  const fields = [...new Set(courses.map((course) => course.discipline))].sort();
  const filtered = useMemo(
    () =>
      courses.filter(
        (course) =>
          (discipline === "All fields" || course.discipline === discipline) &&
          (level === "All qualifications" || course.level === level) &&
          `${course.code} ${course.name} ${course.discipline} ${course.aliases.join(" ")}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [courses, discipline, level, query],
  );
  if (apiDown) return <ApiUnreachable />;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <Pill tone="teal">
        <GraduationCap className="size-4" /> After Class 12
      </Pill>
      <h1 className="mt-3 text-[28px] md:text-[38px]">Find your path in healthcare</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Explore medicine, nursing, pharmacy, rehabilitation and allied health. Each course has its
        own admission route. Veterinary and life-science options are grouped separately.
      </p>
      <div className="mt-6 grid items-end gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <SearchBar
          aria-label="Search courses"
          placeholder="Search nursing, pharmacy, physiotherapy..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Dropdown
          label="Field"
          options={["All fields", ...fields]}
          value={discipline}
          onChange={(event) => setDiscipline(event.target.value)}
        />
        <Dropdown
          label="Qualification"
          options={["All qualifications", "Degree", "Diploma"]}
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        />
      </div>
      <p className="mt-4 text-sm text-muted" role="status">
        {filtered.length} courses
      </p>
      {!filtered.length && (
        <Panel className="mt-5 p-6">
          <h2>No courses found</h2>
          <p className="mt-2 text-sm text-muted">
            {courses.length
              ? "Try another search or clear your filters."
              : "The course catalogue has not been published yet."}
          </p>
        </Panel>
      )}
      {fields.map((field) => {
        const entries = filtered.filter((course) => course.discipline === field);
        if (!entries.length) return null;
        return (
          <section key={field} className="mt-8" aria-label={field}>
            <h2 className="text-xl">
              {field} <span className="text-sm font-normal text-muted">({entries.length})</span>
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {entries.map((course) => (
                <Panel key={course.slug} className="flex flex-col p-5">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="teal">{course.level || "Course"}</Pill>
                    <Pill>
                      {course.admissionRoute === "neet-ug" ? "NEET-UG" : "Check admission route"}
                    </Pill>
                  </div>
                  <h3 className="mt-3 text-lg">{course.code}</h3>
                  <p className="mt-1 text-sm text-muted">{course.name}</p>
                  <p className="mt-3 text-xs leading-relaxed text-muted">{course.duration}</p>
                  <BtnLink
                    to="/courses/$slug"
                    params={{ slug: course.slug }}
                    className="mt-5 self-start"
                    variant="ghost"
                    size="sm"
                  >
                    Course details <ArrowRight className="ml-2 size-4" />
                  </BtnLink>
                </Panel>
              ))}
            </div>
          </section>
        );
      })}
      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
        Course titles, duration and entry requirements can change with new curricula. Read the
        official sources on each course page and the current college prospectus. Course availability
        does not imply that college seats or fees have been published.
      </p>
    </div>
  );
}
