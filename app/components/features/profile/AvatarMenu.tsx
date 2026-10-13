'use client'

import { useState } from 'react'
import { Camera, Pencil, Expand } from 'lucide-react'
import { AppAvatar, AppModal } from '@/app/components/ui'
import { AVATAR_MENU_CONFIG } from '@/app/lib/config/avatar'
import { useTranslation } from '@/app/providers/I18nProvider'

interface AvatarMenuProps {
  open: boolean
  onClose: () => void
  src?: string
  alt: string
  config?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string }
  verified?: boolean
  onChange: () => void
}

/**
 * Avatar options menu — opened by the camera badge, by clicking the avatar
 * itself, or from the Edit Profile modal. Config-driven labels, no new
 * avatar-editing flow (Change simply opens the existing AvatarEditor).
 */
export function AvatarMenu({ open, onClose, src, alt, config, verified, onChange }: AvatarMenuProps) {
  const { tf } = useTranslation()
  const [viewing, setViewing] = useState(false)

  if (!open && !viewing) return null

  const changeLabel = tf("avatar.menu.change", AVATAR_MENU_CONFIG.changeLabel)
  const viewLabel = tf("avatar.menu.view", AVATAR_MENU_CONFIG.viewLabel)

  return (
    <>
      <AppModal open={open && !viewing} onClose={onClose} size="sm" title={tf("avatar.menu.title", "Profile photo")}>
        <div className="py-2 flex flex-col gap-2">
          <div className="flex justify-center py-2">
            <AppAvatar src={src} alt={alt} size={96} config={config} verified={verified} linkToProfile={false} />
          </div>
          <button
            type="button"
            onClick={() => setViewing(true)}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer border-none bg-transparent text-left"
          >
            <Expand size={16} className="shrink-0 text-text-secondary" />
            <span>{viewLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => { onClose(); onChange() }}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer border-none bg-transparent text-left"
          >
            <Pencil size={16} className="shrink-0 text-text-secondary" />
            <span>{changeLabel}</span>
          </button>
          <p className="text-[11px] text-text-muted px-3 pt-1">{tf("avatar.menu.hint", AVATAR_MENU_CONFIG.changeHint)}</p>
        </div>
      </AppModal>
      <AppModal open={viewing} onClose={() => { setViewing(false); onClose() }} size="sm" title={alt}>
        <div className="py-4 flex justify-center">
          <AppAvatar src={src} alt={alt} size={200} config={config} verified={false} linkToProfile={false} />
        </div>
      </AppModal>
    </>
  )
}

export function AvatarCameraBadge({ onOpen }: { onOpen: () => void }) {
  const { tf } = useTranslation()
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen() }}
      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-circle bg-bg-card border-2 border-bg-base flex items-center justify-center cursor-pointer text-text-secondary hover:text-primary transition-colors duration-fast"
      aria-label={tf("avatar.menu.camera", AVATAR_MENU_CONFIG.cameraAriaLabel)}
      title={tf("avatar.menu.camera", AVATAR_MENU_CONFIG.cameraAriaLabel)}
    >
      <Camera size={13} />
    </button>
  )
}
