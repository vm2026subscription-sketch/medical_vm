const mongoose = require('mongoose');
const crypto = require('crypto');
const ApiError = require('../../utils/ApiError');
const Batch = require('../../models/ImportBatch');
const Row = require('../../models/ImportRow');
const File = require('../../models/ImportFile');
const Alias = require('../../models/CollegeAlias');
const Lock = require('../../models/CatalogLock');
const Audit = require('../../models/AuditLog');
const College = require('../../models/College');
const Course = require('../../models/Course');
const Link = require('../../models/CollegeCourse');
const HostelFee = require('../../models/HostelFee');
const { definitions, normalize } = require('./importDefinitions');
const { readSheet } = require('./spreadsheet');
const plain = (v) => JSON.parse(JSON.stringify(v));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  return value;
}
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(canonical(plain(value)))).digest('hex');
const canReview = (role) => role.name === 'super_admin' || (role.name !== 'data_editor' && role.permissions.includes('imports:review'));
async function transaction(fn) {
  await require('./importStorage').assertStorage();
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => fn(session)); }
  catch (e) {
    if (e.code === 20 || /Transaction numbers are only allowed/.test(e.message)) throw ApiError.conflict('Imports require MongoDB Atlas or a replica set. No data was published.');
    throw e;
  } finally { await session.endSession(); }
}
async function access(id, userId, role) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid batch ID');
  const batch = await Batch.findById(id).lean();
  if (!batch || (!canReview(role) && String(batch.createdBy) !== String(userId))) throw ApiError.notFound('Batch not found');
  return batch;
}
function editable(batch, revision) {
  if (!['draft', 'needs_correction', 'ready', 'rejected'].includes(batch.status)) throw ApiError.conflict('Submitted or published batches cannot be edited. Return a submitted batch for correction first.');
  if (batch.revision !== revision) throw ApiError.conflict('This batch changed. Reload it before continuing.');
}
async function create({ entity, source, sourceUrl, file, sheet, input, userId }) {
  if (!definitions[entity]) throw ApiError.badRequest('Unknown import type');
  let parsed;
  if (file) parsed = await readSheet(file.buffer, file.originalname, sheet);
  else parsed = { headers: Object.keys(input), rows: [{ row: 2, input }], sheet: 'Manual entry', sheets: [] };
  const mapping = Object.fromEntries(Object.keys(definitions[entity].schema.shape).filter((key) => parsed.headers.includes(key)).map((key) => [key, key]));
  return transaction(async (session) => {
    const stored = file ? (await File.create([{ ownerId: userId, filename: file.originalname, content: file.buffer }], { session }))[0] : null;
    const batch = (await Batch.create([{ entity, source, sourceUrl, createdBy: userId, filename: file?.originalname || 'Manual entry', fileId: stored?._id, sheet: parsed.sheet, sheets: parsed.sheets, headers: parsed.headers, mapping, totals: { total: parsed.rows.length } }], { session }))[0];
    await Row.insertMany(parsed.rows.map((r) => ({ ...r, batchId: batch._id })), { session });
    return batch.toObject();
  });
}
const aliasKey = (source, name, city) => hash([source.trim().toLowerCase(), name.trim().toLowerCase(), city.trim().toLowerCase()]);
const cacheKey = (model, filter) => model.modelName + JSON.stringify(filter);
const keyValue = (field, value) => ['_id', 'collegeId', 'courseId', 'collegeCourseId'].includes(field) ? String(value).toLowerCase() : String(value);
async function prefetch(model, filters, cache, session) {
  const unique = [...new Map(filters.map((filter) => [cacheKey(model, filter), filter])).entries()];
  if (!unique.length) return;
  let query = model.find({ $or: unique.map(([, filter]) => filter) });
  if (session) query = query.session(session);
  const records = await query.lean();
  // Group by each identifying shape, avoiding a full scan per spreadsheet row.
  const shapes = new Map();
  for (const [key, filter] of unique) {
    const fields = Object.keys(filter); const shape = JSON.stringify(fields);
    if (!shapes.has(shape)) {
      const map = new Map();
      for (const record of records) {
        const id = JSON.stringify(fields.map((field) => keyValue(field, record[field])));
        map.set(id, [...(map.get(id) || []), record].slice(0, 2));
      }
      shapes.set(shape, map);
    }
    cache.set(key, shapes.get(shape).get(JSON.stringify(fields.map((field) => keyValue(field, filter[field])))) || []);
  }
}
async function primeValidation(entity, inputs, source, cache) {
  const d = definitions[entity];
  const rows = inputs.flatMap((input) => { try { return [normalize(input, d.schema)]; } catch { return []; } });
  if (entity === 'courses') return prefetch(Course, rows.map((r) => ({ slug: r.slug })), cache);
  if (entity === 'colleges') return prefetch(College, rows.flatMap((r) => [{ collegeCode: r.collegeCode }, { name: r.name, city: r.city }, ...(/^[a-f0-9]{24}$/i.test(r.collegeCode) ? [{ _id: r.collegeCode }] : [])]), cache);
  const aliasFilters = rows.filter((r) => r.collegeName && r.city).map((r) => ({ key: aliasKey(source, r.collegeName, r.city) }));
  await prefetch(Alias, aliasFilters, cache);
  const collegeFilter = (r) => {
    if (r.collegeCode) return /^[a-f0-9]{24}$/i.test(r.collegeCode) ? { _id: r.collegeCode } : { collegeCode: r.collegeCode };
    if (!r.collegeName || !r.city) return null;
    const alias = cache.get(cacheKey(Alias, { key: aliasKey(source, r.collegeName, r.city) }))?.[0];
    return alias ? { _id: alias.collegeId } : { name: r.collegeName, city: r.city };
  };
  await prefetch(College, rows.map(collegeFilter).filter(Boolean), cache);
  if (entity === 'hostel-fees') {
    return prefetch(d.model, rows.flatMap((r) => {
      const filter = collegeFilter(r); const college = filter && cache.get(cacheKey(College, filter))?.[0];
      return college ? [{ collegeId: college._id, year: r.year }] : [];
    }), cache);
  }
  await prefetch(Course, rows.map((r) => ({ slug: r.courseSlug })), cache);
  const linkFilter = (r) => {
    const filter = collegeFilter(r); const college = filter && cache.get(cacheKey(College, filter))?.[0];
    const course = cache.get(cacheKey(Course, { slug: r.courseSlug }))?.[0];
    return college && course ? { collegeId: college._id, courseId: course._id } : null;
  };
  await prefetch(Link, rows.map(linkFilter).filter(Boolean), cache);
  if (entity === 'college-courses') return;
  const filters = rows.flatMap((r) => {
    const filter = linkFilter(r); const link = filter && cache.get(cacheKey(Link, filter))?.[0];
    return link ? [Object.fromEntries(d.keys.map((key) => [key, key === 'collegeCourseId' ? link._id : r[key]]))] : [];
  });
  await prefetch(d.model, filters, cache);
  if (entity === 'fees') await prefetch(HostelFee, rows.flatMap((r) => {
    const filter = collegeFilter(r); const college = filter && cache.get(cacheKey(College, filter))?.[0];
    return college ? [{ collegeId: college._id, year: r.year }] : [];
  }), cache);
}
async function prepare(entity, input, source, cache) {
  const d = definitions[entity]; const data = normalize(input, d.schema);
  const cached = async (model, filter) => {
    const key = cacheKey(model, filter);
    if (!cache.has(key)) cache.set(key, await model.find(filter).limit(2).lean());
    const values = cache.get(key);
    if (values.length > 1) throw new Error('Ambiguous existing records. Ask the main admin to resolve duplicates before importing.');
    return values[0] || null;
  };
  let document = { ...data }, alias = null, hostel = null; const references = [];
  if (!['courses', 'colleges'].includes(entity)) {
    const { collegeCode, collegeName, city, courseSlug, ...rest } = data;
    let college;
    if (collegeCode) college = await cached(College, /^[a-f0-9]{24}$/i.test(collegeCode) ? { _id: collegeCode } : { collegeCode });
    else if (collegeName && city) {
      const existingAlias = await cached(Alias, { key: aliasKey(source, collegeName, city) });
      college = existingAlias ? await cached(College, { _id: existingAlias.collegeId }) : await cached(College, { name: collegeName, city });
    } else throw new Error('Choose a college code, or map both collegeName and city');
    if (!college) throw new Error('College not found. Publish the college master first, or select its existing code from the college directory.');
    if (collegeName && city && collegeCode) {
      alias = { key: aliasKey(source, collegeName, city), source, label: `${collegeName}, ${city}`, collegeId: college._id };
      const existingAlias = await cached(Alias, { key: alias.key });
      if (existingAlias && String(existingAlias.collegeId) !== String(college._id)) throw new Error('This source name already belongs to another college. Ask the main admin to resolve the alias.');
    }
    references.push({ model: 'College', id: college._id, hash: hash(college) });
    if (entity === 'hostel-fees') document = { ...rest, collegeId: college._id };
    else {
    const course = await cached(Course, { slug: courseSlug });
    if (!course) throw new Error('Course not found. Publish the course master first.');
    references.push({ model: 'Course', id: course._id, hash: hash(course) });
    const ids = { collegeId: college._id, courseId: course._id };
    if (entity === 'college-courses') document = { ...rest, ...ids };
    else {
      const link = await cached(Link, ids);
      if (!link) throw new Error('College-course link not found. Publish links before fees, cutoffs or seat matrix.');
      references.push({ model: 'CollegeCourse', id: link._id, hash: hash(link) });
      document = { ...rest, collegeCourseId: link._id };
      if (entity === 'fees') {
        delete document.hostelMess;
        const hostelFilter = { collegeId: college._id, year: data.year };
        const hostelBefore = await cached(HostelFee, hostelFilter);
        if (data.hostelMess !== undefined || !hostelBefore) {
          hostel = { filter: hostelFilter, targetId: hostelBefore?._id || new mongoose.Types.ObjectId(), before: hostelBefore, baseHash: hash(hostelBefore), document: { ...hostelFilter, amount: data.hostelMess ?? null }, changed: !hostelBefore || hostelBefore.amount !== data.hostelMess, implicit: data.hostelMess === undefined };
          const error = new HostelFee(hostel.document).validateSync();
          if (error) throw new Error(error.message);
        }
      }
    }
    }
  }
  let filter = Object.fromEntries(d.keys.map((key) => [key, document[key]]));
  let before = await cached(d.model, filter);
  // Blank fees preserve existing values. New records explicitly store unknown amounts.
  if (!before && entity === 'fees') {
    document.tuition ??= null;
    document.otherCharges ??= null;
  }
  if (!before && entity === 'hostel-fees') document.amount ??= null;
  if (!before && entity === 'bonds') {
    document.years ??= null;
    document.penaltyAmount ??= null;
  }
  if (entity === 'colleges') {
    // Existing IDs are permanent import references too; never silently create a renamed duplicate.
    if (/^[a-f0-9]{24}$/i.test(data.collegeCode)) {
      before = await cached(College, { _id: data.collegeCode });
      if (!before) throw new Error('Existing college ID not found. Use a new site code to create a college.');
      filter = { _id: before._id }; delete document.collegeCode;
    }
    const sameName = await cached(College, { name: data.name, city: data.city });
    if (sameName && String(sameName._id) !== String(before?._id)) throw new Error(`College already exists. Use code ${sameName.collegeCode || sameName._id} instead of creating another college.`);
  }
  const changedFields = Object.keys(document).filter((key) => JSON.stringify(plain(document[key])) !== JSON.stringify(before?.[key] === undefined ? null : plain(before[key])));
  if (hostel?.changed) changedFields.push('hostelMess');
  const modelError = new d.model({ ...before, ...document }).validateSync();
  if (modelError) throw new Error(modelError.message);
  return plain({ filter, targetId: before?._id || new mongoose.Types.ObjectId(), before, document, baseHash: hash(before), action: before ? (changedFields.length ? 'update' : 'unchanged') : 'create', changedFields, references, alias, hostel });
}
async function validate(batch, { mapping, defaults = {}, overrides = {}, revision, source = batch.source, sourceUrl = batch.sourceUrl }) {
  editable(batch, revision);
  const fields = Object.keys(definitions[batch.entity].schema.shape);
  if (Object.keys(mapping).some((k) => !fields.includes(k)) || Object.values(mapping).some((v) => v && !batch.headers.includes(v))) throw ApiError.badRequest('Invalid column mapping');
  if (Object.keys(defaults).some((k) => !fields.includes(k))) throw ApiError.badRequest('Unknown default field');
  const rows = await Row.find({ batchId: batch._id }).sort({ row: 1 }).lean();
  const cache = new Map(), seen = new Set(); const totals = { total: rows.length, valid: 0, errors: 0, create: 0, update: 0, unchanged: 0 };
  const writes = [];
  const inputs = rows.map((row) => {
    const input = { ...defaults };
    for (const [key, column] of Object.entries(mapping)) if (column && row.input[column] !== '') input[key] = row.input[column];
    const override = { ...(row.override || {}), ...(overrides[String(row.row)] || {}) };
    if (Object.keys(override).some((k) => !fields.includes(k))) throw ApiError.badRequest('Unknown row field');
    Object.assign(input, override);
    return { row, input, override };
  });
  await primeValidation(batch.entity, inputs.map((r) => r.input), source, cache);
  const names = new Set(), batchAliases = new Map(), hostelAmounts = new Map();
  for (const { row, input, override } of inputs) {
    let prepared, errors = [];
    try {
      prepared = await prepare(batch.entity, input, source, cache);
      const key = JSON.stringify(prepared.filter);
      if (seen.has(key)) throw new Error('Duplicate identifying combination in this batch. Keep one row per record.');
      if (prepared.hostel && !prepared.hostel.implicit) {
        const hostelKey = JSON.stringify(prepared.hostel.filter);
        const amount = prepared.hostel.document.amount;
        if (hostelAmounts.has(hostelKey) && hostelAmounts.get(hostelKey) !== amount) throw new Error('hostelMess: conflicting amounts for the same college and year. Use the same annual hostel + mess amount across its rows, or leave the other rows blank.');
        hostelAmounts.set(hostelKey, amount);
      }
      if (batch.entity === 'colleges') {
        const name = JSON.stringify([prepared.document.name, prepared.document.city]);
        if (names.has(name)) throw new Error('Duplicate college name and city in this batch. Keep one permanent college code.');
        names.add(name);
      }
      if (prepared.alias) {
        if (batchAliases.has(prepared.alias.key) && batchAliases.get(prepared.alias.key) !== prepared.alias.collegeId) throw new Error('The same source name is mapped to two colleges in this batch');
        batchAliases.set(prepared.alias.key, prepared.alias.collegeId);
      }
      seen.add(key); totals.valid++; totals[prepared.action]++;
    } catch (e) { errors = [e.message]; totals.errors++; prepared = null; }
    writes.push({ updateOne: { filter: { _id: row._id }, update: { $set: { prepared, rowErrors: errors, override, mapped: input } } } });
  }
  // A blank new-year hostel value must not fall back to last year's amount. If
  // another row supplies this college/year's amount, show and publish that shared value.
  for (const write of writes) {
    const hostel = write.updateOne.update.$set.prepared?.hostel;
    if (hostel?.implicit && hostelAmounts.has(JSON.stringify(hostel.filter))) hostel.document.amount = hostelAmounts.get(JSON.stringify(hostel.filter));
  }
  return transaction(async (session) => {
    const updated = await Batch.findOneAndUpdate({ _id: batch._id, revision, status: batch.status }, { $set: { mapping, defaults, totals, source, sourceUrl: sourceUrl || '', status: totals.errors ? 'needs_correction' : 'ready', reviewNote: '' }, $inc: { revision: 1 } }, { new: true, session });
    if (!updated) throw ApiError.conflict('Batch changed. Reload before validating.');
    await Row.bulkWrite(writes, { session }); return updated.toObject();
  });
}
async function publish(batch, userId, revision) {
  if (batch.status === 'published') return batch;
  if (batch.status !== 'submitted' || revision !== batch.revision) throw ApiError.conflict('Only the current submitted revision can be published');
  return transaction(async (session) => {
    // All workflow publishes serialize before reading the catalog snapshot.
    await Lock.updateOne({ _id: 'catalog' }, { $inc: { revision: 1 } }, { upsert: true, session });
    const currentBatch = await Batch.findOne({ _id: batch._id, status: 'submitted', revision }).session(session).lean();
    if (!currentBatch) throw ApiError.conflict('Batch changed. Reload it.');
    const rows = await Row.find({ batchId: batch._id }).session(session).lean();
    if (!rows.length || rows.some((r) => !r.prepared || r.rowErrors.length)) throw ApiError.conflict('Batch is not fully validated');
    const d = definitions[batch.entity];
    const existing = await d.model.find({ $or: rows.flatMap((r) => [r.prepared.filter, ...(batch.entity === 'colleges' ? [{ name: r.prepared.document.name, city: r.prepared.document.city }] : [])]) }).session(session).lean();
    const byId = new Map(existing.map((v) => [String(v._id), v]));
    // A newly-created natural key must still be absent, including writes from another batch.
    const referenceCache = new Map();
    for (const modelName of ['College', 'Course', 'CollegeCourse']) {
      const ids = [...new Set(rows.flatMap((r) => r.prepared.references.filter((ref) => ref.model === modelName).map((ref) => ref.id)))];
      if (ids.length) {
        const records = await mongoose.model(modelName).find({ _id: { $in: ids } }).session(session).lean();
        for (const record of records) referenceCache.set(modelName + record._id, record);
      }
    }
    const aliases = rows.map((r) => r.prepared.alias).filter(Boolean);
    const savedAliases = aliases.length ? await Alias.find({ key: { $in: aliases.map((a) => a.key) } }).session(session).lean() : [];
    const aliasMap = new Map(savedAliases.map((a) => [a.key, a]));
    const aliasWrites = new Map();
    const hostelCache = new Map(), hostelWrites = new Map();
    if (batch.entity === 'fees') await prefetch(HostelFee, rows.map((r) => r.prepared.hostel?.filter).filter(Boolean), hostelCache, session);
    const operations = [];
    for (const row of rows) {
      const p = row.prepared; const current = byId.get(String(p.targetId)) || null;
      if (hash(current) !== p.baseHash) throw ApiError.conflict(`Row ${row.row}: live data changed after validation. Return this batch for correction and validate again.`);
      if (!p.before && existing.some((v) => Object.entries(p.filter).every(([k, value]) => String(v[k]) === String(value)))) throw ApiError.conflict(`Row ${row.row}: another record now uses this key. Validate again.`);
      if (batch.entity === 'colleges' && existing.some((v) => v.name === p.document.name && v.city === p.document.city && String(v._id) !== String(p.targetId))) throw ApiError.conflict(`Row ${row.row}: this college name and city now exists with another code. Validate again.`);
      for (const ref of p.references) {
        const key = ref.model + ref.id;
        if (!referenceCache.has(key)) referenceCache.set(key, await mongoose.model(ref.model).findById(ref.id).session(session).lean());
        if (hash(referenceCache.get(key)) !== ref.hash) throw ApiError.conflict(`Row ${row.row}: linked master data changed. Validate again.`);
      }
      if (p.alias) {
        const alias = aliasMap.get(p.alias.key);
        if (alias && String(alias.collegeId) !== String(p.alias.collegeId)) throw ApiError.conflict('College alias changed. Validate again.');
        aliasMap.set(p.alias.key, p.alias);
        aliasWrites.set(p.alias.key, { updateOne: { filter: { key: p.alias.key }, update: { $setOnInsert: p.alias }, upsert: true } });
      }
      if (batch.entity === 'fees' && p.hostel) {
        const h = p.hostel, key = cacheKey(HostelFee, h.filter);
        const currentHostels = hostelCache.get(key) || [];
        if (currentHostels.length > 1 || hash(currentHostels[0] || null) !== h.baseHash) throw ApiError.conflict(`Row ${row.row}: hostel fees changed after validation. Return this batch for correction and validate again.`);
        if (h.changed && !hostelWrites.has(key)) hostelWrites.set(key, { updateOne: { filter: { _id: h.targetId }, update: { $set: h.document }, upsert: !h.before } });
      }
      if (!p.before || p.changedFields.some((key) => key !== 'hostelMess')) operations.push({ updateOne: { filter: { _id: p.targetId }, update: { $set: p.document }, upsert: !p.before } });
    }
    if (operations.length) await d.model.bulkWrite(operations, { session, ordered: true });
    if (hostelWrites.size) await HostelFee.bulkWrite([...hostelWrites.values()], { session, ordered: true });
    if (aliasWrites.size) await Alias.bulkWrite([...aliasWrites.values()], { session, ordered: true });
    const updated = await Batch.findOneAndUpdate({ _id: batch._id, status: 'submitted', revision }, { $set: { status: 'published', reviewedBy: userId, publishedAt: new Date() }, $inc: { revision: 1 } }, { new: true, session });
    if (!updated) throw ApiError.conflict('Batch changed');
    await Audit.create([{ adminUserId: userId, action: 'publish_import', entity: d.model.modelName, entityId: batch._id, after: { totals: batch.totals, source: batch.source, sourceUrl: batch.sourceUrl, revision } }], { session });
    return updated.toObject();
  });
}
module.exports = { create, access, validate, publish, canReview, hash, prepare, transaction };
