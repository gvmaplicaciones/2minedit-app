const iconProps = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: '#e87040',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconVideoEditor() {
  return (
    <svg {...iconProps}>
      <path d="M6 4v16M18 4v16M4 8h4M16 8h4M4 16h4M16 16h4M8 4h8M8 20h8" />
    </svg>
  )
}

export function IconCompressVideo() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M9 10l3 2-3 2V10zM15 10l-3 2 3 2V10z" />
      <path d="M12 3v3M12 18v3" />
    </svg>
  )
}

export function IconExtractAudio() {
  return (
    <svg {...iconProps}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

export function IconVideoToGif() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M10 9l5 3-5 3V9z" />
      <path d="M2 20l4-4M22 20l-4-4" />
    </svg>
  )
}

export function IconGifToVideo() {
  return (
    <svg {...iconProps}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  )
}

export function IconCompressImages() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9l5-5M3 15l9-9M9 21l12-12M15 21l6-6" />
    </svg>
  )
}

export function IconResizeImages() {
  return (
    <svg {...iconProps}>
      <path d="M21 9V4h-5M3 15v5h5M21 4l-7 7M3 20l7-7" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

export function IconConvertWebp() {
  return (
    <svg {...iconProps}>
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z" />
      <path d="M13 2v7h7" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  )
}
