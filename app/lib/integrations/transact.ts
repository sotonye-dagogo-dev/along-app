export interface TransactConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
}

export const TRANSACT_CONFIG: TransactConfig = {
  baseUrl: process.env.TRANSACT_BASE_URL || "",
  apiKey: process.env.TRANSACT_API_KEY || "",
  webhookSecret: process.env.TRANSACT_WEBHOOK_SECRET || "",
};

export interface TransactListing {
  id: string;
  routePostId: string;
  sellerId: string;
  sellerName: string;
  type: "guide" | "tour" | "ticket";
  title: string;
  description: string;
  price: number;
  currency: "NGN";
  available: boolean;
  imageUrl?: string;
  createdAt: string;
}

export async function fetchListings(params?: { postId?: string; type?: string }): Promise<TransactListing[]> {
  if (!TRANSACT_CONFIG.baseUrl) return [];
  const url = new URL(`${TRANSACT_CONFIG.baseUrl}/api/listings`);
  if (params?.postId) url.searchParams.set("postId", params.postId);
  if (params?.type) url.searchParams.set("type", params.type);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TRANSACT_CONFIG.apiKey}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.listings ?? [];
}
