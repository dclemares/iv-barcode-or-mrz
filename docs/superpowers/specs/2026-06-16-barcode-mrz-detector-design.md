# Barcode vs MRZ Detector — Design

Date: 2026-06-16

## Objective

A web page that, in real time with the camera (without taking a photo) and in under ~1 s,
classifies what it's shown into one of these types:

- **MRZ** — machine-readable zone (passport, ID, visa).
- **BARCODE · USA** — AAMVA driver's license from a US state (PDF417).
- **BARCODE · Canada** — AAMVA driver's license from a Canadian province (PDF417).
- **BARCODE · Colombia** — Colombian ID card (proprietary PDF417).
- **BARCODE (unreadable)** — a PDF417-like barcode band is present, but its content could not be
  decoded safely.

## Decisions (brainstorming)

- Delivery: **a single `index.html`** (no build, fully client-side).
- Device: **mobile and laptop**, with a camera selector.
- Output: **type only** (document data is not extracted).

## Classification logic

Two detectors run in parallel over the live video:

1. **Barcode (PDF417) with native BarcodeDetector, ZXing, and zxing-wasm** — fast. On decode:
   - Content with a structured AAMVA header (`ANSI` + 6-digit IIN plus the compliance indicator or
     AAMVA data elements) → license. **USA vs Canada** is separated by mapping the IIN to its
     jurisdiction via the embedded AAMVA registry; recognized Mexican IINs are shown as Mexico.
     Unregistered IIN → generic `AAMVA` (the country is not guessed).
   - A PDF417 that decodes but is **not** AAMVA → **Colombia (ID card)**.
   - A PDF417-like band in the lower Colombian ID-card position that cannot be decoded →
     a secondary layout OCR check for Colombian front-side labels. If confirmed, the result is
     **BARCODE · Colombia** with an unreadable-content detail. Other undecodable bands remain
     **BARCODE (unreadable)**. This takes priority over MRZ so barcode noise does not become a false
     MRZ. Band detection uses strict thresholds first, then relaxed low-contrast passes that still
     require a tall contiguous band.
2. **MRZ with lightweight OCR (Tesseract.js)** — over the downscaled, grayscale frame. It doesn't
   use the full text; it recognizes the *shape*: 2-3 lines close to the official 30/36/44-character
   MRZ lengths, with chevron filler. For low-quality screenshots, a single strong partial MRZ line
   can also classify as MRZ after barcode has been ruled out.

Arbitration: the barcode takes priority; OCR is skipped while a recent decoded or unreadable barcode
exists. The result stays for 1.5 s before reverting to "scanning".

Debug remains visible by default, but raw OCR and barcode payloads are not printed. The log contains
diagnostics such as payload length, control/printable counts, and detector path.

## Stack

Plain HTML/JS. `@zxing/library@0.21.3`, `zxing-wasm@1.3.5`, and `tesseract.js@5.1.1` via CDN
(jsDelivr). The MRZ traineddata URL is pinned to an upstream commit. No own server.

## Constraints

- The camera requires a secure context (https or `localhost`); `file://` won't work. Startup with
  `python3 -m http.server` is documented.
- Camera permission after a user gesture (a "Start camera" button) for iOS compatibility.

## Out of scope

- Extracting/validating the document data.
- A positive signature for the Registraduría format (future improvement if more barcodes are added).
