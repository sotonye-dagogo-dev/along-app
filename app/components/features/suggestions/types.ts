/** Shared shape returned by GET /api/suggestions. */

export interface SuggestionUser {
  id: string
  userName: string
  firstName: string
  lastName: string
  avatar: string | null
  avatarConfig: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null
  verified: boolean
  postCount: number
  followerCount: number
}

export interface SuggestionPost {
  id: string
  title: string
  description?: string | null
  region: string | null
  tags?: string[]
  totalDistanceKm?: number | null
  estimatedMins?: number | null
  validityScore?: number
  validityTier?: string | null
  images?: string[]
  createdAt: string | Date
  user: {
    id: string
    userName: string
    firstName: string
    lastName: string
    avatar: string | null
    avatarConfig: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null
    verified: boolean
  }
}

export interface SuggestionsData {
  routeRequests: SuggestionPost[]
  routes: SuggestionPost[]
  users: SuggestionUser[]
}
