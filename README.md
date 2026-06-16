# Barcode or MRZ?

A page that identifies — by **capturing a photo with the camera** (or uploading an image) — whether
what you show it is:

- **MRZ** — machine-readable zone (passports, ID cards, visas).
- **BARCODE · USA** — AAMVA driver's license from a US state (PDF417).
- **BARCODE · Canada** — AAMVA driver's license from a Canadian province (PDF417).
- **BARCODE · Colombia** — Colombian ID card (proprietary PDF417).

AAMVA licenses and the Colombian ID card both use PDF417, so they look the same: they're told apart
by the **content** of the code (licenses carry a structured AAMVA `ANSI` + IIN header; the ID card
doesn't). Within AAMVA, **USA and Canada are separated by the IIN** (the 6 digits after `ANSI `),
which identifies the issuing jurisdiction; the state/province is also shown. A couple of Mexican
AAMVA IINs are recognized too. If the IIN isn't in the embedded registry, it's labeled generically
as `AAMVA` instead of guessing the country.

## How to run it

Browsers only grant camera access in a **secure context** (https or `localhost`). Opening the file
by double-clicking (`file://`) will **not** enable the camera. Serve it locally:

```bash
cd "IV BARCODE OR MRZ"
python3 -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

### Testing it on your phone

1. PC and phone on the same Wi-Fi network.
2. Find your PC's IP (e.g. `192.168.1.50`).
3. iOS/Safari requires **https** for the camera over a network IP. The simplest options are to
   publish the page (GitHub Pages, Netlify, Vercel…) or use an https tunnel (e.g. `ngrok http 8000`)
   and open the `https://…` URL it gives you.

It's also already deployed via GitHub Pages: **https://dclemares.github.io/iv-barcode-or-mrz/**

Tap **"Start camera"**, accept the permission, frame the document inside the box, and tap
**📷 Capture**. The camera is a live preview only; analysis runs on the captured still (you can
also **Upload image** instead). On Android/Chrome the still is taken at full resolution via
`ImageCapture.takePhoto()`; elsewhere it falls back to the current preview frame.

## How it works (quick)

- **Barcode (instant):** the page tries the browser's native `BarcodeDetector` first (on
  Chrome/macOS & Android it's OS-backed and handles dense/low-quality PDF417 well), then falls back
  to [ZXing](https://github.com/zxing-js/library) and `zxing-wasm`. On the captured photo (or an
  uploaded image) it also looks for a dense PDF417-like band before OCR can claim MRZ, with relaxed
  fallback passes for low-contrast or blurred barcodes. If the content carries a structured AAMVA header →
  USA/Canada/Mexico where the IIN is known; if it decodes but isn't AAMVA → Colombia. If a
  PDF417-like barcode is clearly present in the lower Colombian ID-card position but can't be
  decoded, the page runs a secondary layout OCR check for Colombian front-side labels before
  reporting `BARCODE · Colombia` with an unreadable-content detail. Other unreadable PDF417 bands
  stay as `BARCODE (unreadable)`.
- **MRZ:** lightweight OCR ([Tesseract.js](https://tesseract.projectnaptha.com/)) over the
  downscaled frame; it doesn't use the full text, only recognizes the **shape** of the MRZ: 2-3
  official-length lines (30/36/44 characters) with chevron filler, or a strong partial MRZ line in
  low-quality screenshots. The MRZ model is pinned to a specific upstream commit so the behavior
  doesn't change unexpectedly.
- The barcode takes priority over OCR to avoid wasted work.
- The debug log stays visible by default. It records diagnostics such as payload length and detector
  path, but it does not print raw OCR or barcode payload text.

## Known limitations

- The **barcode** path is well under 1 s. The **MRZ** path depends on OCR: it usually detects in
  ~0.5–1 s after warm-up, somewhat slower on modest phones.
- The Colombia distinction is based on "PDF417 that is not AAMVA", valid for the three documents in
  scope. If other barcodes need to be supported later, it's worth adding a positive signature for
  the Registraduría format.
- Northwest Territories has no registered AAMVA IIN in the sources used, so such a document would
  fall under the generic `AAMVA` label.
- Requires a connection the first time (loads ZXing and Tesseract from a CDN).
