import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import FeedbackButton from '../components/FeedbackButton'

const EDITOR_URL = 'https://2minclip.com'

const s = {
  page:    { minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' },
  wrap:    { maxWidth: 1100, margin: '0 auto', padding: '0 32px' },
  hero:    { paddingTop: 56, paddingBottom: 64 },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', paddingTop: 48 },
  divider: { borderTop: '1px solid #1a1a1a' },
  section: { padding: '56px 0' },
  tagline: { fontSize: 12, color: '#555', marginBottom: 10 },
  bar:     { width: 40, height: 2, backgroundColor: '#e87040', borderRadius: 2, marginBottom: 24 },
  h1:      { fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1.15, letterSpacing: '-1px', marginBottom: 16 },
  sub:     { fontSize: 15, color: '#777', lineHeight: 1.7, marginBottom: 32 },
  pills:   { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 },
  feats:   { display: 'flex', flexDirection: 'column', gap: 12 },
  feat:    { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#666' },
  check:   { color: '#e87040' },
  h2sec:   { fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 28 },
  steps:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 },
  faqGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  faqCard: { backgroundColor: '#141414', border: '1px solid #242424', borderRadius: 12, padding: '16px 20px' },
  faqQ:    { fontSize: 13, fontWeight: 600, color: '#ddd', marginBottom: 6 },
  faqA:    { fontSize: 13, color: '#666', lineHeight: 1.6 },
  whyTxt:  { fontSize: 14, color: '#666', lineHeight: 1.75, maxWidth: 640 },
}

export default function VideoEditor() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const isEN = i18n.language === 'en' || location.pathname.startsWith('/en')

  return (
    <>
      <Helmet>
        {isEN
          ? <title>Free Online Video Editor | 2minedit — No install, no signup</title>
          : <title>Editor de vídeo online gratis | 2minedit — Sin instalar, sin registrarse</title>}
        {isEN
          ? <meta name="description" content="Cut, merge and edit videos online in 2 minutes. No registration, no software. Free video editor for TikTok, Reels, YouTube." />
          : <meta name="description" content="Corta, une y edita vídeos online en 2 minutos. Sin registrarse, sin instalar nada. Editor de vídeo gratis para TikTok, Reels, YouTube." />}
        <link rel="canonical" href={isEN ? 'https://2minedit.com/en/video-editor' : 'https://2minedit.com/video-editor'} />
        <link rel="alternate" hrefLang="es" href="https://2minedit.com/video-editor" />
        <link rel="alternate" hrefLang="en" href="https://2minedit.com/en/video-editor" />
        <link rel="alternate" hrefLang="x-default" href="https://2minedit.com/video-editor" />
      </Helmet>

      <div style={s.page}>
        <main>
          {/* Hero */}
          <div style={s.wrap}>
            <div style={s.hero}>
              <div style={s.grid}>

                {/* LEFT */}
                <div>
                  <p style={s.tagline}>{t('landing.sub_tagline')}</p>
                  <div style={s.bar} />
                  <h1 style={s.h1}>{t('landing.h1')}</h1>
                  <p style={s.sub}>{t('landing.tagline')}</p>
                  <div style={s.pills}>
                    <span className="pill">{t('landing.pill_no_signup')}</span>
                    <span className="pill">{t('landing.pill_no_install')}</span>
                    <span className="pill">{t('landing.pill_free')}</span>
                  </div>
                  <div style={s.feats}>
                    {['feat1','feat2','feat3','feat4'].map(k => (
                      <div key={k} style={s.feat}><span style={s.check}>✓</span> {t(`landing.${k}`)}</div>
                    ))}
                  </div>
                </div>

                {/* RIGHT — CTA card */}
                <div style={{
                  backgroundColor: '#141414',
                  border: '1px solid #242424',
                  borderRadius: 16,
                  padding: '36px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 20,
                  textAlign: 'center',
                }}>
                  {/* Play icon */}
                  <div style={{
                    width: 72, height: 72,
                    borderRadius: '50%',
                    backgroundColor: '#1f0e04',
                    border: '1px solid #3a1a08',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <polygon points="9,6 9,22 22,14" fill="#e87040" />
                    </svg>
                  </div>

                  <div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                      {isEN ? 'Start editing now' : 'Empieza a editar ahora'}
                    </p>
                    <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                      {isEN
                        ? 'Cut, merge, add audio and export in MP4 — 100% free, no account required.'
                        : 'Corta, une, añade audio y exporta en MP4 — 100% gratis, sin cuenta.'}
                    </p>
                  </div>

                  <a
                    href={EDITOR_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '13px 24px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      backgroundColor: '#e87040',
                      color: '#000',
                      textDecoration: 'none',
                      textAlign: 'center',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    {isEN ? 'Open free editor →' : 'Abrir editor gratis →'}
                  </a>

                  <p style={{ fontSize: 11, color: '#444' }}>
                    {isEN ? 'No signup · No install · Works in browser' : 'Sin registro · Sin instalar · Funciona en el navegador'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div style={s.divider}>
            <div style={{ ...s.wrap, ...s.section }}>
              <h2 style={s.h2sec}>{t('landing.how_title')}</h2>
              <div style={s.steps}>
                <Step icon={<IconFormat />} title={t('landing.step1_title')} desc={t('landing.step1_desc')} />
                <Step icon={<IconScissors />} title={t('landing.step2_title')} desc={t('landing.step2_desc')} />
                <Step icon={<IconDownload />} title={t('landing.step3_title')} desc={t('landing.step3_desc')} />
              </div>
            </div>
          </div>

          {/* Why */}
          <div style={s.divider}>
            <div style={{ ...s.wrap, ...s.section }}>
              <h2 style={s.h2sec}>{t('landing.why_title')}</h2>
              {t('landing.why_text').split('\n\n').map((para, i) => (
                <p key={i} style={{ ...s.whyTxt, marginTop: i > 0 ? 14 : 0 }}>{para}</p>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div style={s.divider}>
            <div style={{ ...s.wrap, ...s.section }}>
              <h2 style={s.h2sec}>{t('landing.faq_title')}</h2>
              <div style={s.faqGrid}>
                {[1,2,3,4,5,6,7,8,9,10,11].map(n => (
                  <div key={n} style={s.faqCard}>
                    <p style={s.faqQ}>{t(`landing.faq_${n}_q`)}</p>
                    <p style={s.faqA}>{t(`landing.faq_${n}_a`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        <FeedbackButton />
      </div>
    </>
  )
}

function Step({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', backgroundColor: '#1c1c1c', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#ddd', marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.65 }}>{desc}</p>
      </div>
    </div>
  )
}

function IconFormat() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="4" width="6" height="10" rx="1" stroke="#e87040" strokeWidth="1.5"/><rect x="10" y="6" width="6.5" height="6" rx="1" stroke="#e87040" strokeWidth="1.5"/></svg>
}
function IconScissors() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="4.5" cy="4.5" r="2" stroke="#e87040" strokeWidth="1.4"/><circle cx="4.5" cy="13.5" r="2" stroke="#e87040" strokeWidth="1.4"/><line x1="6.2" y1="5.8" x2="15" y2="13.5" stroke="#e87040" strokeWidth="1.4" strokeLinecap="round"/><line x1="6.2" y1="12.2" x2="15" y2="4.5" stroke="#e87040" strokeWidth="1.4" strokeLinecap="round"/></svg>
}
function IconDownload() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v10" stroke="#e87040" strokeWidth="1.5" strokeLinecap="round"/><path d="M5.5 8.5L9 12l3.5-3.5" stroke="#e87040" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 14.5h13" stroke="#e87040" strokeWidth="1.5" strokeLinecap="round"/></svg>
}
