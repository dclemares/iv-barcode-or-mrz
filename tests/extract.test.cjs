const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'extract.html'), 'utf8');

// Slice the fenced pure-parser block and expose its functions.
function loadParsers() {
  const a = html.indexOf('/* ===== FIELD PARSERS (pure) ===== */');
  const b = html.indexOf('/* ===== END FIELD PARSERS ===== */');
  assert.notEqual(a, -1, 'parser fence start missing');
  assert.notEqual(b, -1, 'parser fence end missing');
  const code = html.slice(a, b) +
    '\nreturn { parseMRZ, parseAAMVAFields, countryName, fmtMrzDate, fmtAamvaDate, emptyFields };';
  return Function(code)();
}

test('parseMRZ reads a TD3 passport', () => {
  const { parseMRZ } = loadParsers();
  const f = parseMRZ(
    'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\n' +
    'L898902C36UTO7408122F1204159ZE184226B<<<<<10'
  );
  assert.equal(f.surname, 'ERIKSSON');
  assert.equal(f.names, 'ANNA MARIA');
  assert.equal(f.number, 'L898902C3');
  assert.equal(f.nationality, 'UTO');         // unknown code → falls back to the code
  assert.equal(f.dob, '12/08/1974');
  assert.equal(f.sex, 'F');
  assert.equal(f.expiry, '15/04/2012');
  assert.equal(f.pob, '');                     // never in MRZ
  assert.equal(f.support, '');                 // never in MRZ
});

test('parseMRZ reads a TD1 id card (3 lines)', () => {
  const { parseMRZ } = loadParsers();
  const f = parseMRZ(
    'I<UTOD23145890<7<<<<<<<<<<<<<<\n' +
    '7408122F1204159UTO<<<<<<<<<<<6\n' +
    'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'
  );
  assert.equal(f.number, 'D23145890');
  assert.equal(f.dob, '12/08/1974');
  assert.equal(f.sex, 'F');
  assert.equal(f.expiry, '15/04/2012');
  assert.equal(f.nationality, 'UTO');
  assert.equal(f.surname, 'ERIKSSON');
  assert.equal(f.names, 'ANNA MARIA');
});

test('parseAAMVAFields reads a US license payload', () => {
  const { parseAAMVAFields } = loadParsers();
  const payload =
    '@\nANSI 636014090002DL00410288ZC03290015DL\n' +
    'DCAD\nDCBNONE\nDCDNONE\nDBA08312027\nDCSSMITH\nDACJANE\nDADMARIE\n' +
    'DBD08312019\nDBB07041988\nDBC2\nDAQX1234567\nDCGUSA\n';
  const f = parseAAMVAFields(payload);
  assert.equal(f.surname, 'SMITH');
  assert.equal(f.names, 'JANE MARIE');
  assert.equal(f.number, 'X1234567');
  assert.equal(f.dob, '04/07/1988');
  assert.equal(f.expiry, '31/08/2027');
  assert.equal(f.issue, '31/08/2019');
  assert.equal(f.sex, 'F');
  assert.equal(f.country, 'United States');
  assert.equal(f.pob, '');
  assert.equal(f.support, '');
  assert.equal(f.nationality, '');
});

test('parseAAMVAFields uses CCYYMMDD dates for Canada', () => {
  const { parseAAMVAFields } = loadParsers();
  const f = parseAAMVAFields('DCSDOE\nDACJOHN\nDBB19900704\nDCGCAN\n');
  assert.equal(f.dob, '04/07/1990');
  assert.equal(f.country, 'Canada');
});

test('countryName maps known codes and falls back otherwise', () => {
  const { countryName } = loadParsers();
  assert.equal(countryName('ESP'), 'Spain');
  assert.equal(countryName('D'), 'Germany');
  assert.equal(countryName('XYZ'), 'XYZ');
  assert.equal(countryName('<<<'), '');
});

test('date helpers reject malformed input', () => {
  const { fmtMrzDate, fmtAamvaDate } = loadParsers();
  assert.equal(fmtMrzDate('99XX99'), '');
  assert.equal(fmtMrzDate('741350', true), '');   // month 13 invalid
  assert.equal(fmtAamvaDate('1234', false), '');   // not 8 digits
  assert.equal(fmtAamvaDate('13012027', false), ''); // month 13 invalid
});
