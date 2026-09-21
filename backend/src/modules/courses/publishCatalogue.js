const ExcelJS = require('exceljs');
const Course = require('../../models/Course');
const AdminUser = require('../../models/AdminUser');
require('../../models/Role');
require('../../models/User');
const Batch = require('../../models/ImportBatch');
const workflow = require('../admin/importWorkflow.service');
const { courseSchema } = require('./courseSchema');
const { courses } = require('../../data/medicalCourses');

async function workbook(records = courses) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Courses');
  const headers = Object.keys(courseSchema.shape);
  sheet.addRow(headers);
  for (const record of records) {
    courseSchema.parse(record);
    sheet.addRow(headers.map((key) => Array.isArray(record[key]) ? record[key].join('|') : record[key] || ''));
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = 28; });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const notes = book.addWorksheet('Instructions');
  [
    'Course master for entry after Class 12 in India. Not a college, fee, seat or cutoff dataset.',
    'Upload the Courses worksheet in Admin > Data entry > Courses. Review before publishing.',
    'Keep slug stable. College-course Excel uses that exact slug in courseSlug.',
    'Aliases help discovery; they are not alternative import keys. Use the canonical slug for links.',
    'Lists use | separators. Each course carries official source URLs and the editorial review date.',
    'Duration, recognition and admission rules can change by year and institution. Check the current prospectus.',
    'No PG, Post Basic Nursing, lateral-entry-only or postgraduate Pharm.D programme is listed as direct Class 12 entry.',
  ].forEach((line) => notes.addRow([line]));
  notes.getColumn(1).width = 130;
  return Buffer.from(await book.xlsx.writeBuffer());
}
const normalized = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
async function missingCourses() {
  const existing = await Course.find().lean();
  return courses.filter((course) => !existing.some((entry) => entry.slug === course.slug ||
    [course.name, course.fullName, ...course.aliases].some((label) => [entry.name, entry.fullName].some((value) => value && normalized(value) === normalized(label)))));
}
async function publishCatalogue(userId) {
  const admin = await AdminUser.findOne({ userId }).populate('roleId').populate('userId');
  if (!admin || admin.roleId?.name !== 'super_admin' || !admin.userId?.isActive || admin.userId.role !== 'admin') throw new Error('An active main administrator is required.');
  const records = await missingCourses();
  if (!records.length) return { inserted: 0, skipped: courses.length };
  await Course.createCollection();
  await Course.collection.createIndex({ slug: 1 }, { unique: true });
  const buffer = await workbook(records);
  let batch = await workflow.create({ entity: 'courses', source: 'MedPath official-source course master, reviewed 2026-09-13',
    sourceUrl: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2306000&lang=2&reg=48',
    file: { buffer, originalname: 'medical-courses-after-12th.xlsx' }, sheet: 'Courses', userId });
  batch = await workflow.validate(batch, { revision: batch.revision, mapping: batch.mapping });
  if (batch.status !== 'ready' || batch.totals.errors || batch.totals.update) throw new Error(`Catalogue draft ${batch._id} needs review; no courses published.`);
  const submitted = await Batch.findOneAndUpdate({ _id: batch._id, revision: batch.revision, status: 'ready' }, { $set: { status: 'submitted' }, $inc: { revision: 1 } }, { new: true }).lean();
  if (!submitted) throw new Error('The draft changed; publication stopped.');
  const published = await workflow.publish(submitted, userId, submitted.revision);
  return { inserted: records.length, skipped: courses.length - records.length, batchId: String(published._id), status: published.status };
}
module.exports = { workbook, missingCourses, publishCatalogue };
