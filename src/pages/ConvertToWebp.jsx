import { useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import JSZip from 'jszip'
import FeedbackButton from '../components/FeedbackButton'
import RelatedTools from '../components/RelatedTools'
import ToolSeoSection from '../components/ToolSeoSection'
import { ToolLayout, ToolHeader, PrimaryBtn, ResetBtn, btnStyle } from './CompressVideo'

function fmt(bytes) {
  if (!bytes) return '—'
  return bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(0) + ' KB'
    : (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

async function convertToWebP(file, quality) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      canvas.toBlob((blob) => resolve(blob), 'image/webp', quality / 100)
    }
    img.src = url
  })
}

async function downloadZip(results) {
  const zip = new JSZip()
  for (const r of results) {
    const baseName = r.file.name.replace(/\.[^.]+$/, '')
    zip.file(baseName + '.webp', r.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'imagenes-webp.zip'
  a.click()
  URL.revokeObjectURL(url)
}

export default function ConvertToWebp() {
  const loc = useLocation()
  const isEN = loc.pathname.startsWith('/en')

  const [files, setFiles] = useState([])
  const [quality, setQuality] = useState(85)
  const [status, setStatus] = useState('idle') // idle | loading | done
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const title = isEN
    ? 'Convert Images to WebP Online Free | 2minedit'
    : 'Convertir imágenes a WebP online gratis | 2minedit'
  const desc = isEN
    ? 'Convert your JPG and PNG images to WebP format online for free. Reduce file size by up to 30%. No install, no signup.'
    : 'Convierte tus imágenes JPG y PNG a formato WebP online gratis. Reduce el peso hasta un 30%. Sin instalar nada, sin registrarte.'
  const canonical = isEN
    ? 'https://www.2minedit.com/en/convert-to-webp'
    : 'https://www.2minedit.com/convert-to-webp'

  function addFiles(newFiles) {
    const filtered = Array.from(newFiles).filter(f =>
      f.type === 'image/jpeg' || f.type === 'image/png'
    )
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...filtered.filter(f => !existing.has(f.name + f.size))]
    })
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  async function handleConvert() {
    if (!files.length) return
    setStatus('loading')
    setProgress(0)
    setResults([])
    const converted = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const blob = await convertToWebP(file, quality)
      converted.push({ file, blob })
      setProgress(Math.round(((i + 1) / files.length) * 100))
    }
    setResults(converted)
    setStatus('done')
  }

  function handleDownloadSingle(r) {
    const baseName = r.file.name.replace(/\.[^.]+$/, '')
    const url = URL.createObjectURL(r.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = baseName + '.webp'
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setFiles([])
    setQuality(85)
    setStatus('idle')
    setProgress(0)
    setResults([])
    setIsDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const arrowSvg = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e87040"
      strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang="es" href="https://www.2minedit.com/convert-to-webp" />
        <link rel="alternate" hrefLang="en" href="https://www.2minedit.com/en/convert-to-webp" />
        <link rel="alternate" hrefLang="x-default" href="https://www.2minedit.com/convert-to-webp" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": isEN ? "Convert Images to WebP Online Free | 2minedit" : "Convertir imágenes a WebP online gratis | 2minedit",
          "url": canonical,
          "applicationCategory": "MultimediaApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "description": isEN
            ? "Convert your JPG and PNG images to WebP format online for free. Reduce file size by up to 30%. No install, no signup."
            : "Convierte tus imágenes JPG y PNG a formato WebP online gratis. Reduce el peso hasta un 30%. Sin instalar nada, sin registrarte."
        })}</script>
      </Helmet>

      <ToolLayout isEN={isEN}>
        <ToolHeader
          h1={isEN ? 'Convert images to WebP' : 'Convertir imágenes a WebP'}
          sub={
            isEN
              ? 'Convert JPG and PNG to WebP in bulk. Reduce file size by up to 30%. No signup, processed in your browser.'
              : 'Convierte JPG y PNG a WebP en lote. Reduce el peso hasta un 30%. Sin registro, procesado en tu navegador.'
          }
        />

        {/* Upload zone — hidden once results are shown */}
        {status !== 'done' && (
          <>
            {/* Drop zone */}
            <div
              style={{
                border: `2px dashed ${isDragging ? '#e87040' : '#2a2a2a'}`,
                backgroundColor: isDragging ? '#1f1008' : '#141414',
                borderRadius: 14,
                cursor: 'pointer',
                marginBottom: 16,
                transition: 'all 0.15s',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                multiple
                style={{ display: 'none' }}
                onChange={e => { addFiles(e.target.files); e.target.value = '' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '44px 24px' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#555"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
                  {isEN ? 'Upload JPG / PNG images' : 'Sube imágenes JPG / PNG'}
                </p>
                <p style={{ fontSize: 11, color: '#555' }}>JPG, PNG</p>
              </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {files.map((f, i) => (
                  <div key={f.name + f.size + i} style={{
                    backgroundColor: '#141414',
                    border: '1px solid #1e1e1e',
                    borderRadius: 10,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e87040"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                      <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{fmt(f.size)}</p>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 20, lineHeight: 1, flexShrink: 0 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Quality slider */}
            {files.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                  {isEN ? `Quality: ${quality}%` : `Calidad: ${quality}%`}
                </p>
                <input
                  type="range"
                  min={70}
                  max={100}
                  value={quality}
                  onChange={e => setQuality(Number(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: '#e87040',
                    cursor: 'pointer',
                    height: 4,
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: '#444' }}>70%</span>
                  <span style={{ fontSize: 10, color: '#444' }}>100%</span>
                </div>
              </div>
            )}

            {/* Convert button */}
            {files.length > 0 && status === 'idle' && (
              <PrimaryBtn onClick={handleConvert}>
                {isEN ? 'Convert to WebP' : 'Convertir a WebP'}
              </PrimaryBtn>
            )}

            {/* Progress bar */}
            {status === 'loading' && (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12 }}>
                  {isEN ? 'Converting...' : 'Convirtiendo...'}
                </p>
                <div style={{ backgroundColor: '#1f1f1f', borderRadius: 99, height: 4, overflow: 'hidden' }}>
                  <div style={{
                    backgroundColor: '#e87040',
                    height: 4,
                    borderRadius: 99,
                    width: `${progress}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <p style={{ fontSize: 11, color: '#444', textAlign: 'center', marginTop: 8 }}>{progress}%</p>
              </div>
            )}
          </>
        )}

        {/* Results */}
        {status === 'done' && results.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
              {isEN
                ? `${results.length} image${results.length > 1 ? 's' : ''} converted`
                : `${results.length} imagen${results.length > 1 ? 'es' : ''} convertida${results.length > 1 ? 's' : ''}`}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {results.map((r, i) => {
                const reduction = Math.round((1 - r.blob.size / r.file.size) * 100)
                const isSmaller = reduction > 0
                return (
                  <div key={r.file.name + i} style={{
                    backgroundColor: '#141414',
                    border: '1px solid #1e1e1e',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}>
                    {/* Filename */}
                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                      <p style={{
                        fontSize: 12,
                        color: '#ccc',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>{r.file.name}</p>
                    </div>

                    {/* Sizes */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: '#777' }}>{fmt(r.file.size)}</span>
                      {arrowSvg}
                      <span style={{ fontSize: 12, color: '#e87040', fontWeight: 600 }}>{fmt(r.blob.size)}</span>
                    </div>

                    {/* Badge */}
                    {isSmaller ? (
                      <div style={{
                        backgroundColor: '#1f1008',
                        border: '1px solid #3a1a08',
                        borderRadius: 6,
                        padding: '3px 8px',
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#e87040' }}>-{reduction}%</span>
                      </div>
                    ) : (
                      <div style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #2a2a2a',
                        borderRadius: 6,
                        padding: '3px 8px',
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#666' }}>+{Math.abs(reduction)}%</span>
                      </div>
                    )}

                    {/* Download button */}
                    <button
                      onClick={() => handleDownloadSingle(r)}
                      style={{
                        ...btnStyle,
                        padding: '6px 12px',
                        fontSize: 12,
                        borderRadius: 7,
                        flexShrink: 0,
                      }}
                    >
                      ⬇ .webp
                    </button>
                  </div>
                )
              })}
            </div>

            {/* ZIP button */}
            {results.length > 1 && (
              <button
                onClick={() => downloadZip(results)}
                style={{ ...btnStyle, width: '100%', marginBottom: 12 }}
              >
                {isEN ? '⬇ Download all (ZIP)' : '⬇ Descargar todo (ZIP)'}
              </button>
            )}

            <ResetBtn
              onClick={reset}
              label={isEN ? 'Convert more images' : 'Convertir más imágenes'}
            />
          </div>
        )}
        <ToolSeoSection toolKey="convertToWebp" />
        <RelatedTools currentKey="convertToWebp" isEN={isEN} />
      </ToolLayout>

      <FeedbackButton />
    </>
  )
}
