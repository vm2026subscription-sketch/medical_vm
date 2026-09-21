import { TextInput } from "./kit";
import { useId } from "react";
import { CATALOG_CATEGORIES } from "@/lib/catalog";
import {
  fieldLabel,
  unavailableNumberFields,
  selectStyle,
  type EntryDefinition,
  type EntryField,
  type EntryValues,
} from "@/lib/admin-entry";

const core: Record<string, string[]> = {
  "hostel-fees": ["collegeCode", "year", "amount"],
  bonds: ["collegeCode", "courseSlug", "years", "penaltyAmount", "applicableStates"],
  colleges: ["collegeCode", "name", "city", "state", "ownership"],
  courses: ["name", "slug", "fullName", "duration"],
  "college-courses": ["collegeCode", "courseSlug", "totalSeats"],
  fees: ["collegeCode", "courseSlug", "year", "tier", "tuition", "otherCharges", "hostelMess"],
  "seat-matrix": [
    "collegeCode",
    "courseSlug",
    "year",
    "authority",
    "category",
    "quota",
    "round",
    "seats",
  ],
  cutoffs: [
    "collegeCode",
    "courseSlug",
    "year",
    "authority",
    "category",
    "quota",
    "round",
    "closingRank",
    "closingScore",
  ],
};
const choices: Record<string, [string, string][]> = {
  discipline: [
    "Medicine",
    "Dental",
    "AYUSH",
    "Nursing",
    "Pharmacy",
    "Rehabilitation",
    "Allied health",
    "Health sciences",
    "Veterinary",
  ].map((value) => [value, value]),
  level: [
    ["Degree", "Degree"],
    ["Diploma", "Diploma"],
  ],
  admissionRoute: [
    ["neet-ug", "NEET-UG"],
    ["institution-specific", "State / university specific"],
  ],
  ownership: [
    ["govt", "Government"],
    ["private", "Private"],
    ["deemed", "Deemed"],
  ],
  tier: [
    ["merit", "Merit"],
    ["management", "Management"],
    ["nri", "NRI"],
  ],
  quota: ["AIQ", "State", "Management", "NRI", "Deemed"].map((v) => [v, v]),
  round: [
    ["Round1", "Round 1"],
    ["Round2", "Round 2"],
    ["Round3", "Round 3"],
    ["MopUp", "Mop-up"],
    ["Stray", "Stray"],
  ],
  isActive: [
    ["true", "Yes"],
    ["false", "No"],
  ],
  nmcApproved: [
    ["true", "Yes"],
    ["false", "No"],
  ],
};

export function EntryFields({
  definition,
  values,
  onChange,
  courses = [],
  categories = CATALOG_CATEGORIES,
}: {
  definition: EntryDefinition;
  values: EntryValues;
  onChange: (values: EntryValues) => void;
  courses?: { slug: string; name: string }[];
  categories?: string[];
}) {
  const categoryListId = useId();
  const primary = definition.fields.filter(
    (f) => core[definition.entity]?.includes(f.key) || f.required,
  );
  const optional = definition.fields.filter((f) => !primary.includes(f));
  const render = (f: EntryField) => {
    const options =
      f.key === "courseSlug" && courses.length
        ? courses.map((c): [string, string] => [c.slug, c.name])
        : choices[f.key];
    const value = values[f.key] || "";
    return (
      <label key={f.key} className="grid gap-1 text-sm">
        <span>
          {fieldLabel(f.key)}
          {f.required ? " *" : ""}
        </span>
        {options ? (
          <select
            className={selectStyle}
            value={value}
            onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
          >
            <option value="">Choose {fieldLabel(f.key).toLowerCase()}</option>
            {value && !options.some(([v]) => v === value) && <option value={value}>{value}</option>}
            {options.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <TextInput
            type={
              f.type === "number" && f.key !== "totalSeats" && !unavailableNumberFields.has(f.key)
                ? "number"
                : "text"
            }
            min={f.type === "number" ? 0 : undefined}
            maxLength={f.key === "category" ? 80 : undefined}
            {...(f.key === "category" ? { list: categoryListId } : {})}
            value={value}
            onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
            placeholder={
              f.key === "totalSeats"
                ? "150 or N/A"
                : f.example || `Enter ${fieldLabel(f.key).toLowerCase()}`
            }
            {...(f.key === "collegeCode" && definition.entity !== "colleges"
              ? { list: "entry-college-codes" }
              : {})}
          />
        )}
        {f.key === "category" && (
          <>
            <datalist id={categoryListId}>
              {[...new Set([...categories, ...(value ? [value] : [])])].map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
            <span className="text-xs text-muted">
              Choose or type the exact source code, e.g. DEF1, DEF2 W or EWS(W). Other codes are
              accepted too.
            </span>
          </>
        )}
        {unavailableNumberFields.has(f.key) && (
          <span className="text-xs text-muted">
            Enter a number or N/A. Blank means N/A for a new entry; on updates it keeps the saved
            amount.
          </span>
        )}
        {f.key === "totalSeats" && (
          <span className="text-xs text-muted">
            Enter a positive whole number, or N/A if intake information is unavailable.
          </span>
        )}
        {f.key === "hostelMess" && (
          <span className="text-xs text-muted">
            Shared by all courses in this college for the selected year. Leave blank to keep
            existing hostel fees. N/A marks the amount unavailable; 0 means confirmed zero charges.
          </span>
        )}
        {definition.entity === "fees" && f.key === "otherCharges" && (
          <span className="text-xs text-muted">
            Exclude hostel and mess; enter those in the next field.
          </span>
        )}
        {f.key === "collegeCode" && (
          <span className="text-xs text-muted">
            {definition.entity === "colleges"
              ? "Use the college's permanent code, e.g. COL-MH-001."
              : "Use the same code as the college record. Find it below if needed."}
          </span>
        )}
        {["facilities", "eligibility", "careerPath", "images"].includes(f.key) && (
          <span className="text-xs text-muted">Separate multiple items with |.</span>
        )}
      </label>
    );
  };
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">{primary.map(render)}</div>
      {optional.length > 0 && (
        <details className="rounded-xl border border-line p-4">
          <summary className="cursor-pointer text-sm font-medium">More details (optional)</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">{optional.map(render)}</div>
        </details>
      )}
    </div>
  );
}
