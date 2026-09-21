const { z } = require('zod');

const disciplines = ['Medicine', 'Dental', 'AYUSH', 'Nursing', 'Pharmacy', 'Rehabilitation', 'Allied health', 'Health sciences', 'Veterinary'];
const courseSchema = z.object({
  name: z.string().trim().min(1), slug: z.string().trim().regex(/^[a-z0-9-]+$/),
  fullName: z.string().optional(), duration: z.string().optional(), description: z.string().optional(),
  eligibility: z.array(z.string()).optional(), careerPath: z.array(z.string()).optional(),
  discipline: z.enum(disciplines).optional(), level: z.enum(['Degree', 'Diploma']).optional(),
  admissionRoute: z.enum(['neet-ug', 'institution-specific']).optional(), admissionNotes: z.string().optional(),
  aliases: z.array(z.string()).optional(), sourceUrls: z.array(z.string().url().regex(/^https:\/\//)).optional(),
  reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
module.exports = { courseSchema, disciplines };
