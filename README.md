# ¿Barcode o MRZ?

Página que identifica **en tiempo real con la cámara (sin sacar foto)** si lo que se muestra es:

- **MRZ** — zona de lectura mecánica (pasaportes, DNI/ID, visados).
- **BARCODE · EE.UU.** — licencia de conducir AAMVA de un estado de EE.UU. (PDF417).
- **BARCODE · Canadá** — licencia de conducir AAMVA de una provincia canadiense (PDF417).
- **BARCODE · Colombia** — cédula colombiana (PDF417 propietario).

Las licencias AAMVA y la cédula usan ambas PDF417, así que parecen iguales: se distinguen por el
**contenido** del código (las licencias llevan la cabecera AAMVA `@…ANSI …`; la cédula no).
Dentro de AAMVA, **EE.UU. y Canadá se separan por el IIN** (los 6 dígitos tras `ANSI `), que
identifica la jurisdicción emisora; también se muestra el estado/provincia. Si el IIN no está en
el registro AAMVA (p. ej. Territorios del Noroeste, sin IIN registrado) se etiqueta como genérico
`EE.UU./Canadá` en lugar de adivinar el país.

## Cómo ejecutarlo

Los navegadores solo dan acceso a la cámara en **contexto seguro** (https o `localhost`).
Abrir el archivo con doble clic (`file://`) **no** activa la cámara. Sírvelo en local:

```bash
cd "IV BARCODE OR MRZ"
python3 -m http.server 8000
```

Luego abre **http://localhost:8000** en el navegador.

### Probarlo desde el móvil

1. PC y móvil en la misma red Wi-Fi.
2. Averigua la IP de tu PC (p. ej. `192.168.1.50`).
3. iOS/Safari exige **https** para la cámara en IP de red. La forma más simple es publicar la
   página (GitHub Pages, Netlify, Vercel…) o usar un túnel https (p. ej. `ngrok http 8000`) y
   abrir la URL `https://…` que te dé.

Pulsa **«Iniciar cámara»**, acepta el permiso y apunta al documento dentro del recuadro.

## Cómo funciona (rápido)

- **Barcode (instantáneo):** [ZXing](https://github.com/zxing-js/library) decodifica el PDF417 en
  vivo. Si el contenido lleva la cabecera AAMVA → EE.UU./Canadá; si decodifica pero no es AAMVA →
  Colombia.
- **MRZ:** OCR ligero ([Tesseract.js](https://tesseract.projectnaptha.com/)) sobre el fotograma
  reducido; no lee el texto completo, solo reconoce la **forma** del MRZ (líneas de 30/36/44
  caracteres con relleno `<<`). El motor se precalienta al abrir para que la primera detección sea
  rápida.
- El barcode tiene prioridad sobre el OCR para no malgastar trabajo.

## Limitaciones conocidas

- La rama **barcode** es muy por debajo de 1 s. La rama **MRZ** depende del OCR: suele detectar en
  ~0,5–1 s tras el calentamiento, algo más lento en móviles modestos.
- La distinción Colombia se basa en «PDF417 que no es AAMVA», válida para los tres documentos
  contemplados. Si más adelante hay que admitir otros barcodes, conviene añadir una firma positiva
  del formato de la Registraduría.
- Requiere conexión la primera vez (carga ZXing y Tesseract por CDN).
