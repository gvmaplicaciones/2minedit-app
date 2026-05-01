import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import {
  IconVideoEditor,
  IconCompressVideo,
  IconExtractAudio,
  IconVideoToGif,
  IconGifToVideo,
  IconCompressImages,
  IconResizeImages,
  IconConvertWebp,
} from '../components/ToolIcons'

const TOOLS = [
  { key: 'videoEditor',    Icon: IconVideoEditor,    slug: 'video-editor', external: 'https://2minclip.com' },
  { key: 'compressVideo',  Icon: IconCompressVideo,  slug: 'compress-video' },
  { key: 'extractAudio',   Icon: IconExtractAudio,   slug: 'extract-audio' },
  { key: 'videoToGif',     Icon: IconVideoToGif,     slug: 'video-to-gif' },
  { key: 'gifToVideo',     Icon: IconGifToVideo,     slug: 'gif-to-video' },
  { key: 'compressImages', Icon: IconCompressImages, slug: 'compress-images' },
  { key: 'resizeImages',   Icon: IconResizeImages,   slug: 'resize-images' },
  { key: 'convertToWebp',  Icon: IconConvertWebp,    slug: 'convert-to-webp' },
]

const cardStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '24px 22px',
  borderRadius: 14,
  backgroundColor: '#141414',
  border: '1px solid #242424',
  textDecoration: 'none',
  transition: 'border-color 0.15s, background-color 0.15s',
}
function onHoverIn(e)  { e.currentTarget.style.borderColor = '#e87040'; e.currentTarget.style.backgroundColor = '#1a1208' }
function onHoverOut(e) { e.currentTarget.style.borderColor = '#242424'; e.currentTarget.style.backgroundColor = '#141414' }

function ToolCard({ toolKey, Icon, slug, prefix, external }) {
  const { t } = useTranslation()
  const inner = (
    <>
      <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#1f0e04', border: '1px solid #3a1a08', flexShrink: 0 }}>
        <Icon />
      </div>
      <div>
        <p style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14, marginBottom: 5, lineHeight: 1.3 }}>{t(`tools.${toolKey}.name`)}</p>
        <p style={{ color: '#666', fontSize: 12.5, lineHeight: 1.5 }}>{t(`tools.${toolKey}.description`)}</p>
      </div>
    </>
  )
  if (external) return (
    <a href={external} target="_blank" rel="noopener noreferrer" style={cardStyle} onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
      {inner}
    </a>
  )
  return (
    <Link to={prefix + slug} style={cardStyle} onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
      {inner}
    </Link>
  )
}

function FaqItem({ q, a }) {
  return (
    <div style={{
      padding: '20px 24px',
      borderRadius: 12,
      border: '1px solid #242424',
      backgroundColor: '#141414',
    }}>
      <p style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{q}</p>
      <p style={{ color: '#666', fontSize: 13.5, lineHeight: 1.6 }}>{a}</p>
    </div>
  )
}

export default function Home() {
  const { t } = useTranslation()
  const location = useLocation()
  const isEN = location.pathname.startsWith('/en')
  const prefix = isEN ? '/en/' : '/'
  const faq = t('home.faq', { returnObjects: true })

  return (
    <>
      <Helmet>
        <title>{t('meta.homeTitle')}</title>
        <meta name="description" content={t('meta.homeDescription')} />
        <link rel="canonical" href={isEN ? 'https://www.2minedit.com/en' : 'https://www.2minedit.com/'} />
        <link rel="alternate" hrefLang="es" href="https://www.2minedit.com/" />
        <link rel="alternate" hrefLang="en" href="https://www.2minedit.com/en" />
        <link rel="alternate" hrefLang="x-default" href="https://www.2minedit.com/" />
      </Helmet>

      <main style={{ flex: 1, paddingTop: 56 }}>
        {/* Hero */}
        <section className="hero-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 32px 56px' }}>
          <div style={{ maxWidth: 640 }}>
            <h1 style={{
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.1,
              letterSpacing: '-1.5px',
              marginBottom: 20,
            }}>
              {t('home.h1')}
            </h1>
            <p style={{ fontSize: 17, color: '#777', lineHeight: 1.65, maxWidth: 500 }}>
              {t('home.subtitle')}
            </p>
          </div>
        </section>

        {/* Grid */}
        <section className="grid-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px 80px' }}>
          <div style={{ display: 'grid', gap: 14 }} className="tools-grid">
            {TOOLS.map(({ key, Icon, slug, external }) => (
              <ToolCard key={key} toolKey={key} Icon={Icon} slug={slug} prefix={prefix} external={external} />
            ))}
          </div>
        </section>

        {/* SEO section */}
        <section className="seo-section" style={{
          borderTop: '1px solid #1e1e1e',
          maxWidth: 1100, margin: '0 auto',
          padding: '64px 32px 80px',
        }}>
          <div style={{ maxWidth: 720 }}>
            <h2 style={{
              fontSize: 24, fontWeight: 700, color: '#fff',
              letterSpacing: '-0.5px', marginBottom: 24,
            }}>
              {t('home.seoH2')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {t('home.seoText').split('\n\n').map((para, i) => (
                <p key={i} style={{ color: '#666', fontSize: 15, lineHeight: 1.75 }}>
                  {para}
                </p>
              ))}
            </div>

            {/* FAQ */}
            <h2 style={{
              fontSize: 24, fontWeight: 700, color: '#fff',
              letterSpacing: '-0.5px', margin: '56px 0 24px',
            }}>
              {t('home.faqH2')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.isArray(faq) && faq.map((item, i) => (
                <FaqItem key={i} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
