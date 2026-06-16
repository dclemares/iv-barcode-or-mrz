const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function section(start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a);
  assert.notEqual(a, -1, `Missing start marker: ${start}`);
  assert.notEqual(b, -1, `Missing end marker: ${end}`);
  return html.slice(a, b);
}

function loadClassifier() {
  const code = [
    section('function isAAMVA', '// IIN'),
    section('const AAMVA_ISSUERS', 'function handleBarcode'),
    section('function handleBarcode', '// Recognizes'),
    section('function looksLikeMRZ', '/* ───────────────────── UI'),
    `
      const performance = { now: () => 123 };
      let lastBarcodeAt = 0;
      const calls = [];
      function setResult(cls, text, sub) { calls.push({ cls, text, sub }); }
      return { isAAMVA, handleBarcode, looksLikeMRZ, looksLikeColombianIdBarcodeBand, colombianIdLabelScore, calls };
    `
  ].join('\n');

  return Function(code)();
}

test('AAMVA classification requires a structured ANSI/IIN payload', () => {
  const classifier = loadClassifier();
  const classify = (text) => {
    classifier.calls.length = 0;
    classifier.handleBarcode(text);
    return classifier.calls[0];
  };

  assert.equal(classifier.isAAMVA('@COLOMBIA_BINARY_PAYLOAD_WITHOUT_ANSI'), false);
  assert.equal(classifier.isAAMVA('THIS IS NOT A LICENSE BUT HAS ANSI 636014 TEXT'), false);
  assert.equal(classify('@COLOMBIA_BINARY_PAYLOAD_WITHOUT_ANSI').text, 'BARCODE · Colombia');
  assert.equal(classify('THIS IS NOT A LICENSE BUT HAS ANSI 636014 TEXT').text, 'BARCODE · Colombia');

  assert.equal(
    classify('@\n\u001e\rANSI 636014080002DLDAQD1234567\n').text,
    'BARCODE · USA'
  );
});

test('MRZ matcher requires MRZ-length lines with chevron fillers', () => {
  const { looksLikeMRZ } = loadClassifier();

  assert.equal(
    looksLikeMRZ('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10'),
    true
  );
  assert.equal(looksLikeMRZ('noise <<<<< noise'), false);
  assert.equal(looksLikeMRZ('AAAAAAAAAAAAAAAAAAAAAAAAAA\nBBBBBBBBBBBBBBBBBBBBBBBBBB'), false);
  assert.equal(looksLikeMRZ('11111111111111111111111111\n22222222222222222222222222'), false);
});

test('MRZ matcher tolerates OCR line length drift and strong partial MRZ lines', () => {
  const { looksLikeMRZ } = loadClassifier();

  assert.equal(
    looksLikeMRZ('P<INDGAMBHIR<<AKHIL<<<<<<<<<<<<<<<<<<<<<<<<<<\nZ6362205<1IND8011130M31061544075397278421<70'),
    true
  );
  assert.equal(looksLikeMRZ('P<IRL<<<<<<12345'), true);
  assert.equal(looksLikeMRZ('noise <<<<< noise'), false);
});

test('barcode band detector has relaxed fallback passes for low-contrast PDF417', () => {
  assert.match(html, /BARCODE_BAND_PASSES/);
  assert.match(html, /delta:\s*18/);
  assert.match(html, /delta:\s*12/);
});

test('bottom PDF417 bands on Colombian ID fronts can be labeled Colombia when unreadable', () => {
  const { looksLikeColombianIdBarcodeBand } = loadClassifier();

  assert.equal(looksLikeColombianIdBarcodeBand(481, 297, { y0: 194, y1: 264 }), true);
  assert.equal(looksLikeColombianIdBarcodeBand(809, 493, { y0: 327, y1: 445 }), true);
  assert.equal(looksLikeColombianIdBarcodeBand(960, 723, { y0: 436, y1: 469 }), true);
  assert.equal(looksLikeColombianIdBarcodeBand(960, 723, { y0: 90, y1: 160 }), false);
});

test('Colombian ID fallback requires Spanish front-side labels, not license-back text', () => {
  const { colombianIdLabelScore } = loadClassifier();

  assert.ok(colombianIdLabelScore('FECHA DE NACIMIENTO LUGAR DE NACIMIENTO ESTATURA G.S RH SEXO') >= 3);
  assert.ok(colombianIdLabelScore('INDICE DERECHO REGISTRADOR NACIONAL FECHA LUGAR') >= 3);
  assert.equal(colombianIdLabelScore('CLASS RESTRICTIONS CONDITIONS AUTORISATIONS END NONE TEXAS ROADSIDE ASSISTANCE'), 0);
});

test('debug logging keeps diagnostics but does not print raw OCR or barcode payloads', () => {
  assert.doesNotMatch(html, /dbg\('\[MRZ OCR[\s\S]*?data\.text/);
  assert.doesNotMatch(html, /dbg\('Barcode DECODED:[\s\S]*?text\.replace/);
  assert.doesNotMatch(html, /dbg\('DECODED from crop:[\s\S]*?text\.replace/);
});

test('photo analysis checks for a barcode band before OCR can classify MRZ', () => {
  const start = html.indexOf('async function analyzeSource');
  const end = html.indexOf('async function capturePhoto', start);
  assert.notEqual(start, -1, 'Missing analyzeSource');
  assert.notEqual(end, -1, 'Missing analyzeSource end marker');
  const analyze = html.slice(start, end);

  const bandIdx = analyze.indexOf('findBarcodeBand');
  const mrzIdx = analyze.indexOf('detectMRZ');
  assert.notEqual(bandIdx, -1, 'analyzeSource should check findBarcodeBand');
  assert.notEqual(mrzIdx, -1, 'analyzeSource should check detectMRZ');
  assert.ok(bandIdx < mrzIdx, 'the barcode band must be checked before MRZ');
  assert.match(html, /function handleUnreadableBarcode/);
});

test('an undecodable barcode band falls through to MRZ before declaring it unreadable', () => {
  const start = html.indexOf('async function analyzeSource');
  const end = html.indexOf('async function capturePhoto', start);
  assert.notEqual(start, -1, 'Missing analyzeSource');
  assert.notEqual(end, -1, 'Missing analyzeSource end marker');
  const analyze = html.slice(start, end);
  // A document MRZ (dense, full-width OCR-B text) also forms a high-edge band, so an undecodable
  // band may be an MRZ — detectMRZ must be tried before handleUnreadableBarcode.
  const mrzIdx = analyze.indexOf('detectMRZ');
  const unreadableIdx = analyze.indexOf('handleUnreadableBarcode');
  assert.notEqual(mrzIdx, -1, 'analyzeSource should call detectMRZ');
  assert.notEqual(unreadableIdx, -1, 'analyzeSource should call handleUnreadableBarcode');
  assert.ok(mrzIdx < unreadableIdx, 'detectMRZ must be attempted before declaring an unreadable barcode');
});

test('the camera is preview-only — no continuous live scanning loops', () => {
  assert.doesNotMatch(html, /setInterval\(liveTick/);
  assert.doesNotMatch(html, /setInterval\(ocrTick/);
  assert.doesNotMatch(html, /decodeFromVideoDevice/);
  assert.match(html, /function capturePhoto/);
  assert.match(html, /function startPreview/);
});

test('remote MRZ model is pinned instead of loading the moving master branch', () => {
  assert.doesNotMatch(html, /tesseractMRZ@master/);
});
