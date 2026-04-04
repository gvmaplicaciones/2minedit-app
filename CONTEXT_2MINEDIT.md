# CONTEXT_2MINEDIT.md
> Diario de obra — estado de tareas y decisiones del proyecto 2minedit.com
> Actualizar al completar cada fase o bloque de trabajo.

---

## Estado general

**Fase actual:** Fase 1 — Herramientas de vídeo ✅ completada
**Fecha última actualización:** 2026-04-04

---

## Fase 0 — Infraestructura ✅

- [x] Proyecto Vite + React + Tailwind v4 (`@tailwindcss/vite`)
- [x] Dependencias: react-router-dom, react-helmet-async, i18next, react-i18next, i18next-browser-languagedetector
- [x] Sistema de colores: fondo `#0f0f0f`, naranja `#e87040`, bordes `#2a2a2a`
- [x] Navbar fija con logo y selector ES/EN con banderas SVG
- [x] Home con hero, grid 8 herramientas (2col/4col), sección SEO y FAQ
- [x] React Router con rutas ES y EN
- [x] React Helmet Async con meta tags, canonical, hreflang
- [x] i18n con detección por path (/ → ES, /en/ → EN)
- [x] Build de producción ✅

---

## Fase 1 — Herramientas de vídeo ✅

- [x] `@ffmpeg/ffmpeg`, `@ffmpeg/util`, `@ffmpeg/core` instalados
- [x] `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` instalados
- [x] `ffmpeg-core.js` y `ffmpeg-core.wasm` copiados a `public/`
- [x] Headers CORS en vite.config.js (`COOP: same-origin`, `COEP: require-corp`)
- [x] Utilidades copiadas: `videoMeta.js`, `EditorContext.jsx`
- [x] Hooks copiados: `useCanvas.js`, `useExport.js`
- [x] Componentes copiados y adaptados: `ExportModal.jsx`, `FeedbackButton.jsx`, `SessionWarningBar.jsx`, `TutorialModal.jsx`, `AdSlot.jsx` (placeholder)
- [x] Traducciones completas ES/EN: `landing`, `editor`, `tutorial`, `export`, `errors`
- [x] **Editor de vídeo** `/video-editor` → `VideoEditor.jsx` (landing con upload + format selector)
- [x] **Editor canvas** `/video-editor/edit` → `EditorCanvas.jsx` (editor completo, portado de 2minclip)
- [x] **Comprimir vídeo** `/compress-video` → `CompressVideo.jsx` (FFmpeg, 3 modos CRF)
- [x] **Extraer audio** `/extract-audio` → `ExtractAudio.jsx` (FFmpeg, MP3/AAC/WAV)
- [x] **Vídeo a GIF** `/video-to-gif` → `VideoToGif.jsx` (FFmpeg, palette 2-pass, start/duration/size)
- [x] **GIF a vídeo** `/gif-to-video` → `GifToVideo.jsx` (FFmpeg, GIF→MP4)
- [x] App.jsx actualizado: `EditorProvider` wrapping global, `NavbarWrapper` (oculta navbar en editor), todas las rutas reales
- [x] Build de producción ✅ sin errores

### Rutas de video editor
```
/video-editor        → VideoEditor.jsx (landing)
/video-editor/edit   → EditorCanvas.jsx (editor)
/en/video-editor     → mismo en EN
/en/video-editor/edit → mismo en EN
```

### Decisiones técnicas

- **NavbarWrapper**: La navbar global se oculta en `/video-editor` y `/video-editor/edit` porque el editor de vídeo tiene su propio layout (sin navbar fija arriba para maximizar espacio)
- **EditorProvider global**: wrappea toda la app para que el contexto persista entre VideoEditor → EditorCanvas
- **VideoEditor navega a `/video-editor/edit`**: distinto de 2minclip (que iba a `/editor`)
- **ffmpeg-core en public/**: copiado desde 2minclip, mismas versiones compatibles
- **SEO editor de vídeo**: los meta tags, H2s, FAQ y contenido SEO están en `VideoEditor.jsx`. La 301 redirect de `2minclip.com → 2minedit.com/video-editor` se configura en Vercel al hacer deploy (vercel.json)

---

## Fase 2 — Herramientas de imagen ⏳ pendiente

- [ ] Comprimir imágenes (`/compress-images`) — browser-image-compression
- [ ] Redimensionar imágenes (`/resize-images`) — Canvas API
- [ ] Convertir a WebP (`/convert-to-webp`) — Canvas API toBlob

---

## Fase 3 — SEO y pulido ⏳ pendiente

- [ ] Schema JSON-LD WebApplication por herramienta
- [ ] hreflang en todas las páginas de herramienta
- [ ] Sitemap.xml con todas las URLs ES/EN
- [ ] Enlazado interno entre herramientas relacionadas
- [ ] Google Analytics GA4
- [ ] Google Search Console

---

## Pendiente externo (deploy)

- [ ] Crear repo GitHub 2minedit
- [ ] Deploy en Vercel con dominio 2minedit.com
- [ ] Configurar `vercel.json` con 301: `2minclip.com → 2minedit.com/video-editor`
- [ ] Google Search Console verificación para 2minedit.com

---

## Estructura de archivos

```
src/
  App.jsx              — Router global + EditorProvider + NavbarWrapper
  main.jsx             — HelmetProvider + BrowserRouter + i18n
  index.css            — Tailwind + colores + .btn-primary + .pill
  EditorContext.jsx    — Contexto compartido ratio/clips entre VideoEditor↔EditorCanvas
  videoMeta.js         — readVideoMeta, generateThumbnail
  config/
    features.js        — Feature flags
  i18n/
    index.js           — Config i18next
    es.js              — Traducciones ES completas
    en.js              — Traducciones EN completas
  hooks/
    useCanvas.js       — Canvas style por ratio
    useExport.js       — FFmpeg export pipeline completo
  components/
    Navbar.jsx         — Navbar global con banderas SVG
    ToolIcons.jsx      — 8 SVG icons para home
    AdSlot.jsx         — Placeholder (ads desactivados v1)
    ExportModal.jsx    — Modal de export con progress bar
    FeedbackButton.jsx — Botón feedback fijo (Formspree)
    SessionWarningBar.jsx — Barra naranja "cierra pestaña"
    TutorialModal.jsx  — Tutorial 6 slides
  pages/
    Home.jsx               — Grid herramientas + SEO + FAQ
    VideoEditor.jsx        — Landing editor: upload + format selector + SEO
    EditorCanvas.jsx       — Editor completo (2865 líneas, portado de 2minclip)
    CompressVideo.jsx      — Comprimir vídeo con FFmpeg
    ExtractAudio.jsx       — Extraer audio (MP3/AAC/WAV)
    VideoToGif.jsx         — Vídeo a GIF (palette 2-pass)
    GifToVideo.jsx         — GIF a MP4
    ToolPlaceholder.jsx    — Placeholder "Próximamente" (image tools)
```
