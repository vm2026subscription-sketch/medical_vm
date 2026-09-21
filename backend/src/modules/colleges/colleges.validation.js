const { z } = require('zod');
const { categorySchema } = require('../../utils/categoryCodes');
const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

const listColleges = {
  query: z.object({
    course: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    category: categorySchema.optional(),
    quota: z.enum(['AIQ', 'State', 'Management', 'NRI', 'Deemed']).optional(),
    ownership: z.enum(['govt', 'private', 'deemed']).optional(),
    minFee: z.coerce.number().finite().nonnegative().optional(),
    maxFee: z.coerce.number().finite().nonnegative().optional(),
    search: z.string().trim().max(150).optional(),
    page: z.coerce.number().int().min(1).max(100000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }).refine((value) => value.minFee === undefined || value.maxFee === undefined || value.minFee <= value.maxFee, { message: 'Minimum fee must not exceed maximum fee' }),
};

const getCollege = {
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'Invalid college id'),
  }),
};

const saveCollege = {
  params: z.object({
    id: z.string().regex(mongoIdRegex),
  }),
  body: z.object({
    tag: z.enum(['safe', 'target', 'dream']).optional(),
    notes: z.string().optional(),
  }),
};

const compareColleges = {
  body: z.object({
    collegeIds: z.array(z.string().regex(mongoIdRegex)).min(2).max(4),
  }),
};

module.exports = { listColleges, getCollege, saveCollege, compareColleges };
