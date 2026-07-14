"use client"

import { useState, useEffect } from "react"
import { ShoppingBag, MapPin, Tag, User } from "lucide-react"
import { AppCard, AppEmptyState } from "@/app/components/ui"
import type { TransactListing } from "@/app/lib/integrations/transact"

export default function MarketplacePage() {
  const [listings, setListings] = useState<TransactListing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/integrations/transact")
        if (res.ok) {
          const data = await res.json()
          setListings(data.listings ?? [])
        }
      } catch { /* ignore */ } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="h-8 bg-bg-elevated radius-md w-1/4 mb-2 animate-pulse" />
          <div className="h-4 bg-bg-elevated radius-md w-1/2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-bg-card border border-border radius-lg p-5 animate-pulse space-y-3">
              <div className="h-4 bg-bg-elevated radius-md w-3/4" />
              <div className="h-8 bg-bg-elevated radius-md w-1/3" />
              <div className="flex gap-2">
                <div className="h-5 bg-bg-elevated radius-md w-16" />
                <div className="h-5 bg-bg-elevated radius-md w-20" />
              </div>
              <div className="h-3 bg-bg-elevated radius-md w-1/2" />
              <div className="h-3 bg-bg-elevated radius-md w-1/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-8">
        <AppEmptyState
          icon={ShoppingBag}
          title="No listings available"
          description="There are no guides, tours, or tickets available right now. Check back later."
        />
      </div>
    )
  }

  return (
    <div className="max-w-[960px] mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Marketplace</h1>
        <p className="text-sm text-text-secondary">Route guides, tours, and tickets</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings.map((listing) => (
          <AppCard key={listing.id} hover className="p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-snug line-clamp-2 flex-1">
                {listing.title}
              </h3>
              <span
                className={`shrink-0 text-xs font-semibold px-2 py-0.5 radius-md ${
                  listing.available
                    ? "bg-success-muted text-success"
                    : "bg-bg-elevated text-text-muted"
                }`}
              >
                {listing.available ? "Available" : "Sold"}
              </span>
            </div>

            <div className="text-lg font-bold text-primary">
              ₦{listing.price.toLocaleString()}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-bg-elevated text-text-secondary px-2 py-0.5 radius-md">
                <Tag size={12} />
                {listing.type.charAt(0).toUpperCase() + listing.type.slice(1)}
              </span>
              {listing.imageUrl && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-bg-elevated text-text-secondary px-2 py-0.5 radius-md">
                  <MapPin size={12} />
                  Route
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-text-muted mt-auto pt-1 border-t border-border">
              <User size={12} />
              <span>{listing.sellerName}</span>
            </div>
          </AppCard>
        ))}
      </div>
    </div>
  )
}
