const siteUrl = (process.env.APP_URL || 'https://medical-vm.vercel.app').replace(/\/+$/, '');

module.exports = Object.freeze({
  name: 'MedPath',
  company: 'Vidyarthi Mitra',
  fullName: 'MedPath by Vidyarthi Mitra',
  siteUrl,
});
