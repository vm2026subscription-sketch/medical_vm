// Shared API view types, filter options and number formatters. Records come from the backend.

export type Ownership = "Government" | "Private" | "Deemed";

export type Band = "safe" | "target" | "dream";

export interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  ownership: Ownership;
  courses: string[];
  seats: number | null;
  affiliation: string;
  feeMerit: number;
  feeMeritPublished?: boolean;
  feePrivatePublished?: boolean;
  feeFrom?: number | null;
  feePrivate: number;
  hostelMess: number;
  hostelFeePublished?: boolean;
  bondPublished?: boolean;
  cutoffUpdatedAt?: string | null;
  closingRankYear?: number | null;
  closingRankRound?: string | null;
  closingRankCategory?: string | null;
  closingRankCourse?: string | null;
  bondYears: number | null;
  bondPenalty: number | null;
  closingRank: number;
  quota: string;
  hostel: boolean;
  facilities: string[];
  images?: string[];
}

export interface CutoffRow {
  round?: string;
  authority?: string;
  id: string;
  college: string;
  course: string;
  category: string;
  quota: string;
  year: number;
  closingRank: number;
  seats: number;
  trend: "tighter" | "easier";
  delta: number;
}

export interface Course {
  slug: string;
  code: string;
  name: string;
  duration: string;
  about: string;
  eligibility: string[];
  govFee: [number, number] | null;
  privateFee: [number, number] | null;
  career: string[];
  discipline: string;
  level: string;
  admissionRoute: string;
  admissionNotes: string;
  aliases: string[];
  sourceUrls: string[];
  reviewedOn: string;
}

export interface Counsellor {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  rating: number;
  calls: number;
}

export interface MatchResult {
  id: string;
  band: Band;
  probability: number;
  college: string;
  course: string;
  reason: string;
}

export const CATEGORIES = ["General", "EWS", "OBC", "SC", "ST", "PwD"];
// Suggestions from supported/source sheets. Imports also accept other exact codes.
export const CATALOG_CATEGORIES = [
  ...CATEGORIES,
  "Open",
  "OPEN",
  "OBC-NCL",
  "DEF1",
  "DEF1 W",
  "DEF2",
  "DEF2 W",
  "DEF3",
  "EMSEBC",
  "EMNTD",
  "EMOBC",
  "EMOBCW",
  "EMVJAW",
  "EWS(W)",
  "HEWS",
  "HOBC",
  "HOPEN",
  "HOPENW",
  "HSCW",
  "HST",
  "MKB W",
  "NTB",
  "NTB(W)",
  "NTC",
  "NTC(W)",
  "NTD",
  "OBC(W)",
  "OPEN (W)",
  "PEM SEBC",
  "SC (W)",
  "SEBC",
  "SEBC(W)",
  "ST (W)",
  "VJA",
  "VJA (W)",
];

// State counselling category codes used by the cutoff and college filters.
export const STATE_CATEGORIES: Record<string, string[]> = {
  "Andhra Pradesh": ["OC", "EWS", "BC-A", "BC-B", "BC-C", "BC-D", "BC-E", "SC", "ST"],
  "Arunachal Pradesh": ["APST", "UR/Open", "EWS"],
  Assam: ["UR/Open", "EWS", "SC", "ST(P)", "ST(H)", "OBC", "MOBC"],
  Bihar: ["UR", "EWS", "SC", "ST", "EBC", "BC"],
  Chhattisgarh: ["UR", "EWS", "SC", "ST", "OBC"],
  Goa: ["General/OPEN", "SC", "ST", "OBC", "EWS"],
  Gujarat: ["OPEN/General", "EWS", "SC", "ST", "SEBC"],
  Haryana: ["General", "EWS", "SC", "BC-A", "BC-B"],
  "Himachal Pradesh": ["General", "EWS", "SC", "ST", "OBC"],
  Jharkhand: ["UR", "EWS", "SC", "ST", "BC-I", "BC-II"],
  Karnataka: ["GM", "EWS", "SC", "ST", "1", "2A", "2B", "3A", "3B"],
  Kerala: ["SM", "EWS", "EZ", "MU", "BH", "LA", "DV", "VK", "KN", "BX", "KU", "SC", "ST"],
  "Madhya Pradesh": ["UR", "EWS", "SC", "ST", "OBC"],
  Maharashtra: ["OPEN", "EWS", "SC", "ST", "VJ/DT-A", "NT-B", "NT-C", "NT-D", "OBC", "SEBC"],
  Manipur: ["UR", "EWS", "SC", "ST", "OBC"],
  Meghalaya: ["Open/General", "ST", "SC", "EWS"],
  Mizoram: ["Open/General", "ST", "SC", "EWS"],
  Nagaland: ["Open/General", "ST", "EWS"],
  Odisha: ["UR/General", "EWS", "SC", "ST", "SEBC"],
  Punjab: ["General", "EWS", "SC", "BC"],
  Rajasthan: ["GEN", "EWS", "SC", "ST", "OBC", "MBC"],
  Sikkim: ["Open/General", "BL", "ST", "SC", "OBC/EBC", "EWS"],
  "Tamil Nadu": ["OC", "BC", "BCM", "MBC/DNC", "SC", "SCA", "ST"],
  Telangana: ["OC", "EWS", "BC-A", "BC-B", "BC-C", "BC-D", "BC-E", "SC", "ST"],
  Tripura: ["UR", "EWS", "SC", "ST", "OBC"],
  "Uttar Pradesh": ["General/UR", "EWS", "OBC", "SC", "ST"],
  Uttarakhand: ["General", "EWS", "SC", "ST", "OBC"],
  "West Bengal": ["UR", "EWS", "SC", "ST", "OBC-A", "OBC-B"],
};

export const QUOTAS = ["AIQ", "State", "Management", "Deemed", "NRI"];

export const YEARS = Array.from(
  { length: Math.max(1, new Date().getFullYear() - 2021) },
  (_, index) => new Date().getFullYear() - index,
);

export const COURSE_CODES = ["MBBS", "BDS", "BAMS", "BHMS", "BUMS", "BSMS"];

export const STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export const rank = (n: number) => n.toLocaleString("en-IN");
