'use client'

import React from 'react'
import { AppModal, ConfigDrivenForm } from '@/app/components/ui'
import { EDIT_PROFILE_FIELDS } from '@/app/lib/config'

interface EditProfileModalProps {
  open: boolean
  onClose: () => void
  initialValues?: Record<string, unknown>
  onSubmit: (data: Record<string, unknown>) => Promise<void>
}

function EditProfileModal({ open, onClose, initialValues, onSubmit }: EditProfileModalProps) {
  return (
    <AppModal open={open} onClose={onClose} size="sm" title="Edit Profile">
      <div className="py-2">
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
