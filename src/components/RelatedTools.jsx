import { Link } from 'react-router-dom'

const ALL_TOOLS = [
  { key: 'compressVideo',  slugES: 'compress-video',  nameES: 'Comprimir vídeo',        nameEN: 'Compress video' },
  { key: 'extractAudio',   slugES: 'extract-audio',   nameES: 'Extraer audio',           nameEN: 'Extract audio' },
  { key: 'videoToGif',     slugES: 'video-to-gif',    nameES: 'Vídeo a GIF',             nameEN: 'Video to GIF' },
  { key: 'gifToVideo',     slugES: 'gif-to-video',    nameES: 'GIF a vídeo',             nameEN: 'GIF to video' },
  { key: 'compressImages', slugES: 'compress-images', nameES: 'Comprimir imágenes',      nameEN: 'Compress images' },
  { key: 'resizeImages',   slugES: 'resize-images',   nameES: 'Redimensionar imágenes',  nameEN: 'Resize images' },
  { key: 'convertToWebp',  slugES: 'convert-to-webp', nameES: 'Convertir a WebP',        nameEN: 'Convert to WebP' },
]

export default function RelatedTools({ currentKey, isEN }) {
  const prefix = isEN ? '/en/' : '/'
  const related = ALL_TOOLS.filter(t => t.key !== currentKey)

  return (
    <div style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid #1e1e1e' }}>
      <p style={{ fontSize: 11, color: '#444', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {isEN ? 'Other tools' : 'Otras herramientas'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {related.map(t => (
          <Link
            key={t.key}
            to={prefix + t.slugES}
            style={{
              fontSize: 12,
              color: '#666',
              textDecoration: 'none',
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid #242424',
              backgroundColor: '#141414',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#e87040'; e.currentTarget.style.color = '#e87040' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#242424'; e.currentTarget.style.color = '#666' }}
          >
            {isEN ? t.nameEN : t.nameES}
          </Link>
        ))}
      </div>
    </div>
  )
}
