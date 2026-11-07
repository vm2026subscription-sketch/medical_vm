const ExcelJS = require('exceljs');
const ApiError = require('../../utils/ApiError');
const College = require('../../models/College');
const Course = require('../../models/Course');
const CollegeCourse = require('../../models/CollegeCourse');
const CutOff = require('../../models/CutOff');
const Fee = require('../../models/Fee');
const HostelFee = require('../../models/HostelFee');
const BondDetail = require('../../models/BondDetail');
const SeatMatrix = require('../../models/SeatMatrix');

const MAX_ROWS = 50000;
const unknown = (value) => value == null ? 'N/A' : value;
const list = (value) => Array.isArray(value) ? value.join('|') : value || '';
const linked = (record) => ({
  collegeCode: record.collegeCourseId?.collegeId?.collegeCode || '',
  courseSlug: record.collegeCourseId?.courseId?.slug || '',
});
const catalog = {
  colleges: { permission: 'colleges:write', label: 'Colleges' },
  courses: { permission: 'collegecourses:import', label: 'Courses' },
  'college-courses': { permission: 'collegecourses:import', label: 'College courses' },
  cutoffs: { permission: 'cutoffs:import', label: 'Cutoffs' },
  fees: { permission: 'fees:import', label: 'Fees' },
  'hostel-fees': { permission: 'fees:import', label: 'Hostel fees' },
  bonds: { permission: 'fees:import', label: 'Service bonds' },
  'seat-matrix': { permission: 'seatmatrix:import', label: 'Seat matrix' },
};

async function limit(model, query = {}) {
  const total = await model.countDocuments(query);
  if (total > MAX_ROWS) throw ApiError.badRequest(`This export has ${total.toLocaleString('en-IN')} rows. Filter or split it before exporting (maximum ${MAX_ROWS.toLocaleString('en-IN')} rows).`);
}

async function exportRows(entity) {
  if (!catalog[entity]) throw ApiError.notFound('Unknown catalog data type');
  if (entity === 'colleges') {
    await limit(College);
    const records = await College.find().sort({ name: 1, _id: 1 }).lean();
    return { columns: ['collegeCode', 'name', 'city', 'state', 'ownership', 'affiliation', 'nmcApproved', 'facilities', 'images', 'location', 'isActive'], rows: records.map((record) => [record.collegeCode, record.name, record.city, record.state, record.ownership, record.affiliation || '', Boolean(record.nmcApproved), list(record.facilities), list(record.images), record.location ? `latitude=${record.location.lat}|longitude=${record.location.lng}` : '', Boolean(record.isActive)]) };
  }
  if (entity === 'courses') {
    await limit(Course);
    const records = await Course.find().sort({ name: 1, _id: 1 }).lean();
    return { columns: ['name', 'slug', 'fullName', 'duration', 'description', 'eligibility', 'careerPath', 'discipline', 'level', 'admissionRoute', 'admissionNotes', 'aliases', 'sourceUrls', 'reviewedOn'], rows: records.map((record) => [record.name, record.slug, record.fullName || '', record.duration || '', record.description || '', list(record.eligibility), list(record.careerPath), record.discipline || '', record.level || '', record.admissionRoute || '', record.admissionNotes || '', list(record.aliases), list(record.sourceUrls), record.reviewedOn ? new Date(record.reviewedOn).toISOString().slice(0, 10) : '']) };
  }
  if (entity === 'college-courses') {
    await limit(CollegeCourse);
    const records = await CollegeCourse.find().populate('collegeId', 'collegeCode').populate('courseId', 'slug').sort({ _id: 1 }).lean();
    return { columns: ['collegeCode', 'courseSlug', 'totalSeats'], rows: records.map((record) => [record.collegeId?.collegeCode || '', record.courseId?.slug || '', unknown(record.totalSeats)]) };
  }
  const model = { cutoffs: CutOff, fees: Fee, 'hostel-fees': HostelFee, bonds: BondDetail, 'seat-matrix': SeatMatrix }[entity];
  await limit(model);
  if (entity === 'hostel-fees') {
    const records = await HostelFee.find().populate('collegeId', 'collegeCode').sort({ year: -1, _id: 1 }).lean();
    return { columns: ['collegeCode', 'year', 'amount'], rows: records.map((record) => [record.collegeId?.collegeCode || '', record.year, unknown(record.amount)]) };
  }
  const records = await model.find().populate({ path: 'collegeCourseId', populate: [{ path: 'collegeId', select: 'collegeCode' }, { path: 'courseId', select: 'slug' }] }).sort({ year: -1, _id: 1 }).lean();
  if (entity === 'cutoffs') return { columns: ['collegeCode', 'courseSlug', 'category', 'quota', 'authority', 'year', 'round', 'closingRank', 'closingScore', 'seats'], rows: records.map((record) => { const base = linked(record); return [base.collegeCode, base.courseSlug, record.category, record.quota, record.authority, record.year, record.round, record.closingRank, unknown(record.closingScore), unknown(record.seats)]; }) };
  if (entity === 'seat-matrix') return { columns: ['collegeCode', 'courseSlug', 'authority', 'category', 'quota', 'round', 'year', 'seats'], rows: records.map((record) => { const base = linked(record); return [base.collegeCode, base.courseSlug, record.authority, record.category, record.quota, record.round, record.year, record.seats]; }) };
  if (entity === 'bonds') return { columns: ['collegeCode', 'courseSlug', 'years', 'penaltyAmount', 'applicableStates'], rows: records.map((record) => { const base = linked(record); return [base.collegeCode, base.courseSlug, unknown(record.years), unknown(record.penaltyAmount), list(record.applicableStates)]; }) };

  const collegeIds = [...new Set(records.map((record) => String(record.collegeCourseId?.collegeId?._id)).filter(Boolean))];
  const hostels = await HostelFee.find({ collegeId: { $in: collegeIds } }).lean();
  const hostelByCollegeYear = new Map(hostels.map((record) => [`${record.collegeId}:${record.year}`, record.amount]));
  return { columns: ['collegeCode', 'courseSlug', 'year', 'tier', 'tuition', 'otherCharges', 'hostelMess', 'sourceTag'], rows: records.map((record) => { const base = linked(record); return [base.collegeCode, base.courseSlug, record.year, record.tier, unknown(record.tuition), unknown(record.otherCharges), unknown(hostelByCollegeYear.get(`${record.collegeCourseId?.collegeId?._id}:${record.year}`)), record.sourceTag || '']; }) };
}

async function createWorkbook(entity) {
  const { columns, rows } = await exportRows(entity);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MedPath by Vidyarthi Mitra';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(catalog[entity].label.slice(0, 31));
  sheet.addRow(columns);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const row of rows) sheet.addRow(row);
  sheet.columns.forEach((column) => { column.width = Math.min(42, Math.max(14, String(column.header || '').length + 2)); });
  return workbook.xlsx.writeBuffer();
}

module.exports = { catalog, createWorkbook };
