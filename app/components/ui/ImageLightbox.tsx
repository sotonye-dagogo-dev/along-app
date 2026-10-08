"use client"

import { useEffect, useState, useCallback } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

interface ImageLightboxProps {
  images: string[]
  initialIndex: number
  onClose: () => void
}

function clampIndex(n: number, length: number): number {
  if (length <= 0) return 0
  if (n < 0) return 0
  if (n >= length) return length - 1
  return n
}

export function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
  // State-owned index (not direct DOM src mutation): prev/next and the
  // counter always derive from the same value, so repeated navigation and
  // the "n / total" badge can never drift apart.
  const [index, setIndex] = useState(() => clampIndex(initialIndex, images.length))

  // Re-sync when a different thumbnail opens the viewer or the list changes.
  useEffect(() => {
    setIndex(clampIndex(initialIndex, images.length))
  }, [initialIndex, images.length])

  const goPrev = useCallback(() => {
    setIndex((prev) => (prev <= 0 ? images.length - 1 : prev - 1))
  }, [images.length])

  const goNext = useCallback(() => {
    setIndex((prev) => (prev >= images.length - 1 ? 0 : prev + 1))
  }, [images.length])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goNext()
      }
    },
    [onClose, goPrev, goNext]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [handleKeyDown])

  if (images.length === 0) return null
  const safeIndex = clampIndex(index, images.length)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {images.length > 1 && (
          <span className="text-xs text-white/70 bg-black/40 px-2.5 py-1 radius-pill" aria-live="polite">
            {safeIndex + 1} / {images.length}
          </span>
        )}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-circle bg-black/50 text-white flex items-center justify-center border-none cursor-pointer hover:bg-black/70 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-circle bg-black/40 text-white flex items-center justify-center border-none cursor-pointer hover:bg-black/60 transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-circle bg-black/40 text-white flex items-center justify-center border-none cursor-pointer hover:bg-black/60 transition-colors"
            aria-label="Next image"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div className="flex items-center justify-center w-full h-full p-4" onClick={(e) => e.stopPropagation()}>
        <img
          key={images[safeIndex]}
          src={images[safeIndex]}
          alt={`Expanded route photo ${safeIndex + 1} of ${images.length}`}
          className="max-w-[95vw] max-h-[90vh] object-contain radius-sm"
        />
      </div>
    </div>
  )
}
