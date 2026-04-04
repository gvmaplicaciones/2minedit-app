import { useTranslation } from 'react-i18next'

export default function ToolSeoSection({ toolKey }) {
  const { t } = useTranslation()
  const faq = t(`seo.${toolKey}.faq`, { returnObjects: true })
  const body = t(`seo.${toolKey}.body`)

  return (
    <div style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid #1e1e1e' }}>
      {/* H2 + body */}
      <h2 style={{
        fontSize: 18,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '-0.3px',
        marginBottom: 16,
      }}>
        {t(`seo.${toolKey}.h2`)}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {body.split('\n\n').map((para, i) => (
          <p key={i} style={{ fontSize: 14, color: '#666', lineHeight: 1.75 }}>{para}</p>
        ))}
      </div>

      {/* FAQ */}
      <h2 style={{
        fontSize: 18,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '-0.3px',
        marginBottom: 16,
      }}>
        {t(`seo.${toolKey}.faqH2`)}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.isArray(faq) && faq.map((item, i) => (
          <div key={i} style={{
            padding: '14px 18px',
            borderRadius: 10,
            border: '1px solid #1e1e1e',
            backgroundColor: '#141414',
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#ddd', marginBottom: 5 }}>{item.q}</p>
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
