/* eslint-disable no-console */
require('dotenv').config({ quiet: true });
const path = require('path');
const fs = require('fs/promises');
const mongoose = require('mongoose');
const { workbook, missingCourses, publishCatalogue } = require('../modules/courses/publishCatalogue');
const { courses } = require('../data/medicalCourses');
async function main() {
  const destination = path.resolve(__dirname, '../../../samples/catalogue/medical-courses-after-12th.xlsx');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, await workbook());
  console.log(`Exported ${courses.length} courses to samples/catalogue/medical-courses-after-12th.xlsx`);
  if (process.argv.includes('--export-only')) return;
  await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 15000 });
  try {
    const missing = await missingCourses();
    console.log(`${missing.length} new courses; ${courses.length - missing.length} existing courses will be preserved.`);
    if (!process.argv.includes('--publish')) { console.log('Preview only. Add --publish to validate and publish through the audited import workflow.'); return; }
    const role = await mongoose.model('Role').findOne({ name: 'super_admin' });
    const admins = role ? await mongoose.model('AdminUser').find({ roleId: role._id }).populate('userId') : [];
    const active = admins.filter((admin) => admin.userId?.isActive && admin.userId.role === 'admin');
    if (active.length !== 1) throw new Error('Expected one active main administrator. Use the exported workbook in the admin panel to select the correct operator.');
    console.log(JSON.stringify(await publishCatalogue(active[0].userId._id)));
  } finally { await mongoose.disconnect(); }
}
main().catch((error) => { console.error(`Course catalogue was not completed: ${error.name}. ${error.name === 'MongooseServerSelectionError' ? 'Check MongoDB connectivity.' : error.message}`); process.exitCode = 1; });
