import { useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import imageCompression from 'browser-image-compression'
import JSZip from 'jszip'
import FeedbackButton from '../components/FeedbackButton'
import RelatedTools from '../components/RelatedTools'
import ToolSeoSection from '../components/ToolSeoSection'
import { ToolLayout, ToolHeader, PrimaryBtn, ResetBtn, btnStyle, ResultCard } from './CompressVideo'

function fmt(bytes) {
  if (!bytes && bytes !== 0) return '—'
  return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(0) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

async function downloadZip(results) {
  const zip = new JSZip()
  for (const r of results) {
    const ext = r.file.name.split('.').pop()
    zip.file(r.file.name.replace(/\.[^.]+$/, '') + '_compressed.' + ext, r.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'imagenes-comprimidas.zip'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CompressImages() {
  const loc = useLocation()
  const isEN = loc.pathname.startsWith('/en')

  const [files, setFiles]           = useState([])
  const [quality, setQuality]       = useState(80)
  const [status, setStatus]         = useState('idle')
  const [progress, setProgress]     = useState(0)
  const [results, setResults]       = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef                = useRef(null)

  const title = isEN
    ? 'Compress Images Online Free | 2minedit — No install'
    : 'Comprimir imágenes online gratis | 2minedit — Sin instalar'

  const desc = isEN
    ? 'Compress your images online for free without losing quality. Upload multiple at once, reduce JPG, PNG and WebP file size. No signup.'
    : 'Comprime tus imágenes online gratis sin perder calidad. Sube varias a la vez, reduce el peso de JPG, PNG y WebP. Sin registrarte.'

  function addFiles(newFiles) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    const filtered = Array.from(newFiles).filter(f => allowed.includes(f.type))
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      const fresh = filtered.filter(f => !existing.has(f.name + f.size))
      return [...prev, ...fresh]
    })
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleCompress() {
    if (!files.length) return
    setStatus('loading')
    setProgress(0)
    setResults([])

    const total = files.length
    const newResults = []

    for (let i = 0; i < total; i++) {
      const file = files[i]
      const options = {
        maxSizeMB: Infinity,
        initialQuality: quality / 100,
        useWebWorker: true,
        fileType: file.type,
      }
      const compressed = await imageCompression(file, options)
      newResults.push({ file, blob: compressed, compressedSize: compressed.size })
      setProgress(Math.round(((i + 1) / total) * 100))
    }

    setResults(newResults)
    setStatus('done')
  }

  function reset() {
    setFiles([])
    setQuality(80)
    setStatus('idle')
    setProgress(0)
    setResults([])
  }

  function downloadSingle(r) {
    const ext = r.file.name.split('.').pop()
    const name = r.file.name.replace(/\.[^.]+$/, '') + '_compressed.' + ext
    const url = URL.createObjectURL(r.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={isEN ? 'https://www.2minedit.com/en/compress-images' : 'https://www.2minedit.com/compress-images'} />
        <link rel="alternate" hrefLang="es" href="https://www.2minedit.com/compress-images" />
        <link rel="alternate" hrefLang="en" href="https://www.2minedit.com/en/compress-images" />
        <link rel="alternate" hrefLang="x-default" href="https://www.2minedit.com/compress-images" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": isEN ? "Compress Images Online Free | 2minedit" : "Comprimir imágenes online gratis | 2minedit",
          "url": isEN ? "https://www.2minedit.com/en/compress-images" : "https://www.2minedit.com/compress-images",
          "applicationCategory": "MultimediaApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "description": isEN
            ? "Compress your images online for free without losing quality. Upload multiple at once, reduce JPG, PNG and WebP file size. No signup."
            : "Comprime tus imágenes online gratis sin perder calidad. Sube varias a la vez, reduce el peso de JPG, PNG y WebP. Sin registrarte."
        })}</script>
      </Helmet>

      <ToolLayout isEN={isEN}>
        <ToolHeader
          h1={isEN ? 'Compress images online' : 'Comprimir imágenes online'}
          sub={
            isEN
              ? 'Reduce your image file sizes in bulk. No signup, processed in your browser.'
              : 'Reduce el peso de tus imágenes en lote. Sin registro, procesado en tu navegador.'
          }
        />

        {/* Upload zone */}
        {status !== 'done' && (
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
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              multiple
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files.length) addFiles(e.target.files); e.target.value = '' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '44px 24px' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
              </svg>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
                {isEN ? 'Upload images' : 'Sube tus imágenes'}
              </p>
              <p style={{ fontSize: 11, color: '#555' }}>JPG, PNG, WebP</p>
              {files.length > 0 && (
                <p style={{ fontSize: 12, color: '#e87040', fontWeight: 600 }}>
                  {files.length} {isEN ? 'file(s) selected — click to add more' : 'archivo(s) seleccionado(s) — haz clic para añadir más'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && status === 'idle' && (
          <div style={{ marginBottom: 20 }}>
            {files.map((f, i) => (
              <div
                key={f.name + f.size + i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  backgroundColor: '#141414', border: '1px solid #2a2a2a',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e87040" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                  <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{fmt(f.size)}</p>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quality slider */}
        {files.length > 0 && status === 'idle' && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: '#888' }}>
                {isEN ? 'Quality:' : 'Calidad:'} <span style={{ color: '#e87040', fontWeight: 700 }}>{quality}%</span>
              </p>
              <p style={{ fontSize: 11, color: '#555' }}>
                {isEN ? 'Lower = smaller file' : 'Menor = archivo más pequeño'}
              </p>
            </div>
            <input
              type="range"
              min={50}
              max={95}
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
              <span style={{ fontSize: 10, color: '#444' }}>50%</span>
              <span style={{ fontSize: 10, color: '#444' }}>95%</span>
            </div>
          </div>
        )}

        {/* Compress button */}
        {files.length > 0 && status === 'idle' && (
          <PrimaryBtn onClick={handleCompress}>
            {isEN ? 'Compress all' : 'Comprimir todas'}
          </PrimaryBtn>
        )}

        {/* Progress bar */}
        {status === 'loading' && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12 }}>
              {isEN ? 'Compressing...' : 'Comprimiendo...'}
            </p>
            <div style={{ backgroundColor: '#1f1f1f', borderRadius: 99, height: 4, overflow: 'hidden' }}>
              <div
                style={{
                  backgroundColor: '#e87040', height: 4, borderRadius: 99,
                  width: `${progress}%`, transition: 'width 0.3s',
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: '#444', textAlign: 'center', marginTop: 8 }}>{progress}%</p>
          </div>
        )}

        {/* Results */}
        {status === 'done' && results.length > 0 && (
          <ResultCard>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
              {isEN ? `${results.length} image(s) compressed` : `${results.length} imagen(es) comprimida(s)`}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {results.map((r, i) => {
                const savings = Math.round((1 - r.compressedSize / r.file.size) * 100)
                return (
                  <div
                    key={r.file.name + i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      backgroundColor: '#1a1a1a', border: '1px solid #242424',
                      borderRadius: 10, padding: '12px 14px',
                    }}
                  >
                    {/* Filename */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                        {r.file.name}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#666' }}>{fmt(r.file.size)}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e87040" strokeWidth="2" strokeLinecap="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                        <span style={{ fontSize: 11, color: '#e87040', fontWeight: 600 }}>{fmt(r.compressedSize)}</span>
                      </div>
                    </div>

                    {/* Savings badge */}
                    {savings > 0 && (
                      <div style={{
                        backgroundColor: '#1f1008', border: '1px solid #3a1a08',
                        borderRadius: 6, padding: '3px 8px', flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 11, color: '#e87040', fontWeight: 700 }}>−{savings}%</span>
                      </div>
                    )}

                    {/* Individual download */}
                    <button
                      onClick={() => downloadSingle(r)}
                      style={{
                        ...btnStyle,
                        padding: '7px 14px',
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      ⬇
                    </button>
                  </div>
                )
              })}
            </div>

            {/* ZIP download */}
            {results.length > 1 && (
              <button
                onClick={() => downloadZip(results)}
                style={{ ...btnStyle, width: '100%', marginBottom: 12 }}
              >
                ⬇ {isEN ? 'Download all (ZIP)' : 'Descargar todo (ZIP)'}
              </button>
            )}

            <ResetBtn
              onClick={reset}
              label={isEN ? 'Compress more images' : 'Comprimir más imágenes'}
            />
          </ResultCard>
        )}
        <ToolSeoSection toolKey="compressImages" />
        <RelatedTools currentKey="compressImages" isEN={isEN} />
      </ToolLayout>

      <FeedbackButton />
    </>
  )
}
