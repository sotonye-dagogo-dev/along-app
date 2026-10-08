interface ApiEndpoint {
  path: string;
  methods: ("GET" | "POST" | "PATCH" | "PUT" | "DELETE")[];
  auth: boolean;
  rateLimit?: string;
}

export const API_REGISTRY: Record<string, ApiEndpoint> = {
  authLogin: { path: "/api/auth/login", methods: ["POST"], auth: false, rateLimit: "auth" },
  authRegister: { path: "/api/auth/register", methods: ["POST"], auth: false, rateLimit: "auth" },
  authLogout: { path: "/api/auth/logout", methods: ["POST"], auth: true },
  authRefresh: { path: "/api/auth/refresh", methods: ["POST"], auth: false },
  authOtp: { path: "/api/auth/otp", methods: ["POST"], auth: false, rateLimit: "auth" },
  authGoogle: { path: "/api/auth/google", methods: ["POST"], auth: false },
  authGoogleCallback: { path: "/api/auth/google/callback", methods: ["GET"], auth: false },
  postsList: { path: "/api/posts", methods: ["GET", "POST"], auth: false, rateLimit: "posts" },
  postsFeed: { path: "/api/posts/feed", methods: ["GET"], auth: true, rateLimit: "posts" },
  postsDetail: { path: "/api/posts/[id]", methods: ["GET", "PATCH", "DELETE"], auth: false },
  postsLike: { path: "/api/posts/[id]/like", methods: ["POST"], auth: true, rateLimit: "likes" },
  postsBookmark: { path: "/api/posts/[id]/bookmark", methods: ["POST"], auth: true },
  postsComments: { path: "/api/posts/[id]/comments", methods: ["GET", "POST"], auth: false, rateLimit: "comments" },
  postsCommentDetail: { path: "/api/posts/[id]/comments/[commentId]", methods: ["PATCH", "DELETE"], auth: true, rateLimit: "comments" },
  reports: { path: "/api/reports", methods: ["POST"], auth: false, rateLimit: "posts" },
  routesTrace: { path: "/api/routes/trace", methods: ["POST"], auth: true, rateLimit: "trace" },
  usersDetail: { path: "/api/users/[id]", methods: ["GET", "PATCH"], auth: false },
  usersEarlyAdopter: { path: "/api/users/[id]/early-adopter", methods: ["GET"], auth: false },
  usersEarlyAdopters: { path: "/api/users/early-adopters", methods: ["GET"], auth: false },
  usersSearch: { path: "/api/users/search", methods: ["GET"], auth: false, rateLimit: "search" },
  search: { path: "/api/search", methods: ["GET"], auth: false, rateLimit: "search" },
  usersFollow: { path: "/api/users/[id]/follow", methods: ["POST", "DELETE"], auth: true },
  usersAvatar: { path: "/api/users/[id]/avatar", methods: ["PATCH"], auth: true },
  usersSuggestions: { path: "/api/users/suggestions", methods: ["GET"], auth: true },
  notifications: { path: "/api/notifications", methods: ["GET", "PATCH"], auth: true },
  analyticsUser: { path: "/api/analytics/user", methods: ["GET"], auth: true },
  bugReports: { path: "/api/bug-reports", methods: ["POST"], auth: true, rateLimit: "posts" },
  reviews: { path: "/api/reviews", methods: ["GET", "POST"], auth: false },
  invite: { path: "/api/invite", methods: ["GET"], auth: true },
  adminUsers: { path: "/api/admin/users/[id]", methods: ["PATCH", "DELETE"], auth: true },
  adminPosts: { path: "/api/admin/posts/[id]", methods: ["PATCH", "DELETE"], auth: true },
  adminConfig: { path: "/api/admin/config", methods: ["GET", "PATCH"], auth: true },
  adminBugs: { path: "/api/admin/bug-reports/[id]", methods: ["PATCH"], auth: true },
  integrationsTransact: { path: "/api/integrations/transact", methods: ["GET", "POST"], auth: true },
  integrationsTega: { path: "/api/integrations/tega", methods: ["GET"], auth: true },
  webhooksTransact: { path: "/api/webhooks/transact", methods: ["POST"], auth: false },
  webhooksTega: { path: "/api/webhooks/tega", methods: ["POST"], auth: false },
};
