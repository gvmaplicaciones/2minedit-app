import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import CompressVideo from './pages/CompressVideo'
import ExtractAudio from './pages/ExtractAudio'
import VideoToGif from './pages/VideoToGif'
import GifToVideo from './pages/GifToVideo'
import CompressImages from './pages/CompressImages'
import ResizeImages from './pages/ResizeImages'
import ConvertToWebp from './pages/ConvertToWebp'

function LanguageSync() {
  const location = useLocation()
  const { i18n } = useTranslation()
  useEffect(() => {
    const isEN = location.pathname.startsWith('/en')
    if (isEN && i18n.language !== 'en') i18n.changeLanguage('en')
    if (!isEN && i18n.language !== 'es') i18n.changeLanguage('es')
  }, [location.pathname, i18n])
  return null
}

export default function App() {
  return (
    <>
      <LanguageSync />
      <Navbar />
      <Routes>
        {/* Home */}
        <Route path="/"   element={<Home />} />
        <Route path="/en" element={<Home />} />

        {/* Video tools — ES */}
        <Route path="/compress-video" element={<CompressVideo />} />
        <Route path="/extract-audio"  element={<ExtractAudio />} />
        <Route path="/video-to-gif"   element={<VideoToGif />} />
        <Route path="/gif-to-video"   element={<GifToVideo />} />

        {/* Video tools — EN */}
        <Route path="/en/compress-video" element={<CompressVideo />} />
        <Route path="/en/extract-audio"  element={<ExtractAudio />} />
        <Route path="/en/video-to-gif"   element={<VideoToGif />} />
        <Route path="/en/gif-to-video"   element={<GifToVideo />} />

        {/* Image tools — ES */}
        <Route path="/compress-images"  element={<CompressImages />} />
        <Route path="/resize-images"    element={<ResizeImages />} />
        <Route path="/convert-to-webp"  element={<ConvertToWebp />} />

        {/* Image tools — EN */}
        <Route path="/en/compress-images"  element={<CompressImages />} />
        <Route path="/en/resize-images"    element={<ResizeImages />} />
        <Route path="/en/convert-to-webp"  element={<ConvertToWebp />} />
      </Routes>
    </>
  )
}
