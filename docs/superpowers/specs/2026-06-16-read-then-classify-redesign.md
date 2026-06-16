# Redesign: locate → read → self-classify (Option A)

Date: 2026-06-16

## Why

The classifier separated MRZ / PDF417 / cédula with two weak, overlapping signals: a generic
"high-edge band" (can't tell a PDF417 from MRZ text) and OCR-text shape heuristics (chevron counts,
line lengths) that collapse on real phone photos. Six versions of threshold-tuning became whack-a-mole.

Root flaw: **we classify before we read.** We guess the type from fragile cues instead of reading
the content and letting it prove what it is.

## Principle

Flip the flow: **decode/read first; let the content self-classify; if illegible, ask for a better
photo instead of guessing.**

- A payload that **decodes as PDF417** → barcode (AAMVA → US/CA/MX; non-AAMVA → Colombia).
- An OCR'd region whose **MRZ check digits validate** → MRZ (+ extracted fields).
- Neither → "move closer / better light" (quality feedback), never a guessed result.

## Cornerstone: MRZ check-digit validation (this change)

ICAO MRZ lines carry check digits (weights 7-3-1; char values 0-9, A-Z=10-35, `<`=0) over the
document number, date of birth, expiry, optional data, and a composite. Random barcode-OCR noise
satisfies ~0 of them; a real MRZ satisfies all (or all-but-one under a single OCR error).

- `mrzCheck(str)` → check digit; `digitOk(field, d)` → field validates against its check digit.
- `validateMRZ(text)`: over the OCR'd lines, for each candidate line try TD3/TD2/TD1 field layouts
  with a small **offset search** (tolerates leading junk / length drift). Count passing check
  digits. **Confirmed MRZ when ≥2 independent checks pass** (robust to one OCR error; rejects noise,
  whose chance of passing two independent checks is ~1/100). Returns `{ valid, format, fields }`.
- This **replaces the chevron/shape `looksLikeMRZ` gate** for the MRZ decision. Detection becomes
  lenient (try many line groupings) but confirmation is strict (check digits).

## Detection flow (analyzeSource)

1. Decode barcode (full image + band crop, all decoders). Decodes → classify by content. Done.
2. No decode → OCR the bottom strip(s), upscaled + binarized (OCR-B model). `validateMRZ` on the
   text. Valid → **MRZ** (+ fields). Done.
3. Not a valid MRZ but a dense 2D band is present → Colombian layout? → BARCODE · Colombia, else
   BARCODE (unreadable).
4. Nothing → "No document detected / move closer".

Because step 2 is gated on check digits, the low-res Colombian cédula (barcode-OCR noise) no longer
false-matches as MRZ — it has no valid check digits and falls to step 3.

## Tests

`validateMRZ` is pure and unit-tested with real ICAO check-digit examples (TD3 passport line, with
and without leading junk → valid; barcode-noise / random text → invalid).

## Out of scope (later, if needed)

- Row-projection MRZ-line localization for cleaner OCR (improves read rate further).
- Structural 2D-barcode-vs-text discrimination.
- Capture-quality live guidance (Option B).
