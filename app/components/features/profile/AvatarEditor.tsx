'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Check, Dices, Lightbulb } from 'lucide-react'
import { AppModal, AppAvatar, AppButton } from '@/app/components/ui'
import {
  AVATAR_STYLES,
  AVATAR_CATEGORIES,
  AVATAR_BACKGROUNDS,
  AVATAR_SEED_PRESETS,
  AVATAR_EDITOR_CONFIG,
  buildAvatarUrl,
  randomAvatarSeed,
} from '@/app/lib/config/avatar'
import type { AvatarConfig } from '@/app/lib/types'

interface AvatarEditorProps {
  open: boolean
  onClose: () => void
  currentConfig?: AvatarConfig
  userName?: string
  onSave: (config: AvatarConfig) => Promise<void>
}

function AvatarEditor({ open, onClose, currentConfig, userName, onSave }: AvatarEditorProps) {
  const [config, setConfig] = useState<AvatarConfig>(
    currentConfig ?? { style: 'avataaars', seed: userName }
  )
  const [category, setCategory] = useState<(typeof AVATAR_CATEGORIES)[number]>('All')
  const [saving, setSaving] = useState(false)

  // Re-sync when the modal opens with fresh server data (e.g. after save).
  useEffect(() => {
    if (open) {
      setConfig(currentConfig ?? { style: 'avataaars', seed: userName })
      setCategory('All')
    }
  }, [open, currentConfig, userName])

  const previewUrl = buildAvatarUrl({ ...config, seed: config.seed?.trim() ? config.seed : userName })

  const visibleStyles = useMemo(
    () => (category === 'All' ? AVATAR_STYLES : AVATAR_STYLES.filter((s) => s.category === category)),
    [category],
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        ...config,
        seed: config.seed?.trim() ? config.seed.trim() : userName,
      })
      onClose()
    } catch {
      // error handled by parent
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal open={open} onClose={onClose} size="lg" title="Customize Avatar">
      <div className="flex flex-col sm:flex-row gap-6 py-2">
        <div className="flex-1 min-w-0">
          <label className="text-xs font-medium text-text-secondary mb-2 block uppercase tracking-wider">
            {AVATAR_EDITOR_CONFIG.styleLabel}
          </label>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {AVATAR_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`h-7 px-3 rounded-full text-xs font-semibold border cursor-pointer transition-colors duration-fast ${
                  category === c
                    ? 'bg-primary text-white border-primary'
                    : 'bg-bg-elevated text-text-secondary border-border hover:text-primary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
            {visibleStyles.map((style) => {
              const styleUrl = buildAvatarUrl({
                ...config,
                style: style.value,
                seed: config.seed?.trim() ? config.seed : userName,
              })
              const selected = config.style === style.value
              return (
                <button
                  key={style.value}
                  type="button"
                  title={style.description}
                  onClick={() => setConfig((prev) => ({ ...prev, style: style.value }))}
                  className={`relative flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 cursor-pointer transition-all duration-fast bg-transparent font-sans ${
                    selected
                      ? 'border-primary bg-primary-muted'
                      : 'border-border hover:border-primary-light'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={styleUrl}
                    alt={style.label}
                    className="w-10 h-10 rounded-full object-cover"
                    loading="lazy"
                  />
                  <span className="text-[11px] font-medium text-text-secondary leading-tight text-center">{style.label}</span>
                  <span className="text-[10px] text-text-muted leading-tight text-center line-clamp-2">{style.description}</span>
                  {selected && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div className="w-full sm:w-52 shrink-0 flex flex-col items-center gap-3 sm:pt-6">
          <label className="text-xs font-medium text-text-secondary block uppercase tracking-wider">
            {AVATAR_EDITOR_CONFIG.previewLabel}
          </label>
          <AppAvatar
            src={previewUrl}
            alt="Preview"
            size={120}
            linkToProfile={false}
          />
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs text-text-secondary">{AVATAR_EDITOR_CONFIG.seedLabel}</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={config.seed ?? ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, seed: e.target.value }))}
                placeholder={AVATAR_EDITOR_CONFIG.seedPlaceholder}
                className="flex-1 min-w-0 h-9 px-2 text-xs border border-border rounded-md outline-none bg-bg-base text-text-primary focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, seed: randomAvatarSeed() }))}
                title={AVATAR_EDITOR_CONFIG.randomLabel}
                aria-label={AVATAR_EDITOR_CONFIG.randomAriaLabel}
                className="h-9 px-2.5 rounded-md border border-border bg-bg-elevated text-text-secondary text-xs font-semibold inline-flex items-center gap-1 cursor-pointer hover:text-primary hover:border-primary-light transition-colors shrink-0"
              >
                <Dices size={14} />
                {AVATAR_EDITOR_CONFIG.randomLabel}
              </button>
            </div>
            <p className="text-[11px] text-text-muted leading-snug">{AVATAR_EDITOR_CONFIG.seedHint}</p>
            <span className="text-[11px] font-semibold text-text-secondary mt-1">{AVATAR_EDITOR_CONFIG.presetsLabel}</span>
            <div className="flex gap-1.5 flex-wrap">
              {AVATAR_SEED_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, seed: preset }))}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-medium border cursor-pointer transition-colors duration-fast ${
                    config.seed === preset
                      ? 'bg-primary-muted text-primary border-primary'
                      : 'bg-bg-elevated text-text-secondary border-border hover:text-primary'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-semibold text-text-secondary mt-2">{AVATAR_EDITOR_CONFIG.backgroundLabel}</span>
            <div className="flex gap-1.5 flex-wrap">
              {AVATAR_BACKGROUNDS.map((bg) => {
                const active = (config.backgroundColor ?? '') === bg.value
                return (
                  <button
                    key={bg.label}
                    type="button"
                    title={bg.label}
                    aria-label={`Background ${bg.label}`}
                    onClick={() => setConfig((prev) => ({ ...prev, backgroundColor: bg.value || undefined }))}
                    className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-all ${
                      active ? 'border-primary scale-110' : 'border-border hover:scale-105'
                    }`}
                    style={{ background: bg.value ? `#${bg.value}` : 'linear-gradient(135deg,#e5e7eb 25%,#f9fafb 25%,#f9fafb 50%,#e5e7eb 50%,#e5e7eb 75%,#f9fafb 75%)' }}
                  />
                )
              })}
            </div>
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.flip ?? false}
                onChange={(e) => setConfig((prev) => ({ ...prev, flip: e.target.checked || undefined }))}
                className="w-3.5 h-3.5 accent-[#00623B]"
              />
              {AVATAR_EDITOR_CONFIG.flipLabel}
            </label>
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2 items-start px-3 py-2.5 rounded-lg bg-bg-elevated border border-border">
        <Lightbulb size={14} className="text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-text-primary">{AVATAR_EDITOR_CONFIG.tipTitle}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {AVATAR_EDITOR_CONFIG.tips.map((tip) => (
              <li key={tip} className="text-[11px] text-text-secondary leading-snug">• {tip}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
        <AppButton variant="ghost" onClick={onClose}>Cancel</AppButton>
        <AppButton variant="primary" onClick={handleSave} loading={saving}>
          Save Avatar
        </AppButton>
      </div>
    </AppModal>
  )
}

export { AvatarEditor }
