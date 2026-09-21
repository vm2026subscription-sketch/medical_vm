import { apiRequest } from "./api-client";
import { unavailableNumberFields } from "./admin-entry";

const examples: Record<string, Record<string, string>> = {
  bookings: { meetingLink: "https://meet.google.com/your-real-meeting" },
  plans: {
    name: "e.g. Cutoff access",
    slug: "e.g. cutoff-access",
    price: "99",
    durationDays: "120",
    features: "Detailed college cutoffs\nCategory and round filters",
  },
  coupons: { code: "e.g. NEET10", value: "10", usageLimit: "100" },
  services: {
    name: "e.g. College choice consultation",
    durationMins: "30",
    price: "499",
    description: "e.g. A 30-minute call to review your shortlist and counselling options.",
  },
  counsellors: {
    userId: "Copy the actual registered user ID from Users",
    specialization: "MBBS counselling\nState quota admissions",
    languages: "Hindi\nEnglish",
    pricePerSession: "499",
    commissionRate: "0.20",
  },
  slots: { counsellorId: "Copy the actual ID from Counsellors" },
};
export const exampleFor = (resource: string, key: string) => examples[resource]?.[key] || "";

export const attentionFilters = {
  photos: {
    label: "Colleges without photos",
    resource: "colleges",
    permission: "colleges:write",
    description:
      "Published colleges with no saved photos. Edit a draft to add images, then submit and publish.",
  },
  fees: {
    label: "Course links without fees",
    resource: "college-courses",
    permission: "collegecourses:import",
    description:
      "College-course links with no published fee record in any year. Each course is counted separately. Add fees using the linked college and course.",
  },
  cutoffs: {
    label: "Course links without cutoffs",
    resource: "college-courses",
    permission: "collegecourses:import",
    description:
      "College-course links with no published cutoff in any year or round. Each course is counted separately. Add only officially available cutoff data.",
  },
};
export type AttentionFilter = keyof typeof attentionFilters;
export interface MissingDataEntry {
  entity: "fees" | "cutoffs";
  input: { collegeCode: string; courseSlug: string };
}

export interface AdminSession {
  role: string;
  permissions: string[];
}
export interface AdminRecord {
  _id: string;
  name?: string;
  images?: string[];
  collegeCourseId?: { collegeId?: { name?: string } };
  [key: string]: unknown;
}
export interface PageResult {
  data: AdminRecord[];
  pagination?: { total: number; page: number; totalPages: number };
}
export interface Field {
  key: string;
  label: string;
  type?: "number" | "checkbox" | "list" | "textarea" | "date" | "select";
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}
export interface Resource {
  key: string;
  label: string;
  path: string;
  permission: string;
  writePermission?: string;
  createPath?: string;
  updateMethod?: "PATCH" | "PUT";
  fields?: Field[];
  columns: { key: string; label: string }[];
  search?: boolean;
  statuses?: string[];
}
const field = (key: string, label: string, type?: Field["type"], options?: string[]): Field => ({
  key,
  label,
  ...(type ? { type } : {}),
  ...(options ? { options } : {}),
});
const col = (key: string, label: string) => ({ key, label });
const college = col("collegeCourseId.collegeId.name", "College");
const course = col("collegeCourseId.courseId.name", "Course");
const year = { ...field("year", "Year", "number"), min: 2000, max: 2100, required: true };
const rank = { ...field("closingRank", "Closing rank", "number"), min: 1, required: true };
const seats = { ...field("seats", "Seats", "number"), min: 0 };
const category = field("category", "Category (exact source code)");
const quota = field("quota", "Quota", "select", ["AIQ", "State", "Management", "NRI", "Deemed"]);
const round = field("round", "Round", "select", ["Round1", "Round2", "Round3", "MopUp", "Stray"]);

export const resources: Resource[] = [
  {
    key: "hostel-fees",
    label: "Hostel & mess fees",
    path: "/admin/catalog/hostel-fees",
    permission: "fees:import",
    search: true,
    columns: [
      col("collegeId.name", "College"),
      col("year", "Year"),
      col("amount", "Annual hostel + mess (INR)"),
    ],
  },
  {
    key: "bonds",
    label: "Service bonds",
    path: "/admin/catalog/bonds",
    permission: "fees:import",
    search: true,
    columns: [
      college,
      course,
      col("years", "Bond years"),
      col("penaltyAmount", "Penalty (INR)"),
      col("applicableStates", "Applicable states"),
    ],
  },
  {
    key: "services",
    label: "Counselling services",
    path: "/admin/catalog/services",
    createPath: "/admin/catalog/services",
    permission: "counsellors:manage",
    search: true,
    columns: [
      col("name", "Service"),
      col("durationMins", "Minutes"),
      col("price", "Price (INR)"),
      col("isActive", "Active"),
    ],
    fields: [
      { ...field("name", "Service name"), required: true },
      {
        ...field("durationMins", "Duration in minutes", "number"),
        min: 5,
        max: 240,
        required: true,
      },
      { ...field("price", "Price (INR)", "number"), min: 1, required: true },
      field("description", "Description", "textarea"),
      field("isActive", "Available for booking", "checkbox"),
    ],
  },
  {
    key: "plans",
    label: "Subscription plans",
    path: "/admin/catalog/plans",
    createPath: "/admin/catalog/plans",
    permission: "coupons:write",
    search: true,
    columns: [
      col("name", "Plan"),
      col("slug", "Slug"),
      col("price", "Price (INR)"),
      col("durationDays", "Days"),
      col("isActive", "Active"),
    ],
    fields: [
      { ...field("name", "Plan name"), required: true },
      { ...field("slug", "Slug"), required: true },
      { ...field("price", "Price (INR)", "number"), min: 1, required: true },
      { ...field("durationDays", "Duration in days", "number"), min: 1, required: true },
      field("features", "Features (one per line)", "list"),
      field("isActive", "Available for purchase", "checkbox"),
    ],
  },
  {
    key: "slots",
    label: "Availability slots",
    path: "/admin/catalog/slots",
    createPath: "/admin/catalog/slots",
    permission: "counsellors:manage",
    columns: [
      col("counsellorId.userId.name", "Counsellor"),
      col("datetime", "Appointment"),
      col("status", "Status"),
    ],
    fields: [
      { ...field("counsellorId", "Counsellor ID (copy from Counsellors)"), required: true },
      { ...field("datetime", "Appointment time (your local timezone)", "date"), required: true },
    ],
  },
  {
    key: "colleges",
    label: "Colleges & photos",
    path: "/admin/catalog/colleges",
    createPath: "/admin/colleges",
    permission: "colleges:write",
    search: true,
    columns: [
      col("name", "College"),
      col("city", "City"),
      col("state", "State"),
      col("ownership", "Ownership"),
      col("images", "Photos"),
      col("isActive", "Published"),
    ],
    fields: [
      { ...field("name", "College name"), required: true },
      { ...field("city", "City"), required: true },
      { ...field("state", "State"), required: true },
      field("ownership", "Ownership", "select", ["govt", "private", "deemed"]),
      field("affiliation", "Affiliation"),
      field("facilities", "Facilities (one per line)", "list"),
      field("nmcApproved", "Approved", "checkbox"),
      field("isActive", "Published on website", "checkbox"),
    ],
  },
  {
    key: "courses",
    label: "Courses",
    path: "/admin/catalog/courses",
    createPath: "/admin/catalog/courses",
    permission: "collegecourses:import",
    search: true,
    columns: [
      col("name", "Course"),
      col("slug", "Import slug"),
      col("fullName", "Full name"),
      col("duration", "Duration"),
    ],
    fields: [
      { ...field("name", "Name (e.g. MBBS)"), required: true },
      { ...field("slug", "Slug (e.g. mbbs)"), required: true },
      field("fullName", "Full name"),
      field("duration", "Duration"),
      field("description", "Description", "textarea"),
      field("eligibility", "Eligibility (one per line)", "list"),
      field("careerPath", "Career paths (one per line)", "list"),
    ],
  },
  {
    key: "college-courses",
    label: "Course links",
    path: "/admin/catalog/college-courses",
    permission: "collegecourses:import",
    search: true,
    columns: [
      col("collegeId.name", "College"),
      col("collegeId.collegeCode", "College code"),
      col("collegeId.city", "City"),
      col("courseId.name", "Course"),
      col("courseId.slug", "Course code"),
      col("totalSeats", "Total seats"),
    ],
    fields: [{ ...field("totalSeats", "Total seats (number or N/A)"), required: true }],
  },
  {
    key: "cutoffs",
    label: "Cutoffs",
    path: "/admin/catalog/cutoffs",
    permission: "cutoffs:import",
    search: true,
    columns: [
      college,
      course,
      col("year", "Year"),
      col("category", "Category"),
      col("quota", "Quota"),
      col("round", "Round"),
      col("closingRank", "Closing rank"),
    ],
    fields: [
      year,
      category,
      quota,
      field("authority", "Authority"),
      round,
      rank,
      { ...field("closingScore", "Closing score", "number"), min: 0, max: 720 },
      seats,
    ],
  },
  {
    key: "fees",
    label: "Fees",
    path: "/admin/catalog/fees",
    permission: "fees:import",
    search: true,
    columns: [
      college,
      course,
      col("year", "Year"),
      col("tier", "Tier"),
      col("tuition", "Tuition (INR)"),
      col("otherCharges", "Other charges (INR)"),
      col("hostelMess", "Hostel + mess (INR)"),
      col("sourceTag", "Source"),
    ],
    fields: [
      year,
      field("tier", "Tier", "select", ["merit", "management", "nri"]),
      field("tuition", "Annual tuition (INR or N/A)"),
      field("otherCharges", "Other charges (INR or N/A)"),
      field("hostelMess", "Annual hostel + mess (INR or N/A)"),
      field("sourceTag", "Source / reference"),
    ],
  },
  {
    key: "seat-matrix",
    label: "Seat matrix",
    path: "/admin/catalog/seat-matrix",
    permission: "seatmatrix:import",
    search: true,
    columns: [
      college,
      course,
      col("year", "Year"),
      col("category", "Category"),
      col("quota", "Quota"),
      col("round", "Round"),
      col("seats", "Seats"),
    ],
    fields: [
      year,
      category,
      quota,
      field("authority", "Authority"),
      round,
      { ...seats, required: true },
    ],
  },
  {
    key: "users",
    label: "Users",
    path: "/admin/users",
    permission: "users:read",
    writePermission: "users:manage",
    search: true,
    columns: [
      col("name", "Name"),
      col("email", "Email"),
      col("phone", "Phone"),
      col("role", "Role"),
      col("isActive", "Active"),
      col("createdAt", "Joined"),
    ],
    fields: [field("isActive", "Account active", "checkbox")],
  },
  {
    key: "payments",
    label: "Payments",
    path: "/admin/payments",
    permission: "payments:read",
    statuses: ["created", "paid", "failed", "refunded"],
    columns: [
      col("gatewayOrderId", "Order"),
      col("_id", "Payment reference"),
      col("userId.name", "Student"),
      col("userId.email", "Email"),
      col("amount", "Amount (INR)"),
      col("purpose", "Purpose"),
      col("fulfillmentStatus", "Activation"),
      col("fulfillmentMessage", "Review details"),
      col("status", "Status"),
      col("createdAt", "Created"),
    ],
  },
  {
    key: "bookings",
    label: "Bookings",
    path: "/admin/bookings",
    permission: "bookings:read",
    writePermission: "counsellors:manage",
    fields: [
      field("meetingLink", "Real meeting URL (HTTPS)"),
      field("status", "Session status", "select", ["confirmed", "completed", "no_show"]),
    ],
    statuses: ["pending_payment", "confirmed", "completed", "cancelled", "no_show"],
    columns: [
      col("userId.name", "Student"),
      col("counsellorId.userId.name", "Counsellor"),
      col("serviceId.name", "Service"),
      col("slotId.datetime", "Appointment"),
      col("status", "Status"),
      col("meetingLink", "Meeting"),
    ],
  },
  {
    key: "coupons",
    label: "Coupons",
    path: "/admin/coupons",
    permission: "coupons:read",
    writePermission: "coupons:write",
    createPath: "/admin/coupons",
    columns: [
      col("code", "Code"),
      col("type", "Type"),
      col("value", "Discount"),
      col("timesUsed", "Uses"),
      col("validTo", "Expires"),
      col("isActive", "Active"),
    ],
    fields: [
      { ...field("code", "Code"), required: true },
      field("type", "Type", "select", ["flat", "percent"]),
      { ...field("value", "Discount value", "number"), min: 1, required: true },
      { ...field("usageLimit", "Usage limit (blank = unlimited)", "number"), min: 1 },
      { ...field("validFrom", "Valid from", "date"), required: true },
      { ...field("validTo", "Valid until", "date"), required: true },
      field("isActive", "Active", "checkbox"),
    ],
  },
  {
    key: "counsellors",
    label: "Counsellors",
    path: "/admin/counsellors",
    permission: "counsellors:read",
    writePermission: "counsellors:manage",
    createPath: "/admin/counsellors",
    columns: [
      col("userId.name", "Name"),
      col("userId.email", "Email"),
      col("languages", "Languages"),
      col("pricePerSession", "Session fee (INR)"),
      col("isActive", "Active"),
    ],
    fields: [
      { ...field("userId", "Registered user ID (from Users)"), required: true },
      field("specialization", "Specializations (one per line)", "list"),
      field("languages", "Languages (one per line)", "list"),
      { ...field("pricePerSession", "Session fee (INR)", "number"), min: 1, required: true },
      { ...field("commissionRate", "Commission (0 to 1)", "number"), min: 0, max: 1, step: "0.01" },
      field("isActive", "Active", "checkbox"),
    ],
  },
  {
    key: "audit-log",
    label: "Audit history",
    path: "/admin/audit-log",
    permission: "audit:read",
    columns: [
      col("createdAt", "When"),
      col("adminUserId.name", "Admin"),
      col("action", "Action"),
      col("entity", "Entity"),
      col("entityId", "Record"),
      col("after", "Changes / import totals"),
    ],
  },
];

export const allowed = (session: AdminSession, permission: string) =>
  session.role === "super_admin" || session.permissions.includes(permission);
export async function adminGet<T>(path: string): Promise<T> {
  return (await apiRequest<{ data: T }>(path)).data;
}
export function cellValue(record: AdminRecord, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : undefined,
      record,
    );
  if (value == null) return key === "totalSeats" || unavailableNumberFields.has(key) ? "N/A" : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "images" && Array.isArray(value)) return String(value.length);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  if (/At$|validFrom|validTo|datetime/.test(key))
    return new Date(String(value)).toLocaleString("en-IN");
  return String(value);
}
export function downloadCsv(filename: string, rows: string[][]) {
  const escape = (value: string) =>
    '"' + (/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"';
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
