// Reads duration and generates a thumbnail from a video File
export function readVideoMeta(file) {
  return new Promise((resolve) => {
    let videoWidth = 0
    let videoHeight = 0
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = url
    video.muted = true
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'

    video.onloadedmetadata = () => {
      videoWidth  = video.videoWidth
      videoHeight = video.videoHeight
      video.currentTime = 0.1
    }

    video.onseeked = () => {
      const THUMB_H = 90
      const THUMB_W = Math.round(THUMB_H * ((videoWidth || 160) / (videoHeight || 90)))
      const canvas  = document.createElement('canvas')
      canvas.width  = THUMB_W
      canvas.height = THUMB_H
      try {
        canvas.getContext('2d').drawImage(video, 0, 0, THUMB_W, THUMB_H)
      } catch (_) {}
      const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
      const duration  = video.duration
      URL.revokeObjectURL(url)
      resolve({ duration, thumbnail, videoWidth, videoHeight })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ duration: 0, thumbnail: null, videoWidth: 0, videoHeight: 0 })
    }
  })
}

// Generates a thumbnail from an existing objectUrl at a given time offset
export function generateThumbnail(objectUrl, seekTime, videoWidth, videoHeight) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.src = objectUrl
    video.muted = true
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'
    video.onloadedmetadata = () => { video.currentTime = Math.max(0, seekTime) }
    video.onseeked = () => {
      const THUMB_H = 90
      const THUMB_W = Math.round(THUMB_H * ((videoWidth || 160) / (videoHeight || 90)))
      const canvas  = document.createElement('canvas')
      canvas.width  = THUMB_W
      canvas.height = THUMB_H
      try { canvas.getContext('2d').drawImage(video, 0, 0, THUMB_W, THUMB_H) } catch (_) {}
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    video.onerror = () => resolve(null)
  })
}
