const { z } = require('zod');
const schemas = require('./admin.validation');
const code = z.string().trim().regex(/^[a-zA-Z0-9_-]{3,80}$/, 'Use a permanent college code (letters, numbers, hyphens)');
const references = { collegeCode: code.optional(), collegeName: z.string().trim().optional(), city: z.string().trim().optional() };
const { courseSchema: course } = require('../courses/courseSchema');
const feeFields = schemas.createFeeEntry.body.shape;
const combinedFeeSchema = z.object({
  collegeCode: references.collegeCode,
  courseSlug: feeFields.courseSlug,
  year: feeFields.year,
  tier: feeFields.tier,
  tuition: feeFields.tuition,
  otherCharges: feeFields.otherCharges,
  hostelMess: z.number().nonnegative().nullable().optional(),
  sourceTag: feeFields.sourceTag,
  collegeName: references.collegeName,
  city: references.city,
});
const definitions = {
  'hostel-fees': { model: require('../../models/HostelFee'), schema: z.object({ ...references, year: z.number().int().min(2000).max(2100), amount: z.number().nonnegative().nullable().optional() }), keys: ['collegeId', 'year'], sample: { collegeCode: 'COL-DEMO-001', year: '2026', amount: '85000' } },
  bonds: { model: require('../../models/BondDetail'), schema: z.object({ ...references, courseSlug: z.string().trim().min(1), years: z.number().nonnegative().max(50).nullable().optional(), penaltyAmount: z.number().nonnegative().nullable().optional(), applicableStates: z.array(z.string()).optional() }), keys: ['collegeCourseId'], sample: { collegeCode: 'COL-DEMO-001', courseSlug: 'mbbs', years: '1', penaltyAmount: '1000000', applicableStates: 'Maharashtra' } },
  courses: { model: require('../../models/Course'), schema: course, keys: ['slug'], sample: { name: 'MBBS', slug: 'mbbs', fullName: 'Bachelor of Medicine and Bachelor of Surgery', duration: '5.5 years', eligibility: 'NEET qualified|Class 12 PCB', careerPath: 'Clinical practice after registration', discipline: 'Medicine', level: 'Degree', admissionRoute: 'neet-ug', admissionNotes: 'NEET-UG and applicable counselling', aliases: 'Bachelor of Medicine and Bachelor of Surgery', sourceUrls: 'https://neet.nta.nic.in/', reviewedOn: '2026-09-13' } },
  colleges: { model: require('../../models/College'), schema: schemas.createCollege.body.extend({ collegeCode: code }), keys: ['collegeCode'], sample: { collegeCode: 'COL-DEMO-001', name: 'Demo Medical College', city: 'Pune', state: 'Maharashtra', ownership: 'govt', isActive: 'true', nmcApproved: 'true', facilities: 'Library|Hostel', images: '' } },
  'college-courses': { model: require('../../models/CollegeCourse'), schema: schemas.createCollegeCourseLink.body.extend(references), keys: ['collegeId', 'courseId'], sample: { collegeCode: 'COL-DEMO-001', courseSlug: 'mbbs', totalSeats: 'N/A' } },
  cutoffs: { model: require('../../models/CutOff'), schema: schemas.createCutoffEntry.body.extend(references), keys: ['collegeCourseId', 'category', 'quota', 'authority', 'year', 'round'], sample: { collegeCode: 'COL-DEMO-001', courseSlug: 'mbbs', category: 'General', quota: 'AIQ', authority: 'MCC', year: '2026', round: 'Round1', closingRank: '12345', closingScore: '640', seats: '15' } },
  fees: { model: require('../../models/Fee'), schema: combinedFeeSchema, keys: ['collegeCourseId', 'year', 'tier'], sample: { collegeCode: 'COL-DEMO-001', courseSlug: 'mbbs', year: '2026', tier: 'merit', tuition: '100000', otherCharges: '15000', hostelMess: '85000', sourceTag: 'Official prospectus 2026' } },
  'seat-matrix': { model: require('../../models/SeatMatrix'), schema: schemas.createSeatMatrixEntry.body.extend(references), keys: ['collegeCourseId', 'authority', 'category', 'quota', 'round', 'year'], sample: { collegeCode: 'COL-DEMO-001', courseSlug: 'mbbs', authority: 'MCC', category: 'General', quota: 'AIQ', round: 'Round1', year: '2026', seats: '15' } },
};
const numeric = new Set(['totalSeats', 'year', 'closingRank', 'closingScore', 'seats', 'tuition', 'otherCharges', 'hostelMess', 'amount', 'years', 'penaltyAmount']);
const nullableNumbers = new Set(['tuition', 'otherCharges', 'hostelMess', 'amount', 'years', 'penaltyAmount']);
const lists = new Set(['images', 'facilities', 'eligibility', 'careerPath', 'aliases', 'sourceUrls', 'applicableStates']);
function parseLocation(text) {
  if (text.startsWith('{')) {
    try { return JSON.parse(text); } catch { throw new Error('location: use latitude=11.6500944|longitude=92.7493750 or JSON with lat and lng'); }
  }
  const coordinates = {};
  for (const part of text.split('|')) {
    const match = part.trim().match(/^(latitude|longitude)\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/i);
    if (!match) throw new Error('location: use latitude=11.6500944|longitude=92.7493750');
    const key = match[1].toLowerCase() === 'latitude' ? 'lat' : 'lng';
    if (key in coordinates) throw new Error('location: provide latitude and longitude exactly once');
    coordinates[key] = Number(match[2]);
  }
  return coordinates;
}
function normalize(input, schema) {
  const data = {};
  for (const key of Object.keys(schema.shape)) {
    const value = input[key];
    if (value === undefined || String(value).trim() === '') continue;
    const text = String(value).trim();
    if (key === 'totalSeats' && (value === null || /^n\/?a$/i.test(text))) { data[key] = null; continue; }
    if (nullableNumbers.has(key) && schema.shape[key].isNullable() && (value === null || /^n\/?a$/i.test(text))) { data[key] = null; continue; }
    if (numeric.has(key)) { if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`${key}: use a number without commas or currency symbols`); data[key] = Number(text); }
    else if (['isActive', 'nmcApproved'].includes(key)) { if (!/^(true|false)$/i.test(text)) throw new Error(`${key}: use true or false`); data[key] = text.toLowerCase() === 'true'; }
    else if (lists.has(key)) data[key] = text === '[]' ? [] : text.split('|').map((s) => s.trim()).filter(Boolean);
    else if (key === 'location') data[key] = parseLocation(text);
    else data[key] = key === 'courseSlug' || key === 'slug' ? text.toLowerCase() : key === 'collegeCode' ? text.toUpperCase() : text;
  }
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return result.data;
}
function metadata() {
  return Object.entries(definitions).map(([entity, d]) => ({ entity, fields: Object.entries(d.schema.shape).map(([key, value]) => ({ key, required: !value.isOptional(), example: key === 'totalSeats' ? '150 or N/A' : nullableNumbers.has(key) ? `${d.sample[key] || '100000'} or N/A` : d.sample[key] || '', type: numeric.has(key) && key !== 'totalSeats' && !nullableNumbers.has(key) ? 'number' : 'text' })), sample: d.sample }));
}
module.exports = { definitions, normalize, metadata, nullableNumbers };
