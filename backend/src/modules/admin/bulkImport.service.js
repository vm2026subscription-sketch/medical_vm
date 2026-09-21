const { parse } = require('csv-parse/sync');
const College = require('../../models/College');
const Course = require('../../models/Course');
const CollegeCourse = require('../../models/CollegeCourse');
const CutOff = require('../../models/CutOff');
const Fee = require('../../models/Fee');
const SeatMatrix = require('../../models/SeatMatrix');
const ApiError = require('../../utils/ApiError');
const schemas = require('./admin.validation');
const { recordAudit } = require('./audit.helper');

const definitions = {
  colleges: { model: College, schema: schemas.createCollege.body, keys: ['name', 'city'], entity: 'College' },
  'college-courses': { model: CollegeCourse, schema: schemas.createCollegeCourseLink.body, keys: ['collegeId', 'courseId'], entity: 'CollegeCourse' },
  cutoffs: { model: CutOff, schema: schemas.createCutoffEntry.body, keys: ['collegeCourseId', 'category', 'quota', 'authority', 'year', 'round'], entity: 'CutOff' },
  fees: { model: Fee, schema: schemas.createFeeEntry.body, keys: ['collegeCourseId', 'year', 'tier'], entity: 'Fee' },
  'seat-matrix': { model: SeatMatrix, schema: schemas.createSeatMatrixEntry.body, keys: ['collegeCourseId', 'authority', 'category', 'quota', 'round', 'year'], entity: 'SeatMatrix' },
};
const numbers = new Set(['totalSeats', 'year', 'closingRank', 'closingScore', 'seats', 'tuition', 'otherCharges']);

function parseCsv(buffer, schema) {
  let records;
  try {
    records = parse(buffer, {
      bom: true, skip_empty_lines: true, trim: true, info: true, max_record_size: 64000,
      columns(headers) {
        if (new Set(headers).size !== headers.length) throw new Error('Duplicate column headers');
        const allowed = Object.keys(schema.shape);
        const unknown = headers.filter((h) => !allowed.includes(h));
        if (unknown.length) throw new Error(`Unknown columns: ${unknown.join(', ')}`);
        const missing = allowed.filter((h) => !schema.shape[h].isOptional() && !headers.includes(h));
        if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}`);
        return headers;
      },
    });
  } catch (err) {
    throw ApiError.badRequest(`Invalid CSV: ${err.message}`);
  }
  if (!records.length) throw ApiError.badRequest('CSV has no data rows');
  if (records.length > 2000) throw ApiError.badRequest('Maximum 2,000 rows per import. Split your file into smaller batches.');
  return records;
}

function normalizeRow(row, schema) {
  const input = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === '' && schema.shape[key]?.isOptional()) continue;
    if ((key === 'totalSeats' || (['tuition', 'otherCharges'].includes(key) && schema.shape[key]?.isNullable())) && (value === null || /^n\/?a$/i.test(String(value).trim()))) input[key] = null;
    else if (numbers.has(key)) input[key] = value === '' ? NaN : Number(value);
    else if (key === 'nmcApproved' || key === 'isActive') {
      if (!/^(true|false)$/i.test(value)) throw new Error(`${key}: use true or false`);
      input[key] = value.toLowerCase() === 'true';
    } else if (key === 'images' || key === 'facilities') input[key] = value.split('|').map((v) => v.trim()).filter(Boolean);
    else if (key === 'location') {
      try { input[key] = JSON.parse(value); } catch { throw new Error('location: use JSON with lat and lng'); }
    } else input[key] = value;
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.data;
}

async function resolveLink(collegeName, city, courseSlug) {
  const college = await College.findOne({ name: collegeName.trim(), city: city.trim() });
  if (!college) throw ApiError.badRequest(`College not found: "${collegeName}" in "${city}". Import colleges first.`);
  const course = await Course.findOne({ slug: courseSlug.trim().toLowerCase() });
  if (!course) throw ApiError.badRequest(`Course not found: "${courseSlug}". Add it in Courses first.`);
  return { collegeId: college._id, courseId: course._id };
}

async function resolveCollegeCourseId(collegeName, city, courseSlug) {
  const ids = await resolveLink(collegeName, city, courseSlug);
  const link = await CollegeCourse.findOne(ids);
  if (!link) throw ApiError.badRequest(`College-course link missing for "${collegeName}" + "${courseSlug}". Import links first.`);
  return link._id;
}

async function bulkImport(entity, buffer, adminUserId, dryRun = false) {
  const definition = definitions[entity];
  if (!definition) throw ApiError.badRequest('Unsupported import type');
  const { model, schema, keys } = definition;
  const rows = parseCsv(buffer, schema);
  const result = { total: rows.length, valid: 0, succeeded: 0, failed: 0, created: 0, updated: 0, dryRun, blocked: false, errors: [], preview: [] };
  const prepared = [];
  const seen = new Set();
  const references = new Map();
  // Validate the entire batch, including references, before writing any records.
  for (const { record, info } of rows) {
    try {
      const data = normalizeRow(record, schema);
      const { collegeName, city, courseSlug, ...rest } = data;
      let document = data;
      if (entity !== 'colleges') {
        const referenceKey = JSON.stringify([collegeName, city, courseSlug]);
        if (!references.has(referenceKey)) references.set(referenceKey, entity === 'college-courses'
          ? await resolveLink(collegeName, city, courseSlug)
          : { collegeCourseId: await resolveCollegeCourseId(collegeName, city, courseSlug) });
        document = { ...rest, ...references.get(referenceKey) };
      }
      const filter = Object.fromEntries(keys.map((key) => [key, document[key]]));
      const key = JSON.stringify(filter);
      if (seen.has(key)) throw new Error('Duplicate record in this file. Keep one row per identifying combination.');
      seen.add(key);
      prepared.push({ row: info.lines, document, filter });
      if (result.preview.length < 5) result.preview.push(data);
    } catch (err) {
      result.errors.push({ row: info.lines, message: err.message });
    }
  }
  result.valid = prepared.length;
  result.failed = result.errors.length;
  result.blocked = result.failed > 0;
  if (dryRun || result.blocked) return result;

  for (const { row, document, filter } of prepared) {
    try {
      const outcome = await model.updateOne(filter, { $set: document }, { upsert: true, runValidators: true });
      result.succeeded += 1;
      if (outcome.upsertedCount) result.created += 1;
      else result.updated += 1;
    } catch (err) {
      result.failed += 1;
      result.errors.push({ row, message: err.code === 11000 ? 'Duplicate record. Check identifying columns.' : err.message });
    }
  }
  await recordAudit({ adminUserId, action: 'bulk_import', entity: definition.entity,
    after: { total: result.total, succeeded: result.succeeded, failed: result.failed, created: result.created, updated: result.updated } });
  return result;
}

module.exports = {
  bulkImport,
  bulkImportColleges: (buffer, id, dry) => bulkImport('colleges', buffer, id, dry),
  bulkImportCollegeCourses: (buffer, id, dry) => bulkImport('college-courses', buffer, id, dry),
  bulkImportCutoffs: (buffer, id, dry) => bulkImport('cutoffs', buffer, id, dry),
  bulkImportFees: (buffer, id, dry) => bulkImport('fees', buffer, id, dry),
  bulkImportSeatMatrix: (buffer, id, dry) => bulkImport('seat-matrix', buffer, id, dry),
  resolveCollegeCourseId,
};
