const ExcelJS = require('exceljs');
const { readSheet, template, checkZip } = require('../src/modules/admin/spreadsheet');
const { definitions, normalize } = require('../src/modules/admin/importDefinitions');

test('college Excel accepts pipe-separated images, facilities and labelled coordinates', async () => {
  const definition = definitions.colleges;
  const input = { ...definition.sample, images: 'https://example.com/one.jpg|https://example.com/two.png', facilities: 'Boys Hostel|Girls Hostel|Library', location: 'latitude=11.6500944|longitude=92.7493750' };
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('Data');
  sheet.addRow(Object.keys(input)); sheet.addRow(Object.values(input));
  const parsed = await readSheet(Buffer.from(await book.xlsx.writeBuffer()), 'colleges.xlsx', 'Data');
  expect(normalize(parsed.rows[0].input, definition.schema)).toMatchObject({ images: ['https://example.com/one.jpg', 'https://example.com/two.png'], facilities: ['Boys Hostel', 'Girls Hostel', 'Library'], location: { lat: 11.6500944, lng: 92.749375 } });
  for (const location of ['{"lat":0,"lng":-73.5}', ' longitude = -73.5 | latitude = 0 ']) expect(normalize({ ...input, location }, definition.schema).location).toEqual({ lat: 0, lng: -73.5 });
  expect(normalize({ ...input, location: '' }, definition.schema)).not.toHaveProperty('location');
  for (const location of ['latitude=11', 'latitude=|longitude=92', 'latitude=91|longitude=92', 'latitude=11|longitude=181', 'latitude=11|latitude=12|longitude=92', 'latitude=no|longitude=92', '{"lat":11,"lng":200}']) expect(() => normalize({ ...input, location }, definition.schema)).toThrow();
});

test.each(['cutoffs', 'seat-matrix'])('%s accepts exact source category codes through Excel and model validation', async (entity) => {
  const definition = definitions[entity];
  const categories = ['DEF1', 'DEF1 W', 'DEF2 W', 'DEF3', 'EMSEBC', 'EMNTD', 'EMOBC', 'EMOBCW', 'EMVJAW', 'EWS(W)', 'HEWS', 'HOBC', 'HOPEN', 'HOPENW', 'HSCW', 'HST', 'MKB W', 'NTB(W)', 'NTC(W)', 'NTD', 'OPEN (W)', 'PEM SEBC', 'SEBC(W)', 'VJA (W)', 'OBC-NCL', 'SOURCE-CUSTOM / W'];
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('Data');
  const keys = Object.keys(definition.sample); sheet.addRow(keys);
  for (const category of categories) sheet.addRow(keys.map((key) => key === 'category' ? ` ${category} ` : definition.sample[key]));
  const parsed = await readSheet(Buffer.from(await book.xlsx.writeBuffer()), 'categories.xlsx', 'Data');
  expect(parsed.rows).toHaveLength(categories.length);
  for (const [index, row] of parsed.rows.entries()) {
    const normalized = normalize(row.input, definition.schema);
    expect(normalized.category).toBe(categories[index]);
    const model = new definition.model({ ...normalized, collegeCourseId: '507f1f77bcf86cd799439012' });
    expect(model.validateSync()).toBeUndefined();
  }
  for (const category of ['', ' ', 'A'.repeat(81), 'DEF1\nW', 'DEF1\u0000W']) {
    expect(() => normalize({ ...definition.sample, category }, definition.schema)).toThrow();
    expect(new definition.model({ category }).validateSync().errors.category).toBeDefined();
  }
});
test('bond years and penalty accept N/A or blanks independently and retain numeric limits', () => {
  const definition = definitions.bonds;
  for (const value of ['N/A', ' n/a ', 'NA', null]) expect(normalize({ ...definition.sample, years: value, penaltyAmount: value }, definition.schema)).toMatchObject({ years: null, penaltyAmount: null });
  const blank = normalize({ ...definition.sample, years: '', penaltyAmount: '' }, definition.schema);
  expect(blank).not.toHaveProperty('years'); expect(blank).not.toHaveProperty('penaltyAmount');
  expect(normalize({ ...definition.sample, years: '1', penaltyAmount: 'N/A' }, definition.schema)).toMatchObject({ years: 1, penaltyAmount: null });
  expect(normalize({ ...definition.sample, years: '0', penaltyAmount: '0' }, definition.schema)).toMatchObject({ years: 0, penaltyAmount: 0 });
  for (const change of [{ years: '-1' }, { years: '51' }, { penaltyAmount: '-1' }, { penaltyAmount: '1,00,000' }, { years: 'unknown' }, { courseSlug: '' }]) expect(() => normalize({ ...definition.sample, ...change }, definition.schema)).toThrow();
});
test('fee amounts accept N/A or blanks without relaxing required identifying fields', () => {
  const definition = definitions.fees;
  for (const value of ['N/A', ' n/a ', 'NA', null]) {
    expect(normalize({ ...definition.sample, tuition: value, otherCharges: value, hostelMess: value }, definition.schema)).toMatchObject({ tuition: null, otherCharges: null, hostelMess: null });
  }
  const blank = normalize({ ...definition.sample, tuition: '', otherCharges: '', hostelMess: '' }, definition.schema);
  for (const key of ['tuition', 'otherCharges', 'hostelMess']) expect(blank).not.toHaveProperty(key);
  for (const key of ['courseSlug', 'year', 'tier']) expect(() => normalize({ ...definition.sample, [key]: '' }, definition.schema)).toThrow();
  for (const key of ['tuition', 'otherCharges', 'hostelMess']) expect(() => normalize({ ...definition.sample, [key]: 'unknown' }, definition.schema)).toThrow();
});
test('combined fee sheet preserves blank hostel amounts and accepts explicit zero', async () => {
  const definition = definitions.fees;
  const file = await template('fees', definition);
  const parsed = await readSheet(Buffer.from(file.base64, 'base64'), file.filename, 'Data');
  expect(normalize(parsed.rows[0].input, definition.schema)).toMatchObject({ tuition: 100000, otherCharges: 15000, hostelMess: 85000 });
  expect(normalize({ ...definition.sample, hostelMess: '' }, definition.schema)).not.toHaveProperty('hostelMess');
  expect(normalize({ ...definition.sample, hostelMess: '0' }, definition.schema).hostelMess).toBe(0);
  for (const amount of ['-1', '85,000', 'unknown']) expect(() => normalize({ ...definition.sample, hostelMess: amount }, definition.schema)).toThrow();
});
test.each(Object.keys(definitions))('%s template round trips through the actual Excel parser', async (entity) => {
  const file = await template(entity, definitions[entity]);
  const result = await readSheet(Buffer.from(file.base64, 'base64'), file.filename, 'Data');
  expect(result.sheets).toEqual(['Data', 'Instructions']); expect(result.rows).toHaveLength(1);
  expect(() => normalize(result.rows[0].input, definitions[entity].schema)).not.toThrow();
});
test('different worksheet headings are preserved for mapping and formulas are rejected', async () => {
  const book = new ExcelJS.Workbook(); const first = book.addWorksheet('Colleges'); first.addRow(['Institute']); first.addRow(['Sample']);
  const second = book.addWorksheet('Fees'); second.addRow(['Annual Amount']); second.addRow([99000]);
  let buffer = Buffer.from(await book.xlsx.writeBuffer());
  expect((await readSheet(buffer, 'source.xlsx', 'Fees')).rows[0].input).toEqual({ 'Annual Amount': '99000' });
  second.getCell('A2').value = { formula: '1+2', result: 3 }; buffer = Buffer.from(await book.xlsx.writeBuffer());
  await expect(readSheet(buffer, 'source.xlsx', 'Fees')).rejects.toThrow('Paste as values');
});
test('ambiguous CSV headers, oversized sheets and corrupt archives fail before persistence', async () => {
  await expect(readSheet(Buffer.from('name,name\na,b'), 'a.csv')).rejects.toThrow('unique');
  await expect(readSheet(Buffer.from('name\n' + 'A\n'.repeat(2001)), 'a.csv')).rejects.toThrow('2,000');
  expect(() => checkZip(Buffer.from('not a workbook'))).toThrow();
});

test('college-course intake accepts N/A without changing numeric validation for other fields', () => {
  const definition = definitions['college-courses'];
  for (const value of ['N/A', ' n/a ', 'NA', null]) expect(normalize({ ...definition.sample, totalSeats: value }, definition.schema).totalSeats).toBeNull();
  expect(normalize({ ...definition.sample, totalSeats: '150' }, definition.schema).totalSeats).toBe(150);
  for (const value of ['', '0', '-1', '1.5', 'unknown']) expect(() => normalize({ ...definition.sample, totalSeats: value }, definition.schema)).toThrow();
  expect(() => normalize({ ...definitions['seat-matrix'].sample, seats: 'N/A' }, definitions['seat-matrix'].schema)).toThrow();
});
