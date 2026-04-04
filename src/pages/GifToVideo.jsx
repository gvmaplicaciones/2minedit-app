import { useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import FeedbackButton from '../components/FeedbackButton'
import RelatedTools from '../components/RelatedTools'
import ToolSeoSection from '../components/ToolSeoSection'
import { ToolLayout, ToolHeader, ProgressBar, ResultCard, ErrorCard, PrimaryBtn, ResetBtn, btnStyle } from './CompressVideo'

const CORE_JS   = `${location.origin}/ffmpeg-core.js`
const CORE_WASM = `${location.origin}/ffmpeg-core.wasm`

function fmt(bytes) {
  if (!bytes) return '—'
  return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(0) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

export default function GifToVideo() {
  const { i18n } = useTranslation()
  const loc = useLocation()
  const isEN = i18n.language === 'en' || loc.pathname.startsWith('/en')

  const [file, setFile]               = useState(null)
  const [status, setStatus]           = useState('idle')
  const [progress, setProgress]       = useState(0)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [outputSize, setOutputSize]   = useState(null)
  const [errorMsg, setErrorMsg]       = useState('')
  const [isDragging, setIsDragging]   = useState(false)
  const ffmpegRef    = useRef(null)
  const fileInputRef = useRef(null)
  const downloadRef  = useRef(null)

  async function handleConvert() {
    if (!file) return
    setStatus('loading'); setProgress(5); setErrorMsg(''); setDownloadUrl(null); setOutputSize(null)
    try {
      const ffmpeg = new FFmpeg(); ffmpegRef.current = ffmpeg
      ffmpeg.on('progress', ({ progress: p }) => setProgress(Math.round(5 + p * 90)))
      await ffmpeg.load({ coreURL: CORE_JS, wasmURL: CORE_WASM })
      await ffmpeg.writeFile('input.gif', await fetchFile(file))
      await ffmpeg.exec(['-f', 'gif', '-i', 'input.gif', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-movflags', '+faststart', '-y', 'output.mp4'])
      const data = await ffmpeg.readFile('output.mp4')
      const blob = new Blob([data.buffer], { type: 'video/mp4' })
      setOutputSize(blob.size)
      setDownloadUrl(URL.createObjectURL(blob))
      setStatus('done'); setProgress(100)
      setTimeout(() => downloadRef.current?.click(), 200)
    } catch (err) {
      setErrorMsg(err?.message || (isEN ? 'Unknown error.' : 'Error desconocido.'))
      setStatus('error')
    }
  }

  function reset() {
    setFile(null); setStatus('idle'); setProgress(0); setDownloadUrl(null); setOutputSize(null); setErrorMsg('')
    if (ffmpegRef.current) { try { ffmpegRef.current.terminate() } catch (_) {} ffmpegRef.current = null }
  }

  const baseName = file ? file.name.replace(/\.gif$/i, '') : 'video'

  return (
    <>
      <Helmet>
        <title>{isEN ? 'Convert GIF to MP4 Video Online Free | 2minedit' : 'Convertir GIF a vídeo MP4 online gratis | 2minedit'}</title>
        <meta name="description" content={isEN ? 'Convert any animated GIF to MP4 video online for free. No signup, no install. Perfect for Instagram and TikTok.' : 'Convierte cualquier GIF animado a vídeo MP4 online gratis. Sin registrarte, sin instalar nada.'} />
        <link rel="canonical" href={isEN ? 'https://2minedit.com/en/gif-to-video' : 'https://2minedit.com/gif-to-video'} />
        <link rel="alternate" hrefLang="es" href="https://2minedit.com/gif-to-video" />
        <link rel="alternate" hrefLang="en" href="https://2minedit.com/en/gif-to-video" />
        <link rel="alternate" hrefLang="x-default" href="https://2minedit.com/gif-to-video" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": isEN ? "Convert GIF to MP4 Video Online Free | 2minedit" : "Convertir GIF a vídeo MP4 online gratis | 2minedit",
          "url": isEN ? "https://2minedit.com/en/gif-to-video" : "https://2minedit.com/gif-to-video",
          "applicationCategory": "MultimediaApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "description": isEN
            ? "Convert any animated GIF to MP4 video online for free. No signup, no install. Perfect for Instagram and TikTok."
            : "Convierte cualquier GIF animado a vídeo MP4 online gratis. Sin registrarte, sin instalar nada."
        })}</script>
      </Helmet>

      <ToolLayout isEN={isEN}>
        <ToolHeader
          h1={isEN ? 'GIF to MP4 video' : 'GIF a vídeo MP4'}
          sub={isEN ? 'Convert animated GIFs to MP4 for Instagram, TikTok and WhatsApp. Processed in your browser.'
                    : 'Convierte GIFs animados a MP4 para Instagram, TikTok y WhatsApp. Procesado en tu navegador.'}
        />

        {/* Upload zone — custom for GIF */}
        {!file ? (
          <div
            style={{ border: `2px dashed ${isDragging ? '#e87040' : '#2a2a2a'}`, backgroundColor: isDragging ? '#1f1008' : '#141414', borderRadius: 14, cursor: 'pointer', marginBottom: 20, transition: 'all 0.15s' }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f && (f.type === 'image/gif' || f.name.toLowerCase().endsWith('.gif'))) setFile(f) }}
          >
            <input ref={fileInputRef} type="file" accept=".gif,image/gif" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); e.target.value = '' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '52px 24px' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/>
              </svg>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>{isEN ? 'Upload your GIF' : 'Sube tu GIF'}</p>
              <p style={{ fontSize: 11, color: '#555' }}>.GIF</p>
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e87040" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
              <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{fmt(file.size)}</p>
            </div>
            {status === 'idle' && <button onClick={reset} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>}
          </div>
        )}

        {file && status === 'idle' && (
          <PrimaryBtn onClick={handleConvert}>{isEN ? 'Convert to MP4' : 'Convertir a MP4'}</PrimaryBtn>
        )}

        <ProgressBar status={status} progress={progress} label={isEN ? 'Converting...' : 'Convirtiendo...'} />

        {status === 'done' && (
          <ResultCard>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div><p style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>GIF</p><p style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{fmt(file.size)}</p></div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e87040" strokeWidth="1.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              <div><p style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>MP4</p><p style={{ fontSize: 15, fontWeight: 600, color: '#e87040' }}>{fmt(outputSize)}</p></div>
            </div>
            <a ref={downloadRef} href={downloadUrl} download={`${baseName}.mp4`} style={{ ...btnStyle, display: 'flex', width: '100%', justifyContent: 'center', marginBottom: 12 }}>
              ⬇ {isEN ? 'Download MP4' : 'Descargar MP4'}
            </a>
            <ResetBtn onClick={reset} label={isEN ? 'Convert another GIF' : 'Convertir otro GIF'} />
          </ResultCard>
        )}

        <ErrorCard status={status} errorMsg={errorMsg} onReset={reset} isEN={isEN} />
        <ToolSeoSection toolKey="gifToVideo" />
        <RelatedTools currentKey="gifToVideo" isEN={isEN} />
      </ToolLayout>

      <FeedbackButton />
    </>
  )
}
