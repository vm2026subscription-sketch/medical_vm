const { z } = require('zod');
const { categorySchema } = require('../../utils/categoryCodes');
const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const createCollege = {
  body: z.object({
    name: z.string().trim().min(1).max(250),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    ownership: z.enum(['govt', 'private', 'deemed']),
    affiliation: z.string().optional(),
    nmcApproved: z.boolean().optional(),
    images: z.array(z.string().url().regex(/^https:\/\//, 'Use an HTTPS image URL')).max(20).optional(),
    isActive: z.boolean().optional(),
    facilities: z.array(z.string()).optional(),
    location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  }),
};

const updateCollege = {
  params: z.object({ id: mongoId }),
  body: createCollege.body.partial(),
};

const patchUser = {
  params: z.object({ id: mongoId }),
  body: z.object({
    isActive: z.boolean().optional(),
  }),
};

const createCoupon = {
  body: z.object({
    code: z.string().min(3),
    type: z.enum(['flat', 'percent']),
    value: z.number().positive(),
    isActive: z.boolean().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    validFrom: z.coerce.date(),
    validTo: z.coerce.date(),
    referralUserId: mongoId.optional(),
  }),
};

const updateCoupon = {
  params: z.object({ id: mongoId }),
  body: createCoupon.body.partial(),
};

const createCounsellor = {
  body: z.object({
    userId: mongoId,
    specialization: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    pricePerSession: z.number().positive(),
    commissionRate: z.number().min(0).max(1).optional(),
    isActive: z.boolean().optional(),
  }),
};

const updateCounsellor = {
  params: z.object({ id: mongoId }),
  body: createCounsellor.body.partial().omit({ userId: true }),
};

const assignRole = {
  params: z.object({ id: mongoId }), // admin_user's userId
  body: z.object({
    roleName: z.enum(['super_admin', 'data_editor', 'counsellor', 'support', 'finance', 'read_only']),
  }),
};

const createRole = {
  body: z.object({
    name: z.enum(['super_admin', 'data_editor', 'counsellor', 'support', 'finance', 'read_only']),
    permissions: z.array(z.string()),
  }),
};

// ---- Single-entry data creation ----

const createCollegeCourseLink = {
  body: z.object({
    collegeName: z.string().trim().min(1),
    city: z.string().trim().min(1),
    courseSlug: z.string().trim().toLowerCase().min(1),
    totalSeats: z.number().int().positive().nullable(),
  }),
};

const createCutoffEntry = {
  body: z.object({
    collegeName: z.string().min(1),
    city: z.string().min(1),
    courseSlug: z.string().min(1),
    category: categorySchema,
    quota: z.enum(['AIQ', 'State', 'Management', 'NRI', 'Deemed']),
    authority: z.string().min(1),
    year: z.number().int().min(2000).max(2100),
    round: z.enum(['Round1', 'Round2', 'MopUp', 'Stray', 'Round3']),
    closingRank: z.number().int().positive(),
    closingScore: z.number().min(0).max(720).optional(),
    seats: z.number().int().nonnegative().optional(),
  }),
};

const createFeeEntry = {
  body: z.object({
    collegeName: z.string().min(1),
    city: z.string().min(1),
    courseSlug: z.string().min(1),
    year: z.number().int().min(2000).max(2100),
    tier: z.enum(['merit', 'management', 'nri']),
    tuition: z.number().nonnegative().nullable().optional(),
    otherCharges: z.number().nonnegative().nullable().optional(),
    sourceTag: z.string().optional(),
  }),
};

const createSeatMatrixEntry = {
  body: z.object({
    collegeName: z.string().min(1),
    city: z.string().min(1),
    courseSlug: z.string().min(1),
    authority: z.string().min(1),
    category: categorySchema,
    quota: z.string().min(1),
    round: z.string().min(1),
    year: z.number().int().min(2000).max(2100),
    seats: z.number().int().nonnegative(),
  }),
};

module.exports = {
  createCollege,
  updateCollege,
  patchUser,
  createCoupon,
  updateCoupon,
  createCounsellor,
  updateCounsellor,
  assignRole,
  createRole,
  createCollegeCourseLink,
  createCutoffEntry,
  createFeeEntry,
  createSeatMatrixEntry,
};
