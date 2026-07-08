"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Eye, Code, Smartphone } from "lucide-react"

interface TemplateInfo {
  name: string
  subject: string
  variables: string[]
}

interface PreviewData {
  template: TemplateInfo
  rendered: { html: string; text: string }
  sampleVars: Record<string, string>
  config: { fromName: string; fromEmail: string; replyTo: string }
}

export default function AdminEmailPreviewPage() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [selected, setSelected] = useState<string>("otp")
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"preview" | "html" | "text">("preview")

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/email/preview")
      if (!res.ok) throw new Error("Request failed")
      const data = await res.json()
      setTemplates(data.templates ?? [])
      if (data.templates?.length > 0) {
        setSelected(data.templates[0].name)
      }
    } catch (err) { console.error("[AdminError]", err) } finally { setLoading(false) }
  }, [])

  const loadPreview = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/email/preview?template=${name}`)
      if (!res.ok) throw new Error("Request failed")
      setPreview(await res.json())
    } catch (err) { console.error("[AdminError]", err) }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])
  useEffect(() => { if (selected) loadPreview(selected) }, [selected, loadPreview])

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Email Preview</h1>
          <div className="text-sm text-text-secondary">Preview and test email templates</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-text-muted">No email templates found</div>
      ) : (
        <>
          <div className="flex gap-3 mb-5 flex-wrap">
            {templates.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelected(t.name)}
                className={`px-3 py-2 radius-md text-xs font-semibold border transition-all duration-fast cursor-pointer ${
                  selected === t.name
                    ? "bg-primary text-text-inverse border-primary"
                    : "bg-bg-card text-text-secondary border-border hover:border-primary hover:text-primary"
                }`}
              >
                {t.name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
              </button>
            ))}
          </div>

          {preview && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-bg-card border border-border radius-lg shadow-xs overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{preview.template.subject}</span>
                      <span className="text-[11px] text-text-muted">
                        From: {preview.config.fromName} &lt;{preview.config.fromEmail}&gt;
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {(["preview", "html", "text"] as const).map((mode) => {
                        const Icon = mode === "preview" ? Eye : mode === "html" ? Code : Smartphone
                        return (
                          <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`p-1.5 radius-md text-xs cursor-pointer ${
                              viewMode === mode
                                ? "bg-primary-muted text-primary"
                                : "text-text-muted hover:text-text-primary"
                            }`}
                          >
                            <Icon size={14} />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="max-h-[600px] overflow-auto">
                    {viewMode === "preview" ? (
                      <iframe
                        srcDoc={preview.rendered.html}
                        className="w-full border-none"
                        title="Email preview"
                        style={{ minHeight: 500 }}
                      />
                    ) : viewMode === "html" ? (
                      <pre className="p-4 text-xs font-mono text-text-secondary whitespace-pre-wrap leading-relaxed">
                        {preview.rendered.html}
                      </pre>
                    ) : (
                      <pre className="p-4 text-xs font-mono text-text-secondary whitespace-pre-wrap leading-relaxed">
                        {preview.rendered.text}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-bg-card border border-border radius-lg p-4 shadow-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Template Info</h3>
                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Name</dt>
                      <dd className="font-semibold">{preview.template.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Subject</dt>
                      <dd className="font-semibold text-right max-w-[200px] truncate">{preview.template.subject}</dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-bg-card border border-border radius-lg p-4 shadow-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Sample Variables</h3>
                  <dl className="space-y-2 text-xs">
                    {Object.entries(preview.sampleVars).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <dt className="text-text-muted font-mono">{key}</dt>
                        <dd className="font-semibold max-w-[150px] truncate text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="bg-bg-card border border-border radius-lg p-4 shadow-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Configuration</h3>
                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-text-muted">From</dt>
                      <dd className="font-semibold">{preview.config.fromName}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Email</dt>
                      <dd className="font-semibold">{preview.config.fromEmail}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Reply-To</dt>
                      <dd className="font-semibold">{preview.config.replyTo}</dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-bg-card border border-border radius-lg p-4 shadow-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Admin Edit</h3>
                  <p className="text-xs text-text-secondary mb-3">
                    Email templates are editable via the Site Config panel.
                  </p>
                  <a
                    href="/admin/config"
                    className="inline-flex items-center gap-1.5 px-3 py-2 radius-md text-xs font-semibold bg-primary text-text-inverse no-underline hover:opacity-90 transition-opacity"
                  >
                    Open Config
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
