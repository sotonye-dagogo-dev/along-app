"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { TRAFFIC_CONFIG, type TrafficLevel } from "@/app/lib/config/traffic";

const LEVEL_ORDER: TrafficLevel[] = ["low", "moderate", "heavy"];

/**
 * Traffic legend ("i" icon → tooltip). Hover opens on desktop, click
 * toggles (touch + keyboard), Escape closes. Positioned by the parent map
 * chrome; panel is token-styled (opaque card, works in light + dark) and
 * announced via aria-describedby. Copy + colors come from TRAFFIC_CONFIG.
 */
export function TrafficLegend({ estimated, className }: { estimated: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openNow = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, []);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <div
      className={className ?? "absolute top-2 right-2 z-[4]"}
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-label={TRAFFIC_CONFIG.legend.openLabel}
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="w-7 h-7 rounded-circle flex items-center justify-center bg-bg-card/90 backdrop-blur-sm border border-border text-text-secondary shadow-sm hover:text-text-primary hover:bg-bg-card transition-colors cursor-pointer"
      >
        <Info size={14} aria-hidden />
      </button>
      {open && (
        <div
          id={panelId}
          role="tooltip"
          className="absolute top-8 right-0 w-52 rounded-md bg-bg-card border border-border shadow-lg p-3 text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-primary">{TRAFFIC_CONFIG.legend.title}</span>
            <button
              type="button"
              aria-label={TRAFFIC_CONFIG.legend.dismissLabel}
              onClick={() => setOpen(false)}
              className="w-5 h-5 rounded-circle flex items-center justify-center border-none bg-transparent text-text-muted cursor-pointer hover:text-text-primary transition-colors"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
          <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
            {LEVEL_ORDER.map((level) => (
              <li key={level} className="flex items-center gap-2 text-xs text-text-secondary">
                <span
                  aria-hidden
                  className="inline-block w-6 h-1.5 rounded-full shrink-0"
                  style={{ background: TRAFFIC_CONFIG.levels[level].color }}
                />
                {TRAFFIC_CONFIG.levels[level].label}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-text-muted leading-relaxed mt-2 mb-0">
            {estimated ? TRAFFIC_CONFIG.legend.estimatedNote : TRAFFIC_CONFIG.legend.liveNote}
          </p>
        </div>
      )}
    </div>
  );
}
