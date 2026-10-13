'use client'

import React from 'react'
import { Camera } from 'lucide-react'
import { AppModal, ConfigDrivenForm, AppAvatar } from '@/app/components/ui'
import { EDIT_PROFILE_FIELDS } from '@/app/lib/config'
import { AVATAR_MENU_CONFIG } from '@/app/lib/config/avatar'

interface EditProfileModalProps {
  open: boolean
  onClose: () => void
  initialValues?: Record<string, unknown>
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  /** Optional avatar preview + trigger — opens the avatar menu/editor without touching profile submit flow. */
  avatarSrc?: string
  avatarAlt?: string
  avatarConfig?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string }
  onAvatarEdit?: () => void
}

function EditProfileModal({ open, onClose, initialValues, onSubmit, avatarSrc, avatarAlt, avatarConfig, onAvatarEdit }: EditProfileModalProps) {
  return (
    <AppModal open={open} onClose={onClose} size="sm" title="Edit Profile">
      <div className="py-2">
        {onAvatarEdit && (
          <button
            type="button"
            onClick={onAvatarEdit}
            className="w-full flex items-center gap-3 px-3 py-2.5 mb-3 rounded-lg border border-border bg-bg-elevated/50 hover:bg-bg-elevated transition-colors cursor-pointer text-left"
            aria-label={AVATAR_MENU_CONFIG.editProfileLabel}
          >
            <AppAvatar
              src={avatarSrc}
              alt={avatarAlt ?? "Profile photo"}
              size={40}
              config={avatarConfig}
              linkToProfile={false}
            />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-text-primary">{AVATAR_MENU_CONFIG.editProfileLabel}</span>
              <span className="block text-[11px] text-text-muted">{AVATAR_MENU_CONFIG.changeHint}</span>
            </span>
            <Camera size={15} className="shrink-0 text-text-secondary" />
          </button>
        )}
        <ConfigDrivenForm
          fields={EDIT_PROFILE_FIELDS}
          initialValues={initialValues}
          onSubmit={(data) => onSubmit(data).then(() => onClose())}
          submitLabel="Save Changes"
        />
      </div>
    </AppModal>
  )
}

export { EditProfileModal }
