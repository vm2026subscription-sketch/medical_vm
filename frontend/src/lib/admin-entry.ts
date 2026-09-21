export type EntryValues = Record<string, string>;
export const unavailableNumberFields = new Set([
  "tuition",
  "otherCharges",
  "hostelMess",
  "amount",
  "years",
  "penaltyAmount",
]);
export interface EntryField {
  key: string;
  required: boolean;
  example: string;
  type: string;
}
export interface EntryDefinition {
  entity: string;
  fields: EntryField[];
  sample: EntryValues;
}

export const entryTypes = [
  {
    key: "colleges",
    label: "Colleges",
    description: "College details, location and photos",
    icon: "01",
  },
  {
    key: "courses",
    label: "Courses",
    description: "Course names and course information",
    icon: "02",
  },
  {
    key: "college-courses",
    label: "College courses",
    description: "Which course a college offers and its intake",
    icon: "03",
  },
  {
    key: "fees",
    label: "Fees",
    description: "Tuition, other charges, hostel and mess fees",
    icon: "04",
  },
  {
    key: "seat-matrix",
    label: "Seats",
    description: "Seats by category, quota and round",
    icon: "05",
  },
  {
    key: "cutoffs",
    label: "Cutoffs",
    description: "Closing ranks and scores for the cutoff tab",
    icon: "06",
  },
  {
    key: "hostel-fees",
    label: "Hostel & mess fees",
    description: "Annual hostel and mess charges for a college",
    icon: "07",
  },
  {
    key: "bonds",
    label: "Service bonds",
    description: "Course-wise service period and bond penalty",
    icon: "07",
  },
];
const labels: Record<string, string> = {
  amount: "Annual hostel + mess (INR)",
  years: "Service bond years (0 for no bond)",
  penaltyAmount: "Bond penalty (INR)",
  applicableStates: "Applicable states (separate with |)",
  discipline: "Healthcare field",
  level: "Qualification",
  admissionRoute: "Admission route",
  admissionNotes: "Admission details",
  aliases: "Other course names (separate with |)",
  sourceUrls: "Official source links (separate with |)",
  reviewedOn: "Last reviewed (YYYY-MM-DD)",
  collegeCode: "College code",
  collegeName: "College name",
  courseSlug: "Course",
  totalSeats: "Total intake",
  name: "Name",
  slug: "Course code",
  fullName: "Full course name",
  city: "City",
  state: "State",
  ownership: "College type",
  year: "Admission year",
  tier: "Fee type",
  tuition: "Annual tuition (INR)",
  otherCharges: "Other charges (INR)",
  hostelMess: "Annual hostel + mess (INR)",
  sourceTag: "Fee notice reference",
  closingRank: "Closing rank",
  closingScore: "Closing score",
  seats: "Number of seats",
  authority: "Counselling authority",
  round: "Counselling round",
  category: "Category",
  quota: "Quota",
  isActive: "Visible on website",
  nmcApproved: "NMC approved",
  images: "Photo links",
  careerPath: "Career options",
  location: "Map coordinates",
};
export const fieldLabel = (key: string) =>
  labels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
export const entryLabel = (key: string) =>
  entryTypes.find((t) => t.key === key)?.label || fieldLabel(key);
export const statusLabels: Record<string, string> = {
  draft: "Not checked",
  needs_correction: "Needs changes",
  ready: "Ready to send",
  submitted: "Waiting for approval",
  rejected: "Returned for changes",
  published: "Published",
};
export const selectStyle = "mt-1 w-full rounded-xl border border-line bg-card p-2.5 text-sm";
