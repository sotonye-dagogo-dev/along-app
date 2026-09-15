import { Client, Receiver } from "@upstash/qstash";

class QStashService {
  private client: Client | null = null;
  private receiver: Receiver | null = null;

  private getClient(): Client {
    if (!this.client) {
      const token = process.env.QSTASH_TOKEN;
      if (!token) {
        throw new Error("QSTASH_TOKEN environment variable is not set");
      }
      this.client = new Client({ token });
    }
    return this.client;
  }

  private getReceiver(): Receiver {
    if (!this.receiver) {
      const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
      const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
      if (!currentSigningKey || !nextSigningKey) {
        throw new Error("QSTASH signing keys are not set");
      }
      this.receiver = new Receiver({
        currentSigningKey,
        nextSigningKey,
      });
    }
    return this.receiver;
  }

  async verifySignature(request: Request): Promise<{ valid: boolean; bodyText: string }> {
    try {
      const signature = request.headers.get("upstash-signature");
      if (!signature) return { valid: false, bodyText: "" };
      // Clone the request so downstream handlers can still read the body
      const clone = request.clone();
      const body = await clone.text();
      const valid = await this.getReceiver().verify({ signature, body });
      return { valid, bodyText: body };
    } catch {
      return { valid: false, bodyText: "" };
    }
  }

  // Backwards-compatible helper for call sites that only need boolean
  async verifySignatureLegacy(request: Request): Promise<boolean> {
    const { valid } = await this.verifySignature(request);
    return valid;
  }

  async publishFeedInvalidation(payload: { userIds?: string[]; postId?: string; followersOfUserId?: string }) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");
      return await this.getClient().publishJSON({
        url: `${appUrl}/api/workers/feed-invalidate`,
        body: payload,
        retries: 3,
      });
    } catch (error) {
      console.error("QStash publishFeedInvalidation error:", error);
    }
  }

  async publishValidityRecompute(payload: { postId: string }) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");
      return await this.getClient().publishJSON({
        url: `${appUrl}/api/workers/validity-recompute`,
        body: payload,
        retries: 3,
      });
    } catch (error) {
      console.error("QStash publishValidityRecompute error:", error);
    }
  }

  async publishRewardsAward(payload: { userId: string; actionKey: string; postAuthorId?: string }) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");
      return await this.getClient().publishJSON({
        url: `${appUrl}/api/workers/rewards`,
        body: payload,
        retries: 3,
      });
    } catch (error) {
      console.error("QStash publishRewardsAward error:", error);
    }
  }
}

export const qstashService = new QStashService();
