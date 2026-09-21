import type { College, Course, Band } from "./catalog";

export interface CollegeDocument extends Omit<
  Partial<College>,
  | "ownership"
  | "feeMerit"
  | "feePrivate"
  | "hostelMess"
  | "bondYears"
  | "bondPenalty"
  | "closingRank"
> {
  _id: string;
  name: string;
  city: string;
  state: string;
  ownership: string;
  feeMerit?: number | null;
  feePrivate?: number | null;
  hostelMess?: number | null;
  bondYears?: number | null;
  bondPenalty?: number | null;
  closingRank?: number | null;
}
export interface CutoffDocument {
  id?: string;
  _id?: string;
  collegeName?: string;
  courseName?: string;
  category: string;
  quota: string;
  year: number;
  round?: string;
  authority?: string;
  closingRank?: number | null;
  seats?: number | null;
  trend?: "tighter" | "easier" | null;
  delta?: number | null;
}
export interface CourseDocument extends Partial<Course> {
  slug: string;
  name: string;
  fullName?: string;
  description?: string;
  careerPath?: string[];
}
export interface FeeRanges {
  government?: { min: number; max: number } | null;
  privateOrDeemed?: { min: number; max: number } | null;
}
export interface CounsellorDocument {
  _id: string;
  userId?: { name?: string };
  specialization?: string[];
  rating?: number;
  totalSessions?: number;
}
export interface PredictionDocument {
  collegeCourseId: string;
  bucket: Band;
  probability: number;
  collegeName: string;
  courseName: string;
  reason: string;
}
export interface NotificationDocument {
  _id: string;
  title: string;
  body?: string;
  createdAt: string;
  isRead: boolean;
  type: string;
}
export interface DashboardDocument {
  nextDeadline: { title: string; date: string; sourceUrl?: string } | null;
  isPremium: boolean;
  savedColleges: { collegeId: CollegeDocument; tag?: string }[];
  downloads: { _id: string; title: string; type: string }[];
  recentActivity: {
    type: string;
    at: string;
    data: { counsellorId?: { userId?: { name?: string } }; result?: unknown[] };
  }[];
}
