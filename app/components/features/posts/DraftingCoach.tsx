"use client"

import { useState } from "react"
import { BarChart3, ChevronDown, CheckCircle, AlertCircle } from "lucide-react"
import { AppProgress } from "@/app/components/ui"

interface CheckpointResult {
  id: string
  label: string
  passed: boolean
  weight: number
}

interface DraftingCoachProps {
  score: number
  maxScore: number
  checkpoints: CheckpointResult[]
  nextSuggestion: string | null
  /** Collapsed by default per share-route config; callers may override. */
  defaultOpen?: boolean
}

export default function DraftingCoach({ score, maxScore, checkpoints, nextSuggestion, defaultOpen = false }: DraftingCoachProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

  const getScoreColor = () => {
    if (percentage >= 80) return "text-info-text"
    if (percentage >= 60) return "text-primary"
    if (percentage >= 30) return "text-warning-text"
    return "text-error-text"
  }

  const passed = checkpoints.filter((cp) => cp.passed)

  return (
    <div className="border border-border radius-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-elevated border-b border-border cursor-pointer transition-colors duration-fast border-none text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 size={16} className="text-text-secondary" />
          Route Quality Score
        </div>
        <div className={`transition-transform duration-fast ${isOpen ? "rotate-180" : ""}`}>
          <ChevronDown size={16} className="text-text-secondary" />
        </div>
      </button>

      {isOpen && (
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-text-secondary flex-1">Score</span>
            <span className={`text-base font-bold ${getScoreColor()}`}>{score}</span>
            <span className="text-xs text-text-muted">/ {maxScore}</span>
          </div>
          <AppProgress value={percentage} size="sm" className="flex-1" />

          {nextSuggestion && (
            <div className="flex items-start gap-2 px-3 py-2.5 radius-md bg-info text-info-text border border-info-border text-xs leading-relaxed">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{nextSuggestion}</span>
            </div>
          )}

          {passed.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {passed.map((cp) => (
                <span key={cp.id} className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-xs font-medium bg-success text-success-text">
                  <CheckCircle size={12} />
                  {cp.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
