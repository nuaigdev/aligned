'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])

export function isImageFile(fileType: string | null | undefined): boolean {
  return !!fileType && IMAGE_EXTENSIONS.has(fileType.toLowerCase())
}

/**
 * Fullscreen overlay for viewing an image attachment in place — clicking an
 * image attachment should show it, not hand it off to a new browser tab.
 */
export function ImageLightbox({ src, alt, onClose }: { src: string | null; alt: string; onClose: () => void }) {
  useEffect(() => {
    if (!src) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [src, onClose])

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', cursor: 'zoom-out',
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '18px', right: '18px', background: 'rgba(255,255,255,0.12)', border: 'none',
              borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <X size={18} />
          </button>
          <motion.img
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            src={src}
            alt={alt}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', objectFit: 'contain', cursor: 'default' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
