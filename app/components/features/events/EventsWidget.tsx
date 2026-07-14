"use client"

import { useEffect, useState } from "react"
import { Calendar, MapPin, Users } from "lucide-react"
import type { TegaEvent } from "@/app/lib/integrations/tega"

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <div className="w-9 h-9 rounded-lg skeleton shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 skeleton rounded-sm" />
            <div className="h-2.5 w-1/2 skeleton rounded-sm" />
            <div className="h-2 w-full skeleton rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EventItem({ event }: { event: TegaEvent }) {
  const pct = event.capacity > 0 ? Math.min(Math.round((event.registered / event.capacity) * 100), 100) : 0
  const isFull = event.registered >= event.capacity

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-bg-elevated transition-colors">
      <div className="w-9 h-9 rounded-lg bg-primary-muted flex items-center justify-center text-primary shrink-0 mt-0.5">
        <Calendar size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{event.title}</div>
        <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {event.location}
          </span>
          <span>·</span>
          <span>{event.date}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isFull ? "bg-error" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="flex items-center gap-1 text-xs text-text-muted shrink-0">
            <Users size={12} />
            {event.registered}/{event.capacity}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function EventsWidget() {
  const [events, setEvents] = useState<TegaEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/integrations/tega")
        if (res.ok) {
          const data = await res.json()
          setEvents(data.events ?? [])
        }
      } catch {
        // keep empty
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <aside className="hidden xl:block w-[280px] shrink-0 py-4 pr-4 pl-2">
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 text-sm font-semibold border-b border-border flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          Events near you
        </div>
        {loading ? (
          <Skeleton />
        ) : events.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-text-muted">No upcoming events</div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
