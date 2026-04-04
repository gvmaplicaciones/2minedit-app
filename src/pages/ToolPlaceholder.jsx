import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'

export default function ToolPlaceholder({ titleES, titleEN, descES, descEN }) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const isEN = i18n.language === 'en' || location.pathname.startsWith('/en')

  const title = isEN ? titleEN : titleES
  const desc = isEN ? descEN : descES

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
      </Helmet>

      <main style={{
        flex: 1, paddingTop: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 420 }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            backgroundColor: '#1f0e04',
            border: '1px solid #3a1a08',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e87040" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 10, letterSpacing: '-0.5px' }}>
            {t('placeholder.comingSoon')}
          </h1>
          <p style={{ color: '#666', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
            {t('placeholder.comingSoonText')}
          </p>
          <Link
            to={isEN ? '/en' : '/'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 22px',
              borderRadius: 8,
              backgroundColor: '#e87040',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 14, fontWeight: 600,
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#d4622e')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#e87040')}
          >
            ← {t('placeholder.backHome')}
          </Link>
        </div>
      </main>
    </>
  )
}
