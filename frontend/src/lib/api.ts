// Real backend-backed data layer. Each function fetches from the MedPath API and maps
// the response into the shared view types defined in catalog.ts, so components don't need
// to change — only these functions and the route files that call them.

import { apiRequest } from "./api-client";
import type { College, Course, Counsellor, CutoffRow, MatchResult, Band } from "./catalog";

import type {
  CollegeDocument,
  CutoffDocument,
  CourseDocument,
  FeeRanges,
  CounsellorDocument,
  PredictionDocument,
  NotificationDocument,
  DashboardDocument,
} from "./api-types";

// ---------- mapping helpers ----------

const OWNERSHIP_MAP: Record<string, College["ownership"]> = {
  govt: "Government",
  private: "Private",
  deemed: "Deemed",
};

function mapCollege(raw: CollegeDocument): College {
  return {
    id: raw._id ?? raw.id,
    name: raw.name,
    city: raw.city,
    state: raw.state,
    ownership: OWNERSHIP_MAP[raw.ownership] ?? "Private",
    courses: raw.courses ?? [],
    seats: raw.seats ?? null,
    affiliation: raw.affiliation ?? "",
    feeMerit: raw.feeMerit ?? 0,
    feeMeritPublished: raw.feeMerit != null,
    feePrivatePublished: raw.feePrivate != null,
    feeFrom:
      raw.feeFrom ??
      ((raw.feeMerit ?? 0) > 0
        ? (raw.feeMerit ?? null)
        : (raw.feePrivate ?? 0) > 0
          ? (raw.feePrivate ?? null)
          : null),
    feePrivate: raw.feePrivate ?? 0,
    hostelMess: raw.hostelMess ?? 0,
    hostelFeePublished: raw.hostelFeePublished ?? raw.hostelMess != null,
    bondPublished: raw.bondPublished ?? (raw.bondYears != null || raw.bondPenalty != null),
    cutoffUpdatedAt: raw.cutoffUpdatedAt ?? null,
    closingRankYear: raw.closingRankYear ?? null,
    closingRankRound: raw.closingRankRound ?? null,
    closingRankCategory: raw.closingRankCategory ?? null,
    closingRankCourse: raw.closingRankCourse ?? null,
    bondYears: raw.bondYears ?? null,
    bondPenalty: raw.bondPenalty ?? null,
    closingRank: raw.closingRank ?? 0,
    quota: raw.quota ?? "State",
    hostel: (raw.hostelMess ?? 0) > 0,
    facilities: raw.facilities ?? [],
    images: raw.images ?? [],
  };
}

function mapCutoffRow(raw: CutoffDocument): CutoffRow {
  return {
    id: raw.id || raw._id || "",
    college: raw.collegeName ?? "Unknown college",
    course: raw.courseName ?? "",
    round: raw.round || "",
    authority: raw.authority || "",
    category: raw.category,
    quota: raw.quota,
    year: raw.year,
    closingRank: raw.closingRank ?? 0,
    seats: raw.seats ?? 0,
    // Backend returns trend: null when there's no prior-year record to compare against.
    // Default to "easier"/0 in that case — a neutral placeholder rather than fabricating a value.
    trend: raw.trend ?? "easier",
    delta: raw.delta ?? 0,
  };
}

function mapCourse(courseDoc: CourseDocument, feeRangeByOwnership?: FeeRanges): Course {
  const gov = feeRangeByOwnership?.government;
  const priv = feeRangeByOwnership?.privateOrDeemed;
  return {
    slug: courseDoc.slug,
    code: courseDoc.name,
    name: courseDoc.fullName ?? courseDoc.name,
    duration: courseDoc.duration ?? "",
    about: courseDoc.description ?? "",
    eligibility: courseDoc.eligibility ?? [],
    govFee: gov ? [gov.min, gov.max] : null,
    privateFee: priv ? [priv.min, priv.max] : null,
    career: courseDoc.careerPath ?? [],
    discipline: courseDoc.discipline ?? "Other courses",
    level: courseDoc.level ?? "",
    admissionRoute: courseDoc.admissionRoute ?? "institution-specific",
    admissionNotes:
      courseDoc.admissionNotes ?? "Check the current university or counselling prospectus.",
    aliases: courseDoc.aliases ?? [],
    sourceUrls: courseDoc.sourceUrls ?? [],
    reviewedOn: courseDoc.reviewedOn ?? "",
  };
}

function mapCounsellor(raw: CounsellorDocument): Counsellor {
  const name = raw.userId?.name ?? "Counsellor";
  const initials = name
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return {
    id: raw._id,
    name,
    initials,
    specialty: (raw.specialization ?? []).join(", "),
    rating: raw.rating ?? 0,
    calls: raw.totalSessions ?? 0,
  };
}

// ---------- Colleges ----------

export async function fetchColleges(
  params: Record<string, string> = {},
): Promise<{ items: College[]; total: number; page: number; totalPages: number }> {
  const qs = new URLSearchParams(params).toString();
  const res = await apiRequest<{
    data: CollegeDocument[];
    pagination: { total: number; page?: number; totalPages?: number; limit?: number };
  }>(`/colleges${qs ? `?${qs}` : ""}`, {
    auth: false,
  });
  return {
    items: res.data.map(mapCollege),
    total: res.pagination.total,
    page: res.pagination.page || Number(params["page"] || 1),
    totalPages:
      res.pagination.totalPages ||
      Math.max(
        1,
        Math.ceil(res.pagination.total / (res.pagination.limit || Number(params["limit"] || 24))),
      ),
  };
}

export interface CollegeDetail {
  college: College;
  cutoffs: { locked: boolean; rows: CutoffRow[]; lockedCount: number };
}

export async function fetchCollege(id: string): Promise<CollegeDetail> {
  const res = await apiRequest<{
    data: {
      college: CollegeDocument;
      cutoffs: { locked: boolean; rows: CutoffDocument[]; lockedCount: number };
    };
  }>(`/colleges/${id}`, { auth: true });
  return {
    college: mapCollege(res.data.college),
    cutoffs: {
      locked: res.data.cutoffs.locked,
      lockedCount: res.data.cutoffs.lockedCount,
      rows: res.data.cutoffs.rows.map((r) => ({
        id: r._id || r.id || "",
        college: res.data.college.name,
        course: r.courseName || "",
        round: r.round || "",
        authority: r.authority || "",
        category: r.category,
        quota: r.quota,
        year: r.year,
        closingRank: r.closingRank || 0,
        seats: r.seats ?? 0,
        trend: "easier",
        delta: 0,
      })),
    },
  };
}

export async function toggleSaveCollege(id: string, save: boolean, tag?: Band) {
  if (save) {
    return apiRequest(`/colleges/${id}/save`, { method: "POST", body: { tag } });
  }
  return apiRequest(`/colleges/${id}/save`, { method: "DELETE" });
}

// ---------- Courses ----------

export async function fetchCourses(): Promise<Course[]> {
  const res = await apiRequest<{ data: CourseDocument[] }>("/courses", { auth: false });
  return res.data.map((c) => mapCourse(c));
}

export async function fetchCourse(slug: string): Promise<Course> {
  const res = await apiRequest<{
    data: { course: CourseDocument; feeRangeByOwnership: FeeRanges };
  }>(`/courses/${slug}`, { auth: false });
  return mapCourse(res.data.course, res.data.feeRangeByOwnership);
}

// ---------- Cutoffs (the paywall) ----------

export interface CutoffsResult {
  page: number;
  limit: number;
  rows: CutoffRow[];
  maskedPreview: CutoffRow[];
  totalCount: number;
  lockedCount: number;
  isPremium: boolean;
}

export async function fetchCutoffs(params: Record<string, string> = {}): Promise<CutoffsResult> {
  const qs = new URLSearchParams(params).toString();
  const res = await apiRequest<{
    data: CutoffDocument[];
    maskedPreview?: CutoffDocument[];
    page?: number;
    limit?: number;
    totalCount: number;
    lockedCount: number;
    isPremium: boolean;
  }>(`/cutoffs${qs ? `?${qs}` : ""}`, { auth: true });

  return {
    rows: res.data.map(mapCutoffRow),
    maskedPreview: (res.maskedPreview ?? []).map((r) => ({
      id: r.id || r._id || "",
      college: r.collegeName ?? "Locked",
      course: r.courseName ?? "",
      category: r.category,
      quota: r.quota,
      year: r.year,
      closingRank: 0,
      seats: 0,
      trend: "easier",
      delta: 0,
    })),
    totalCount: res.totalCount,
    lockedCount: res.lockedCount,
    isPremium: res.isPremium,
    page: res.page || 1,
    limit: res.limit || 20,
  };
}

// ---------- Predictor / AI match ----------

export async function runPredictor(input: {
  rank: number;
  category: string;
  state: string;
  budget?: number;
  courses: string[];
}): Promise<MatchResult[]> {
  const res = await apiRequest<{
    data: { best: PredictionDocument[] };
  }>("/predict", { method: "POST", body: input });

  return res.data.best.map((r) => ({
    id: r.collegeCourseId,
    band: r.bucket as Band,
    probability: r.probability,
    college: r.collegeName,
    course: r.courseName,
    reason: r.reason,
  }));
}

// ---------- Counselling ----------

export async function fetchCounsellors(): Promise<Counsellor[]> {
  const res = await apiRequest<{ data: CounsellorDocument[] }>("/counselling/counsellors", {
    auth: false,
  });
  return res.data.map(mapCounsellor);
}

export async function fetchServices(): Promise<
  { id: string; name: string; price: number; durationMins: number }[]
> {
  const res = await apiRequest<{
    data: { _id: string; name: string; price: number; durationMins: number }[];
  }>("/counselling/services", { auth: false });
  return res.data.map((s) => ({
    id: s._id,
    name: s.name,
    price: s.price,
    durationMins: s.durationMins,
  }));
}

export async function fetchSlots(
  counsellorId: string,
  date: string,
): Promise<{ id: string; time: string; available: boolean }[]> {
  const res = await apiRequest<{ data: { _id: string; datetime: string; status: string }[] }>(
    `/counselling/counsellors/${counsellorId}/slots?date=${date}`,
    {
      auth: false,
    },
  );
  return res.data.map((s) => ({
    id: s._id,
    time: new Date(s.datetime).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    available: s.status === "open",
  }));
}

export async function holdSlot(slotId: string): Promise<{ holdToken: string; heldUntil: string }> {
  const res = await apiRequest<{ data: { holdToken: string; heldUntil: string } }>(
    `/counselling/slots/${slotId}/hold`,
    {
      method: "POST",
    },
  );
  return res.data;
}

export async function createBooking(input: {
  slotId: string;
  holdToken: string;
  serviceId: string;
  couponCode?: string;
}) {
  const res = await apiRequest<{
    data: {
      bookingId: string;
      paymentId: string;
      razorpayOrderId: string;
      razorpayKeyId: string;
      amount: number;
      currency: string;
    };
  }>("/counselling/bookings", { method: "POST", body: input });
  return res.data;
}

// ---------- Dashboard ----------

export async function fetchDashboardOverview() {
  const res = await apiRequest<{ data: DashboardDocument }>("/dashboard/overview", { auth: true });
  return {
    ...res.data,
    savedColleges: res.data.savedColleges.map((saved) => ({
      ...saved,
      collegeId: { ...mapCollege(saved.collegeId), _id: saved.collegeId._id },
    })),
  };
}

// ---------- Notifications ----------

export async function fetchNotifications(page = 1) {
  const res = await apiRequest<{
    data: NotificationDocument[];
    pagination?: { totalPages: number };
  }>(`/notifications?page=${page}&limit=20`, { auth: true });
  return {
    totalPages: res.pagination?.totalPages || 1,
    items: res.data.map((n) => ({
      id: n._id,
      title: n.title,
      body: n.body || "",
      attachments: n.attachments || [],
      time: new Date(n.createdAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      unread: !n.isRead,
      premium: n.type === "premium_alert",
      kind:
        n.type === "deadline"
          ? "deadline"
          : n.type === "booking"
            ? "booking"
            : n.type === "premium_alert"
              ? "alert"
              : "data",
    })),
  };
}

export async function markNotificationRead(id: string) {
  return apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead() {
  return apiRequest("/notifications/read-all", { method: "PATCH" });
}

// ---------- Billing ----------

export async function fetchPlans() {
  const res = await apiRequest<{
    data: { _id: string; name: string; price: number; features: string[]; durationDays: number }[];
  }>("/billing/plans", { auth: false });
  return res.data.map((p) => ({
    id: p._id,
    name: p.name,
    price: p.price,
    features: p.features ?? [],
    durationDays: p.durationDays,
  }));
}

export async function createCheckout(planId: string, couponCode?: string) {
  const res = await apiRequest<{
    data: {
      paymentId: string;
      razorpayOrderId: string;
      razorpayKeyId: string;
      amount: number;
      currency: string;
    };
  }>("/billing/checkout", { method: "POST", body: { planId, couponCode } });
  return res.data;
}

// ---------- Profile ----------

export async function updateProfile(input: {
  name?: string;
  neetRank?: number;
  neetScore?: number;
  category?: string;
  homeState?: string;
  marks?: number;
}) {
  return apiRequest("/profile/me", { method: "PUT", body: input });
}
