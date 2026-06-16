# Document Field Extraction — Design (local-only `extract.html`)

Date: 2026-06-16

## Objective

A **local-only** variant of the capture-and-analyze app that, in addition to classifying the
document type, **extracts and displays the document's data** in this fixed field list (empty when a
value can't be read):

Country · Date of birth · Place of birth · Date of issue · Expiration date · Names · Surname ·
Nationality · Number · Support number · Sex

## Decisions (brainstorming)

- **Deliverable:** a separate file `extract.html`. `index.html` stays untouched. **Not pushed** —
  the GitHub Pages deployment remains the plain classifier (v24).
- **Data source:** structured payloads only — the **MRZ** (TD1/TD2/TD3) and the **AAMVA** license
  barcode. **No front-side OCR.** Consequently, *Place of birth* and *Support number* are always
  empty, and *Date of issue* is empty for MRZ documents (it is filled for AAMVA via DBD).
- The Colombian cédula PDF417 is binary/proprietary → type is shown, all fields empty.

## Architecture

Clone of `index.html` (same capture/upload + `analyzeSource` pipeline) plus:

1. **Pure parsers** (unit-tested, fenced so the test can slice them):
   - `parseMRZ(text)` → field object. Groups cleaned OCR lines by length family (30/36/44) and
     slices fields positionally per ICAO TD1/TD2/TD3. Invalid dates/fields → empty (best-effort
     against OCR noise).
   - `parseAAMVAFields(text)` → field object. Reads AAMVA data elements: DCS (surname),
     DAC+DAD (names), DAQ (number), DBB (DOB), DBA (expiry), DBD (issue), DBC (sex), DCG (country).
     Date format chosen by country (US `MMDDCCYY`, Canada `CCYYMMDD`).
   - Helpers: `countryName` (ISO-3 → name, common set, fallback to the code; `D` → Germany),
     `fmtMrzDate` (YYMMDD → DD/MM/YYYY, future 2-digit birth year ⇒ 19xx), `fmtAamvaDate`,
     `sexLetter`/`sexFromCode`.

2. **Field mapping**

   | Field | MRZ | AAMVA |
   |---|---|---|
   | Country | issuing state code→name | DCG / IIN jurisdiction |
   | Date of birth | ✅ | DBB |
   | Place of birth | empty | empty |
   | Date of issue | empty | DBD |
   | Expiration date | ✅ | DBA |
   | Names | given names | DAC + DAD |
   | Surname | ✅ | DCS |
   | Nationality | code→name | empty |
   | Number | document number | DAQ |
   | Support number | empty | empty |
   | Sex | ✅ | DBC (1=M,2=F) |

3. **UI:** a `#fields` panel between the stage and the controls. After analysis it lists all 11
   labels with their values (empty value rendered blank). The type banner stays. Panel hidden in
   the live preview / start screen; shown in image mode. `renderFields(f)` / `hideFields()`.

4. **Wiring:** `detectMRZ` returns the matched MRZ **text** (instead of a boolean) so
   `analyzeSource` can `renderFields(parseMRZ(text))`. `handleBarcode` renders
   `parseAAMVAFields(text)` for AAMVA and empty fields for Colombia. Unreadable / not-detected
   render empty fields.

## Testing

`tests/extract.test.cjs` slices the fenced parser block from `extract.html` and asserts:
- TD3 passport and TD1 ID samples parse surname/names/number/nationality/DOB/sex/expiry.
- An AAMVA sample parses surname/names/number/DOB/expiry/issue/sex/country.
- `countryName` falls back to the raw code for unknown codes.

## Out of scope

- Front-side OCR (Place of birth, Support number, MRZ date-of-issue stay empty).
- Parsing the Colombian cédula binary PDF417.
- Any deployment / push.
