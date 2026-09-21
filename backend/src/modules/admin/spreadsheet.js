const ExcelJS = require('exceljs');
const { parse } = require('csv-parse/sync');
const { inflateRawSync } = require('node:zlib');
const ApiError = require('../../utils/ApiError');
const MAX_ROWS = 2000;
// Inspect the ZIP central directory before asking ExcelJS to inflate an XLSX.
function checkZip(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('Invalid XLSX archive');
  const count = buffer.readUInt16LE(end + 10);
  let pos = buffer.readUInt32LE(end + 16), expanded = 0;
  if (count > 1000 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error('Workbook archive is too complex');
  for (let n = 0; n < count; n++) {
    if (pos + 46 > end || buffer.readUInt32LE(pos) !== 0x02014b50) throw new Error('Invalid XLSX directory');
    if (buffer.readUInt16LE(pos + 8) & 1) throw new Error('Encrypted workbooks are not supported');
    expanded += buffer.readUInt32LE(pos + 24);
    if (expanded > 32 * 1024 * 1024) throw new Error('Expanded workbook exceeds 32 MB. Split the file.');
    const declaredSize = buffer.readUInt32LE(pos + 24), compressedSize = buffer.readUInt32LE(pos + 20);
    const offset = buffer.readUInt32LE(pos + 42), method = buffer.readUInt16LE(pos + 10);
    if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid XLSX entry');
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    if (start + compressedSize > buffer.length) throw new Error('Truncated XLSX entry');
    // Do not trust the declared size: cap actual decompression before ExcelJS sees the archive.
    const compressed = buffer.subarray(start, start + compressedSize);
    const actual = method === 0 ? compressed.length : method === 8 ? inflateRawSync(compressed, { maxOutputLength: Math.max(1, declaredSize + 1) }).length : -1;
    if (actual !== declaredSize) throw new Error('Invalid XLSX entry size or compression');
    pos += 46 + buffer.readUInt16LE(pos + 28) + buffer.readUInt16LE(pos + 30) + buffer.readUInt16LE(pos + 32);
  }
}
function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) throw new Error('Formula cells are not accepted. Paste as values first.');
    if ('error' in value) throw new Error('Spreadsheet contains an error cell');
    return value.richText ? value.richText.map((r) => r.text).join('') : String(value.text || '');
  }
  return String(value).trim();
}
async function readSheet(buffer, filename, selected) {
  try {
    if (buffer.length > 10 * 1024 * 1024) throw new Error('Maximum file size is 10 MB');
    let matrix, sheets, sheet;
    if (/\.csv$/i.test(filename)) {
      matrix = parse(buffer, { bom: true, skip_empty_lines: true, trim: true, max_record_size: 64000 });
      sheets = ['Data']; sheet = 'Data';
    } else if (/\.xlsx$/i.test(filename)) {
      checkZip(buffer);
      const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
      sheets = book.worksheets.map((s) => s.name);
      if (sheets.length > 20) throw new Error('Maximum 20 worksheets');
      const ws = selected ? book.getWorksheet(selected) : book.worksheets[0];
      if (!ws) throw new Error('Worksheet not found');
      sheet = ws.name;
      if (ws.rowCount > MAX_ROWS + 1 || ws.columnCount > 80) throw new Error('Maximum 2,000 rows and 80 columns per sheet. Split larger sheets.');
      matrix = [];
      for (let n = 1; n <= ws.rowCount; n++) matrix.push(Array.from({ length: ws.columnCount }, (_, i) => cellText(ws.getRow(n).getCell(i + 1).value)));
    } else throw new Error('Upload .xlsx or .csv (convert older .xls files first)');
    const headers = (matrix.shift() || []).map((h) => String(h).trim());
    if (!headers.length || headers.length > 80 || headers.some((h) => !h || h.length > 150 || ['__proto__', 'constructor', 'prototype'].includes(h)) || new Set(headers).size !== headers.length) throw new Error('First row must contain unique, non-empty column headings (maximum 80)');
    const rows = matrix.map((values, i) => ({ row: i + 2, input: Object.fromEntries(headers.map((h, j) => [h, String(values[j] ?? '').trim()])) })).filter((r) => Object.values(r.input).some(Boolean));
    if (!rows.length || rows.length > MAX_ROWS) throw new Error('Use 1 to 2,000 data rows per sheet');
    if (rows.some((r) => JSON.stringify(r.input).length > 64000 || Object.values(r.input).some((v) => v.length > 10000))) throw new Error('Cell or row is too large');
    return { headers, rows, sheets, sheet };
  } catch (e) { throw ApiError.badRequest(`Spreadsheet: ${e.message}`); }
}
async function template(entity, definition) {
  const book = new ExcelJS.Workbook(); const ws = book.addWorksheet('Data');
  const headers = Object.keys(definition.schema.shape);
  ws.addRow(headers); ws.addRow(headers.map((key) => definition.sample[key] || ''));
  ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.columns.forEach((c) => { c.width = 24; c.numFmt = '@'; });
  const help = book.addWorksheet('Instructions');
  if (entity === 'colleges') help.addRow(['images: separate HTTPS image URLs with | (up to 20). facilities: separate names with |, e.g. Boys Hostel|Girls Hostel|Library. location: latitude=11.6500944|longitude=92.7493750; JSON with lat and lng is also supported. Latitude: -90 to 90; longitude: -180 to 180. Leave unknown optional fields blank.']);
  if (['cutoffs', 'seat-matrix'].includes(entity)) help.addRow(['category accepts the exact official source code (1–80 characters), e.g. DEF1, DEF1 W, DEF2 W, EWS(W), OPEN (W), EMOBC, HOPEN, MKB W, NTB(W), NTC(W), SEBC or VJA (W). Other source codes are also accepted. Preserve spelling, internal spaces and brackets; do not combine categories. Published codes appear in website filters.']);
  if (entity === 'bonds') {
    help.addRow(['years and penaltyAmount each accept a number or N/A. A blank value means unknown (N/A) for a new bond, and preserves the saved value on updates. Use explicit N/A to mark a previously entered value unavailable. Enter 0 only for confirmed no service obligation / zero penalty.']);
    help.addRow(['Examples: years=1, penaltyAmount=1000000; years=N/A, penaltyAmount=N/A; years=1, penaltyAmount=N/A. Years and penalty can be known independently. Keep collegeCode and courseSlug filled.']);
  }
  if (entity === 'fees') {
    help.addRow(['One fees sheet: tuition, otherCharges, hostelMess. Each amount accepts a number or N/A. Blank cells mean unknown (N/A) on new entries and preserve saved amounts on updates. Explicit N/A marks a previously entered amount unavailable. 0 means confirmed zero charges.']);
    help.addRow(['hostelMess is annual combined hostel + mess in INR, shared by all courses and fee tiers of the same college/year. Exclude it from otherCharges to avoid double-counting. Use the same hostel value across those rows, or fill it once and leave other rows blank.']);
    help.addRow(['Unknown-fee example: collegeCode=COL-DEMO-001, courseSlug=mbbs, year=2026, tier=merit, tuition=N/A, otherCharges=(blank), hostelMess=N/A. The identifying fields are still required.']);
  }
  if (entity === 'hostel-fees') help.addRow(['amount accepts a number or N/A. Blank means N/A for a new record; on updates it preserves the saved amount. Enter 0 only for confirmed zero charges.']);
  if (entity === 'college-courses') help.addRow(['totalSeats: enter a positive whole number (e.g. 150), or N/A when intake information is unavailable. N/A is stored as unknown, never as zero. A later numeric upload updates the same college-course link.']);
  [ 'SAMPLE ONLY: replace demo values before uploading. Do not publish demonstration records.', 'Upload order: Courses, Colleges, College-course links, then Fees / Seat matrix / Cutoffs.', 'College code is permanent. Existing colleges can also be referenced by their 24-character database ID.', 'Year / authority / quota / category / round must describe the actual source. Never guess missing values.', 'Amounts are INR; tuition is annual. Numbers: no commas or currency symbols. Lists: separate items with |.', 'Blank optional cells preserve existing values on updates. They do not clear existing data.', 'First row: headings. Maximum 2,000 data rows per sheet, 10 MB file. Paste formulas as values.', 'Upload is a private draft. Validate, submit, and publish after review. Unmapped columns are ignored.' ].forEach((line) => help.addRow([line]));
  help.getColumn(1).width = 130;
  return { filename: `${entity}-sample.xlsx`, base64: Buffer.from(await book.xlsx.writeBuffer()).toString('base64'), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}
module.exports = { readSheet, checkZip, template };
