# Barcode or MRZ?

A page that identifies **in real time with the camera (without taking a photo)** whether what you
show it is:

- **MRZ** — machine-readable zone (passports, ID cards, visas).
- **BARCODE · USA** — AAMVA driver's license from a US state (PDF417).
- **BARCODE · Canada** — AAMVA driver's license from a Canadian province (PDF417).
- **BARCODE · Colombia** — Colombian ID card (proprietary PDF417).

AAMVA licenses and the Colombian ID card both use PDF417, so they look the same: they're told apart
by the **content** of the code (licenses carry the AAMVA header `@…ANSI …`; the ID card doesn't).
Within AAMVA, **USA and Canada are separated by the IIN** (the 6 digits after `ANSI `), which
identifies the issuing jurisdiction; the state/province is also shown. If the IIN isn't in the AAMVA
registry (e.g. Northwest Territories, which has no registered IIN) it's labeled generically as
`USA/Canada` instead of guessing the country.

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

Tap **"Start camera"**, accept the permission, and point at the document inside the frame.

## How it works (quick)

- **Barcode (instant):** [ZXing](https://github.com/zxing-js/library) decodes the PDF417 live. If
  the content carries the AAMVA header → USA/Canada (separated by IIN); if it decodes but isn't
  AAMVA → Colombia.
- **MRZ:** lightweight OCR ([Tesseract.js](https://tesseract.projectnaptha.com/)) over the
  downscaled frame; it doesn't read the full text, only recognizes the **shape** of the MRZ (lines
  of 30/36/44 characters with `<<` filler). The engine is warmed up on load so the first detection
  is fast.
- The barcode takes priority over OCR to avoid wasted work.

## Known limitations

- The **barcode** path is well under 1 s. The **MRZ** path depends on OCR: it usually detects in
  ~0.5–1 s after warm-up, somewhat slower on modest phones.
- The Colombia distinction is based on "PDF417 that is not AAMVA", valid for the three documents in
  scope. If other barcodes need to be supported later, it's worth adding a positive signature for
  the Registraduría format.
- Northwest Territories has no registered AAMVA IIN in the sources used, so such a document would
  fall under the generic `USA/Canada` label.
- Requires a connection the first time (loads ZXing and Tesseract from a CDN).
