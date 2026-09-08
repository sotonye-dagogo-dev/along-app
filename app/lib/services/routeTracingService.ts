interface RoutePin {
  lat: number
  lng: number
}

interface TraceResult {
  polyline: string
  distance: number
  duration: number
  provider?: string
}

class RouteTracingService {
  private baseUrl = 'https://api.openrouteservice.org/v2/directions/driving-car'
  private apiKey: string | null = null
  private mapboxToken: string | null = null

  constructor() {
    this.apiKey = process.env.OPEN_ROUTE_SERVICE_KEY ?? null
    // NEXT_PUBLIC_ not available on server for ORS fallback check, but we try both
    this.mapboxToken = process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? null
  }

  async trace(pins: RoutePin[]): Promise<TraceResult> {
    if (pins.length < 2) {
      throw new Error('At least 2 pins required')
    }

    // Validate pins
    for (const p of pins) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || isNaN(p.lat) || isNaN(p.lng)) {
        throw new Error('Invalid pin coordinates')
      }
      if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
        throw new Error('Pin coordinates out of bounds')
      }
    }

    // Prefer Mapbox if configured — more accurate for West Africa than ORS straight-line fallback
    if (this.mapboxToken) {
      try {
        return await this.traceWithMapbox(pins)
      } catch (e) {
        console.warn('[RouteTracing] Mapbox failed, trying ORS', e)
      }
    }

    if (this.apiKey) {
      try {
        return await this.traceWithOpenRouteService(pins)
      } catch (e) {
        console.warn('[RouteTracing] ORS failed, falling back to straight line', e)
      }
    }

    return this.traceStraightLine(pins)
  }

  private async traceWithMapbox(pins: RoutePin[]): Promise<TraceResult> {
    // Mapbox Directions API supports up to 25 coordinates
    const limited = pins.slice(0, 25)
    const coords = limited.map((p) => `${p.lng},${p.lat}`).join(';')
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?alternatives=false&geometries=polyline&overview=full&access_token=${this.mapboxToken}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Mapbox error: ${res.status}`)
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) throw new Error('No route from Mapbox')

    // Mapbox polyline is polyline5 with precision 5 — compatible with @mapbox/polyline
    const polyline: string = route.geometry ?? this.encodePolyline(limited.map((p) => [p.lng, p.lat]))
    const distance = route.distance ? Math.round((route.distance / 1000) * 10) / 10 : this.approximateDistance(limited)
    const duration = route.duration ? Math.round(route.duration / 60) : Math.round(distance * 2)

    return { polyline, distance, duration, provider: 'mapbox' }
  }

  private async traceWithOpenRouteService(pins: RoutePin[]): Promise<TraceResult> {
    const coordinates = pins.map((p) => [p.lng, p.lat])

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.apiKey!,
      },
      body: JSON.stringify({
        coordinates,
        format: 'json',
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouteService error: ${response.status}`)
    }

    const data = await response.json()
    const route = data.routes?.[0]
    if (!route) throw new Error('No route found')

    const polyline = this.encodePolyline(route.geometry?.coordinates ?? [])
    const distance = route.summary?.distance
      ? Math.round(route.summary.distance / 1000 * 10) / 10
      : this.approximateDistance(pins)
    const duration = route.summary?.duration
      ? Math.round(route.summary.duration / 60)
      : Math.round(distance * 15)

    return { polyline, distance, duration, provider: 'ors' }
  }

  private traceStraightLine(pins: RoutePin[]): TraceResult {
    const distance = this.approximateDistance(pins)
    const duration = Math.round(distance * 15)
    const polyline = this.encodePolyline(pins.map((p) => [p.lng, p.lat]))
    return { polyline, distance, duration, provider: 'straight' }
  }

  private approximateDistance(pins: RoutePin[]): number {
    let total = 0
    for (let i = 1; i < pins.length; i++) {
      total += this.haversineDistance(pins[i - 1], pins[i])
    }
    return Math.round(total * 10) / 10
  }

  private haversineDistance(a: RoutePin, b: RoutePin): number {
    const R = 6371
    const dLat = this.toRad(b.lat - a.lat)
    const dLng = this.toRad(b.lng - a.lng)
    const sinLat = Math.sin(dLat / 2)
    const sinLng = Math.sin(dLng / 2)
    const aVal =
      sinLat * sinLat +
      Math.cos(this.toRad(a.lat)) * Math.cos(this.toRad(b.lat)) * sinLng * sinLng
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))
    return R * c
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180
  }

  private encodePolyline(coords: number[][]): string {
    let result = ''
    let prevLat = 0
    let prevLng = 0

    for (const [lng, lat] of coords) {
      const dLat = Math.round((lat - prevLat) * 1e5)
      const dLng = Math.round((lng - prevLng) * 1e5)
      result += this.encodeSigned(dLat)
      result += this.encodeSigned(dLng)
      prevLat = lat
      prevLng = lng
    }

    return result
  }

  private encodeSigned(value: number): string {
    let v = value << 1
    if (value < 0) v = ~v
    let result = ''
    while (v >= 0x20) {
      result += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
      v >>= 5
    }
    result += String.fromCharCode(v + 63)
    return result
  }
}

export const routeTracingService = new RouteTracingService()
