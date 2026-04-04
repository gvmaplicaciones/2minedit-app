import { useMemo } from 'react'

const RATIO_MAP = {
  '9:16':  { w: 1080, h: 1920, css: '9 / 16' },
  '16:9':  { w: 1920, h: 1080, css: '16 / 9' },
  '1:1':   { w: 1080, h: 1080, css: '1 / 1'  },
}

/**
 * Returns canvas style props based on the selected ratio.
 * The preview wrapper always has a fixed height; the canvas fits inside
 * using max-h/max-w so no ratio ever overflows the viewport.
 */
export function useCanvas(ratio) {
  return useMemo(() => {
    const def = RATIO_MAP[ratio] ?? RATIO_MAP['9:16']
    const isLandscape = def.w > def.h

    return {
      def,
      isLandscape,
      // portrait/square: fill height, derive width from aspect-ratio
      // landscape:       fill width,  derive height from aspect-ratio
      canvasStyle: isLandscape
        ? { aspectRatio: def.css, width: '100%',  height: 'auto', maxHeight: '100%' }
        : { aspectRatio: def.css, height: '100%', width: 'auto',  maxWidth: '100%'  },
    }
  }, [ratio])
}
