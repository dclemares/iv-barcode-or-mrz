# Barcode vs MRZ Detector — Design

Date: 2026-06-16

## Objective

A web page that, in real time with the camera (without taking a photo) and in under ~1 s,
classifies what it's shown into one of these types:

- **MRZ** — machine-readable zone (passport, ID, visa).
- **BARCODE · USA** — AAMVA driver's license from a US state (PDF417).
- **BARCODE · Canada** — AAMVA driver's license from a Canadian province (PDF417).
- **BARCODE · Colombia** — Colombian ID card (proprietary PDF417).

## Decisions (brainstorming)

- Delivery: **a single `index.html`** (no build, fully client-side).
- Device: **mobile and laptop**, with a camera selector.
- Output: **type only** (document data is not extracted).

## Classification logic

Two detectors run in parallel over the live video:

1. **Barcode (PDF417) with ZXing** — fast. On decode:
   - Content with an AAMVA header (`@` start and/or `"ANSI "` + IIN) → license. **USA vs Canada** is
     separated by mapping the IIN (6 digits after `ANSI `) to its jurisdiction via the embedded AAMVA
     registry; the state/province is shown. Unregistered IIN → generic `USA/Canada` (the country is
     not guessed).
   - A PDF417 that decodes but is **not** AAMVA → **Colombia (ID card)**.
2. **MRZ with lightweight OCR (Tesseract.js)** — over the downscaled, grayscale frame. It doesn't
   read the full text; it recognizes the *shape*: ≥2 lines of 24–48 characters made up almost only
   of `[A-Z0-9<]` and with at least one `<<` filler.

Arbitration: the barcode takes priority; OCR is skipped while a recent barcode exists. The result
stays for 1.5 s before reverting to "scanning".

## Stack

Plain HTML/JS. `@zxing/library@0.21.3` and `tesseract.js@5.1.1` via CDN (jsDelivr). No own server.

## Constraints

- The camera requires a secure context (https or `localhost`); `file://` won't work. Startup with
  `python3 -m http.server` is documented.
- Camera permission after a user gesture (a "Start camera" button) for iOS compatibility.

## Out of scope

- Extracting/validating the document data.
- A positive signature for the Registraduría format (future improvement if more barcodes are added).
