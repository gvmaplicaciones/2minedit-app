import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function FlagES() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="18" height="14" rx="2" fill="#c60b1e"/>
      <rect y="3.5" width="18" height="7" fill="#ffc400"/>
    </svg>
  )
}

function FlagEN() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, flexShrink: 0 }}>
      <rect width="18" height="14" rx="2" fill="#012169"/>
      <path d="M0 0l18 14M18 0L0 14" stroke="white" strokeWidth="2.2"/>
      <path d="M0 0l18 14M18 0L0 14" stroke="#C8102E" strokeWidth="1.3"/>
      <path d="M9 0v14M0 7h18" stroke="white" strokeWidth="3.5"/>
      <path d="M9 0v14M0 7h18" stroke="#C8102E" strokeWidth="2.1"/>
    </svg>
  )
}

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const isEN = i18n.language === 'en' || location.pathname.startsWith('/en')
  const homeHref = isEN ? '/en' : '/'

  function switchLang(lang) {
    if (lang === 'en') {
      const newPath = location.pathname.startsWith('/en')
        ? location.pathname
        : '/en' + (location.pathname === '/' ? '' : location.pathname)
      i18n.changeLanguage('en')
      navigate(newPath || '/en')
    } else {
      const newPath = location.pathname.startsWith('/en')
        ? location.pathname.replace(/^\/en/, '') || '/'
        : location.pathname
      i18n.changeLanguage('es')
      navigate(newPath)
    }
  }

  return (
    <nav style={{ backgroundColor: '#0f0f0f', borderBottom: '1px solid #2a2a2a' }}
      className="fixed top-0 left-0 right-0 z-50 h-14">
      <div className="h-full flex items-center justify-between" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>

        {/* Logo */}
        <Link to={homeHref} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>
          <span style={{ color: '#fff' }}>2min</span>
          <span style={{ color: '#e87040' }}>edit</span>
        </Link>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link
            to={homeHref}
            style={{ color: '#666', textDecoration: 'none', fontSize: 13, fontWeight: 500, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.target.style.color = '#fff')}
            onMouseLeave={e => (e.target.style.color = '#666')}
          >
            {t('nav.allTools')}
          </Link>

          {/* Language selector con banderas */}
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => switchLang('es')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px',
                backgroundColor: !isEN ? '#1f1008' : 'transparent',
                color: !isEN ? '#e87040' : '#666',
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                borderRight: '1px solid #2a2a2a',
                transition: 'all 0.15s',
              }}
            >
              <FlagES />
              ES
            </button>
            <button
              onClick={() => switchLang('en')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px',
                backgroundColor: isEN ? '#1f1008' : 'transparent',
                color: isEN ? '#e87040' : '#666',
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              <FlagEN />
              EN
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
