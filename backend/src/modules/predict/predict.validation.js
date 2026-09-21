const { z } = require('zod');

const predict = {
  body: z.object({
    rank: z.number().int().positive(),
    category: z.enum(['General', 'EWS', 'OBC', 'SC', 'ST', 'PwD']),
    state: z.string().trim().min(1).max(100),
    budget: z.number().finite().positive().optional(),
    courses: z.array(z.string().regex(/^[a-z0-9-]{1,100}$/)).min(1).max(20),
  }),
};

module.exports = { predict };
