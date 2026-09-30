import type { Course } from "@/lib/catalog";

const mainCourseOrder = ["MBBS", "BDS", "BAMS", "BHMS", "BPT", "BSCNURSING"];
const normalizedCourse = (course: Course) => `${course.code} ${course.name}`.toUpperCase().replace(/[^A-Z]/g, "");
const mainCourseIndex = (course: Course) => {
  const value = normalizedCourse(course);
  return mainCourseOrder.findIndex((courseCode) => value.includes(courseCode));
};

export function CourseSelect({
  courses,
  value,
  onChange,
  disabled = false,
}: {
  courses: Course[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const mainCourses = courses
    .filter((course) => mainCourseIndex(course) >= 0)
    .sort((a, b) => mainCourseIndex(a) - mainCourseIndex(b));
  const remainingCourses = courses.filter((course) => mainCourseIndex(course) < 0);
  const groups = [...new Set(remainingCourses.map((course) => course.discipline || "Other courses"))].sort();
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
      Course
      <select
        aria-label="Course"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none focus:border-teal-600"
      >
        <option value="">All courses</option>
        {value && !courses.some((course) => course.slug === value) && (
          <option value={value}>{value}</option>
        )}
        {mainCourses.length > 0 && (
          <optgroup label="Main courses">
            {mainCourses.map((course) => (
              <option key={course.slug} value={course.slug}>
                {course.code}
              </option>
            ))}
          </optgroup>
        )}
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {remainingCourses
              .filter((course) => (course.discipline || "Other courses") === group)
              .map((course) => (
                <option key={course.slug} value={course.slug}>
                  {course.code}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <span className="font-normal">{courses.length} published courses · grouped by field</span>
    </label>
  );
}
