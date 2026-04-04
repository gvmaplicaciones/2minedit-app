import { useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import JSZip from 'jszip'
import FeedbackButton from '../components/FeedbackButton'
import RelatedTools from '../components/RelatedTools'
import { ToolLayout, ToolHeader, PrimaryBtn, ResetBtn, btnStyle } from './CompressVideo'

const PRESETS = [
  { label: 'Custom',             w: null, h: null },
  { label: 'Instagram post',     w: 1080, h: 1080 },
  { label: 'Instagram story',    w: 1080, h: 1920 },
  { label: 'TikTok',             w: 1080, h: 1920 },
  { label: 'YouTube thumbnail',  w: 1280, h: 720  },
  { label: 'Twitter header',     w: 1500, h: 500  },
]

async function resizeFile(file, targetWidth, targetHeight) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = targetWidth
      const h = targetHeight
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      const ext = file.name.split('.').pop().toLowerCase()
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
      canvas.toBlob((blob) => resolve(blob), mimeType, 0.92)
    }
    img.src = url
  })
}

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = url
  })
}

export default function ResizeImages() {
  const { i18n } = useTranslation()
  const loc = useLocation()
  const isEN = i18n.language === 'en' || loc.pathname.startsWith('/en')

  const [files, setFiles]               = useState([])
  const [isDragging, setIsDragging]     = useState(false)
  const [presetIndex, setPresetIndex]   = useState(0)
  const [customW, setCustomW]           = useState(800)
  const [customH, setCustomH]           = useState(600)
  const [maintainRatio, setMaintainRatio] = useState(true)
  const [status, setStatus]             = useState('idle')
  const [progress, setProgress]         = useState(0)
  const [results, setResults]           = useState([])
  const [errorMsg, setErrorMsg]         = useState('')
  const fileInputRef = useRef(null)

  const preset = PRESETS[presetIndex]
  const isCustom = presetIndex === 0

  const targetW = isCustom ? customW : preset.w
  const targetH = isCustom ? customH : preset.h

  function handleFiles(incoming) {
    const valid = Array.from(incoming).filter(f =>
      /\.(jpe?g|png|webp)$/i.test(f.name)
    )
    if (valid.length) setFiles(prev => [...prev, ...valid])
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleChange(e) {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  function handlePreset(idx) {
    setPresetIndex(idx)
    if (idx !== 0) {
      setCustomW(PRESETS[idx].w)
      setCustomH(PRESETS[idx].h)
    }
  }

  function handleWidthChange(val) {
    const w = parseInt(val) || 0
    setCustomW(w)
    if (maintainRatio && files.length === 1) {
      // We'll calculate per-file at resize time; for display use first file ratio if available
      // Just store width; height will be recalculated per file during processing
    }
    // If not maintaining ratio, keep customH as-is
  }

  function handleHeightChange(val) {
    const h = parseInt(val) || 0
    setCustomH(h)
  }

  async function handleResize() {
    if (!files.length) return
    setStatus('loading')
    setProgress(0)
    setErrorMsg('')
    setResults([])

    try {
      const out = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const origDims = await getImageDimensions(file)
        let w = targetW
        let h = targetH

        if (maintainRatio && isCustom) {
          // When custom + maintainRatio: use customW as the reference, calculate h per file
          w = customW
          h = Math.round(customW * (origDims.h / origDims.w))
        } else {
          w = targetW
          h = targetH
        }

        const blob = await resizeFile(file, w, h)
        const ext = file.name.split('.').pop().toLowerCase()
        const baseName = file.name.replace(/\.[^.]+$/, '')
        const outName = `${baseName}_resized.${ext}`
        const url = URL.createObjectURL(blob)

        out.push({
          origName: file.name,
          outName,
          origW: origDims.w,
          origH: origDims.h,
          newW: w,
          newH: h,
          blob,
          url,
          ext,
        })

        setProgress(Math.round(((i + 1) / files.length) * 100))
      }
      setResults(out)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err?.message || (isEN ? 'Unknown error.' : 'Error desconocido.'))
      setStatus('error')
    }
  }

  async function handleDownloadAll() {
    const zip = new JSZip()
    for (const r of results) {
      const arrayBuf = await r.blob.arrayBuffer()
      zip.file(r.outName, arrayBuf)
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(zipBlob)
    a.download = 'imagenes_redimensionadas.zip'
    a.click()
  }

  function reset() {
    setFiles([])
    setStatus('idle')
    setProgress(0)
    setResults([])
    setErrorMsg('')
    setPresetIndex(0)
    setCustomW(800)
    setCustomH(600)
    setMaintainRatio(true)
  }

  const title = isEN
    ? 'Resize Images Online Free | 2minedit'
    : 'Redimensionar imágenes online gratis | 2minedit'
  const desc = isEN
    ? 'Resize your images online for free. Resize multiple at once for Instagram, TikTok, YouTube. No install, no signup required.'
    : 'Cambia el tamaño de tus imágenes online gratis. Redimensiona varias a la vez para Instagram, TikTok, YouTube. Sin instalar nada.'

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={isEN ? 'https://2minedit.com/en/resize-images' : 'https://2minedit.com/resize-images'} />
        <link rel="alternate" hrefLang="es" href="https://2minedit.com/resize-images" />
        <link rel="alternate" hrefLang="en" href="https://2minedit.com/en/resize-images" />
        <link rel="alternate" hrefLang="x-default" href="https://2minedit.com/resize-images" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": isEN ? "Resize Images Online Free | 2minedit" : "Redimensionar imágenes online gratis | 2minedit",
          "url": isEN ? "https://2minedit.com/en/resize-images" : "https://2minedit.com/resize-images",
          "applicationCategory": "MultimediaApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "description": isEN
            ? "Resize your images online for free. Resize multiple at once for Instagram, TikTok, YouTube. No install, no signup required."
            : "Cambia el tamaño de tus imágenes online gratis. Redimensiona varias a la vez para Instagram, TikTok, YouTube. Sin instalar nada."
        })}</script>
      </Helmet>

      <ToolLayout isEN={isEN}>
        <ToolHeader
          h1={isEN ? 'Resize images online' : 'Redimensionar imágenes online'}
          sub={
            isEN
              ? 'Bulk resize your photos. Presets for Instagram, TikTok and YouTube. No signup.'
              : 'Cambia el tamaño de tus fotos en lote. Presets para Instagram, TikTok y YouTube. Sin registro.'
          }
        />

        {/* ── Upload zone ── */}
        <div
          style={{
            border: `2px dashed ${isDragging ? '#e87040' : '#2a2a2a'}`,
            backgroundColor: isDragging ? '#1f1008' : '#141414',
            borderRadius: 14,
            cursor: 'pointer',
            marginBottom: 20,
            transition: 'all 0.15s',
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={handleChange}
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '44px 24px' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
              {isEN ? 'Upload images (click or drag & drop)' : 'Sube imágenes (clic o arrastra aquí)'}
            </p>
            <p style={{ fontSize: 11, color: '#555' }}>JPG, PNG, WebP</p>
          </div>
        </div>

        {/* ── File list ── */}
        {files.length > 0 && status === 'idle' && (
          <div style={{ marginBottom: 20 }}>
            {files.map((f, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: '#141414',
                  border: '1px solid #2a2a2a',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e87040" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <p style={{ flex: 1, fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </p>
                <p style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>
                  {(f.size / 1024).toFixed(0)} KB
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Presets row ── */}
        {status === 'idle' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>
                {isEN ? 'Preset' : 'Preset'}
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  paddingBottom: 4,
                  scrollbarWidth: 'none',
                }}
              >
                {PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePreset(idx)}
                    style={{
                      flexShrink: 0,
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: presetIndex === idx ? '#e87040' : '#2a2a2a',
                      backgroundColor: presetIndex === idx ? '#1f1008' : '#141414',
                      color: presetIndex === idx ? '#e87040' : '#666',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.label}
                    {p.w ? ` ${p.w}×${p.h}` : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Dimensions inputs ── */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>
                {isEN ? 'Dimensions' : 'Dimensiones'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6 }}>
                    {isEN ? 'Width' : 'Ancho'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={isCustom ? customW : preset.w}
                      disabled={!isCustom}
                      onChange={(e) => handleWidthChange(e.target.value)}
                      style={{
                        flex: 1,
                        backgroundColor: isCustom ? '#1a1a1a' : '#111',
                        border: '1px solid #2a2a2a',
                        borderRadius: 8,
                        color: isCustom ? '#fff' : '#555',
                        fontSize: 14,
                        fontWeight: 600,
                        padding: '10px 12px',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: 12, color: '#555', flexShrink: 0 }}>px</span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6 }}>
                    {isEN ? 'Height' : 'Alto'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={isCustom ? (maintainRatio ? customH : customH) : preset.h}
                      disabled={!isCustom || maintainRatio}
                      onChange={(e) => handleHeightChange(e.target.value)}
                      style={{
                        flex: 1,
                        backgroundColor: (!isCustom || maintainRatio) ? '#111' : '#1a1a1a',
                        border: '1px solid #2a2a2a',
                        borderRadius: 8,
                        color: (!isCustom || maintainRatio) ? '#555' : '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        padding: '10px 12px',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: 12, color: '#555', flexShrink: 0 }}>px</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Maintain aspect ratio ── */}
            <div style={{ marginBottom: 28 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: isCustom ? 'pointer' : 'default',
                  opacity: isCustom ? 1 : 0.4,
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={maintainRatio}
                  disabled={!isCustom}
                  onChange={(e) => setMaintainRatio(e.target.checked)}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: '#e87040',
                    cursor: isCustom ? 'pointer' : 'default',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, color: '#aaa' }}>
                  {isEN
                    ? 'Maintain aspect ratio (height auto-calculated per image)'
                    : 'Mantener relación de aspecto (alto calculado por imagen)'}
                </span>
              </label>
            </div>

            {/* ── Resize button ── */}
            <PrimaryBtn onClick={handleResize} disabled={files.length === 0}>
              {isEN ? `Resize all (${files.length})` : `Redimensionar todas (${files.length})`}
            </PrimaryBtn>
          </>
        )}

        {/* ── Progress bar ── */}
        {status === 'loading' && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12 }}>
              {isEN ? 'Resizing...' : 'Redimensionando...'}
            </p>
            <div style={{ backgroundColor: '#1f1f1f', borderRadius: 99, height: 4, overflow: 'hidden' }}>
              <div
                style={{
                  backgroundColor: '#e87040',
                  height: 4,
                  borderRadius: 99,
                  width: `${progress}%`,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: '#444', textAlign: 'center', marginTop: 8 }}>{progress}%</p>
          </div>
        )}

        {/* ── Results ── */}
        {status === 'done' && results.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
              {isEN
                ? `${results.length} image${results.length !== 1 ? 's' : ''} resized`
                : `${results.length} imagen${results.length !== 1 ? 'es' : ''} redimensionada${results.length !== 1 ? 's' : ''}`}
            </p>

            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: '#141414',
                  border: '1px solid #242424',
                  borderRadius: 12,
                  padding: '14px 16px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                    {r.origName}
                  </p>
                  <p style={{ fontSize: 11, color: '#555' }}>
                    {r.origW}×{r.origH}px
                    <span style={{ margin: '0 6px', color: '#333' }}>→</span>
                    <span style={{ color: '#e87040', fontWeight: 600 }}>{r.newW}×{r.newH}px</span>
                  </p>
                </div>
                <a
                  href={r.url}
                  download={r.outName}
                  style={{
                    ...btnStyle,
                    padding: '8px 16px',
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  ⬇ {isEN ? 'Download' : 'Descargar'}
                </a>
              </div>
            ))}

            {/* ── ZIP + Reset ── */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.length > 1 && (
                <button
                  onClick={handleDownloadAll}
                  style={{
                    ...btnStyle,
                    width: '100%',
                    backgroundColor: '#1f1008',
                    color: '#e87040',
                    border: '1px solid #e87040',
                  }}
                >
                  ⬇ {isEN ? 'Download all (ZIP)' : 'Descargar todo (ZIP)'}
                </button>
              )}
              <ResetBtn
                onClick={reset}
                label={isEN ? 'Resize other images' : 'Redimensionar otras imágenes'}
              />
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div style={{ marginTop: 24, backgroundColor: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 12, padding: 20 }}>
            <p style={{ color: '#e87040', fontSize: 13, marginBottom: 16 }}>{errorMsg}</p>
            <button onClick={reset} style={btnStyle}>{isEN ? 'Try again' : 'Reintentar'}</button>
          </div>
        )}
        <RelatedTools currentKey="resizeImages" isEN={isEN} />
      </ToolLayout>

      <FeedbackButton />
    </>
  )
}
