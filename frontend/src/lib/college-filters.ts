import { QUOTAS } from "./catalog";

export type CollegeSearch = {
  course?: string | undefined;
  state?: string | undefined;
  search?: string | undefined;
  category?: string | undefined;
  quota?: string | undefined;
  ownership?: string | undefined;
  fee?: string | undefined;
  page?: number | undefined;
};

export const FEE_FILTERS = [
  { value: "", label: "Any fee" },
  { value: "under-1l", label: "Under ₹1 lakh", maxFee: "99999" },
  { value: "1l-5l", label: "₹1–5 lakh", minFee: "100000", maxFee: "500000" },
  { value: "5l-15l", label: "Above ₹5–15 lakh", minFee: "500001", maxFee: "1500000" },
  { value: "above-15l", label: "Above ₹15 lakh", minFee: "1500001" },
];

export function collegeSearch(input: Record<string, unknown>): CollegeSearch {
  const text = (key: string, max = 100) =>
    typeof input[key] === "string" ? input[key].trim().slice(0, max) || undefined : undefined;
  const member = (key: string, options: readonly string[]) => {
    const value = text(key);
    return value && options.includes(value) ? value : undefined;
  };
  const course = text("course");
  const page = Number(input["page"]);
  return {
    course: course && /^[a-z0-9-]+$/.test(course) ? course : undefined,
    state: text("state"),
    search: text("search", 150),
    category: text("category", 80),
    quota: member("quota", QUOTAS),
    ownership: member("ownership", ["govt", "private", "deemed"]),
    fee: member(
      "fee",
      FEE_FILTERS.map((entry) => entry.value),
    ),
    page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1,
  };
}

export function collegeQuery(search: CollegeSearch): Record<string, string> {
  const query: Record<string, string> = { limit: "24", page: String(search.page || 1) };
  for (const key of ["course", "state", "search", "category", "quota", "ownership"] as const) {
    if (search[key]) query[key] = search[key];
  }
  const fee = FEE_FILTERS.find((entry) => entry.value === search.fee);
  if (fee?.minFee) query["minFee"] = fee.minFee;
  if (fee?.maxFee) query["maxFee"] = fee.maxFee;
  return query;
}
