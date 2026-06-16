# Detector Barcode vs MRZ — Diseño

Fecha: 2026-06-16

## Objetivo

Página web que, en tiempo real con la cámara (sin sacar foto) y en menos de ~1 s, clasifique lo
que se le muestra en uno de tres tipos:

- **MRZ** — zona de lectura mecánica (pasaporte, ID, visado).
- **BARCODE · EE.UU./Canadá** — licencia de conducir AAMVA (PDF417).
- **BARCODE · Colombia** — cédula colombiana (PDF417 propietario).

EE.UU./Canadá y Colombia se agrupan como dos *tipos de barcode* distintos porque, aunque ambos
son PDF417 y parecen iguales, se leen de forma diferente.

## Decisiones (brainstorming)

- Entrega: **un solo `index.html`** (sin build, todo cliente).
- Dispositivo: **móvil y portátil**, con selector de cámara.
- Salida: **solo el tipo** (no se extraen los datos del documento).

## Lógica de clasificación

Dos detectores corren en paralelo sobre el vídeo en vivo:

1. **Barcode (PDF417) con ZXing** — rápido. Al decodificar:
   - Contenido con cabecera AAMVA (`@` inicial y/o `"ANSI "` + IIN) → **EE.UU./Canadá**.
     Se muestra el IIN como dato extra (factual, no se adivina el estado/provincia).
   - PDF417 que decodifica pero **no** es AAMVA → **Colombia (cédula)**.
2. **MRZ con OCR ligero (Tesseract.js)** — sobre el fotograma reducido a escala de grises.
   No lee el texto completo; reconoce la *forma*: ≥2 líneas de 24–48 caracteres compuestas casi
   solo por `[A-Z0-9<]` y con al menos un relleno `<<`.

Arbitraje: el barcode tiene prioridad; el OCR se omite mientras hay un barcode reciente.
El resultado se mantiene 1,5 s antes de volver a "buscando".

## Stack

HTML/JS puro. `@zxing/library@0.21.3` y `tesseract.js@5.1.1` por CDN (jsDelivr). Sin servidor propio.

## Restricciones

- La cámara exige contexto seguro (https o `localhost`); `file://` no sirve. Se documenta el
  arranque con `python3 -m http.server`.
- Permiso de cámara tras gesto del usuario (botón «Iniciar cámara») por compatibilidad con iOS.

## Fuera de alcance

- Extracción/validación de los datos del documento.
- Distinguir EE.UU. de Canadá como etiquetas separadas (se agrupan, según el caso de uso).
- Firma positiva del formato de la Registraduría (mejora futura si entran más barcodes).
