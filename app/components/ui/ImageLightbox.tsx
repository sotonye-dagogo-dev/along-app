"use client"

import { useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

interface ImageLightboxProps {
  images: string[]
  initialIndex: number
  onClose: () => void
}

export function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
  const safeIndex = Math.min(initialIndex, images.length - 1)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    },
    [onClose]
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

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {images.length > 1 && (
          <span className="text-xs text-white/70 bg-black/40 px-2.5 py-1 radius-pill">
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
              const prev = safeIndex <= 0 ? images.length - 1 : safeIndex - 1
              const img = document.getElementById("lightbox-image") as HTMLImageElement | null
              if (img) {
                img.style.opacity = "0"
                setTimeout(() => {
                  img.src = images[prev]
                  img.style.opacity = "1"
                }, 100)
              }
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-circle bg-black/40 text-white flex items-center justify-center border-none cursor-pointer hover:bg-black/60 transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              const next = safeIndex >= images.length - 1 ? 0 : safeIndex + 1
              const img = document.getElementById("lightbox-image") as HTMLImageElement | null
              if (img) {
                img.style.opacity = "0"
                setTimeout(() => {
                  img.src = images[next]
                  img.style.opacity = "1"
                }, 100)
              }
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
          id="lightbox-image"
          src={images[safeIndex]}
          alt="Expanded route photo"
          className="max-w-[95vw] max-h-[90vh] object-contain radius-sm transition-opacity duration-200"
          style={{ opacity: 1 }}
        />
      </div>
    </div>
  )
}
