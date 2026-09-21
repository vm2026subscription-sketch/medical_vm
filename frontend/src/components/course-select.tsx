import type { Course } from "@/lib/catalog";

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
  const groups = [...new Set(courses.map((course) => course.discipline || "Other courses"))].sort();
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
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {courses
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
