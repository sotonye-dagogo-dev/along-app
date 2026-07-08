export interface TegaConfig {
  baseUrl: string;
  apiKey: string;
}

export const TEGA_CONFIG: TegaConfig = {
  baseUrl: process.env.TEGA_BASE_URL || "",
  apiKey: process.env.TEGA_API_KEY || "",
};

export interface TegaEvent {
  id: string;
  routePostId?: string;
  title: string;
  description: string;
  date: string;
  location: string;
  capacity: number;
  registered: number;
  imageUrl?: string;
}

export async function fetchEvents(params?: { lat?: number; lng?: number; radius?: number }): Promise<TegaEvent[]> {
  if (!TEGA_CONFIG.baseUrl) return [];
  const url = new URL(`${TEGA_CONFIG.baseUrl}/api/events`);
  if (params?.lat) url.searchParams.set("lat", String(params.lat));
  if (params?.lng) url.searchParams.set("lng", String(params.lng));
  if (params?.radius) url.searchParams.set("radius", String(params.radius));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TEGA_CONFIG.apiKey}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.events ?? [];
}
