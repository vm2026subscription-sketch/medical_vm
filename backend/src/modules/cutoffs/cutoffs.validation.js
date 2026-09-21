const { z } = require('zod');
const { categorySchema } = require('../../utils/categoryCodes');

const listCutoffs = {
  query: z.object({
    course: z.string().optional(),
    state: z.string().trim().max(100).optional(),
    category: categorySchema.optional(),
    quota: z.string().optional(),
    year: z.coerce.number().optional(),
    search: z.string().trim().max(150).optional(),
    page: z.coerce.number().int().min(1).max(100000).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
};

module.exports = { listCutoffs };
