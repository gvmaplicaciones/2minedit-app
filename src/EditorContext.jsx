import { createContext, useContext, useState, useCallback } from 'react'

const EditorContext = createContext(null)

export function EditorProvider({ children }) {
  const [ratio, setRatio] = useState(null) // '9:16' | '16:9' | '1:1'
  const [clips, setClips] = useState([])

  const addClip = useCallback((clip) => {
    setClips((prev) => [...prev, clip])
  }, [])

  return (
    <EditorContext.Provider value={{ ratio, setRatio, clips, setClips, addClip }}>
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor() {
  return useContext(EditorContext)
}
