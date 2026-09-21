const { z } = require('zod');

const listCourses = { query: z.object({}).passthrough() };
const getCourse = { params: z.object({ slug: z.string().min(1) }) };

module.exports = { listCourses, getCourse };
