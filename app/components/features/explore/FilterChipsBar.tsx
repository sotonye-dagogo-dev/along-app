"use client"

interface FilterChip {
  label: string
  active: boolean
}

export interface FilterChipsBarProps {
  filters: FilterChip[]
  onToggle: (label: string) => void
}

export function FilterChipsBar({ filters, onToggle }: FilterChipsBarProps) {
  return (
    <>
      {filters.map((f) => (
        <button
          key={f.label}
          onClick={() => onToggle(f.label)}
          className={`inline-flex items-center gap-1 px-3 py-1.25 radius-pill text-xs font-medium border font-sans cursor-pointer whitespace-nowrap transition-all duration-fast ${
            f.active
              ? "bg-primary text-white border-primary"
              : "bg-bg-card text-text-secondary border-border hover:border-primary-muted hover:bg-primary-muted hover:text-primary"
          }`}
        >
          {f.label}
        </button>
      ))}
    </>
  )
}
