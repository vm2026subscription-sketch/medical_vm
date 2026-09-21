const { z } = require('zod');

const updateProfile = {
  body: z.object({
    name: z.string().min(1).optional(),
    neetRank: z.number().int().positive().optional(),
    neetScore: z.number().positive().optional(),
    category: z.enum(['General', 'EWS', 'OBC', 'SC', 'ST', 'PwD']).optional(),
    homeState: z.string().optional(),
    domicile: z.string().optional(),
    marks: z.number().optional(),
    preferences: z
      .object({
        maxBudget: z.number().positive().optional(),
        courses: z.array(z.string()).optional(),
      })
      .optional(),
  }),
};

module.exports = { updateProfile };
