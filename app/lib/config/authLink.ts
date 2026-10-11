/**
 * Auth-link status copy (config-driven, zero app deps).
 *
 * Centralises every user-facing sentence that depends on which auth methods
 * are connected (Google OAuth, email+password, both, neither). Panels read
 * from here so Email & Security and Connected Accounts can never drift.
 */
export const AUTH_LINK_STATUS_CONFIG = {
  bothConnected: "Both methods connected — you can sign in with Google or email & password.",
  googleOnly: "Signed in with Google only — add a password in Connected Accounts to enable email sign-in.",
  passwordOnly: "Email & password enabled — connect Google in Connected Accounts to sign in either way.",
  none: "Tip: Link both methods so you can sign in either way.",
  googleStaysLinked: "Google sign-in stays linked — either method works.",
  addPasswordFirst: "Add a password in Connected Accounts, then you can change it here.",
} as const;

export type AuthLinkState = "both" | "googleOnly" | "passwordOnly" | "none";

export function resolveAuthLinkState(hasGoogle: boolean, hasPassword: boolean): AuthLinkState {
  if (hasGoogle && hasPassword) return "both";
  if (hasGoogle) return "googleOnly";
  if (hasPassword) return "passwordOnly";
  return "none";
}

export function authLinkStatusCopy(hasGoogle: boolean, hasPassword: boolean): string {
  const state = resolveAuthLinkState(hasGoogle, hasPassword);
  if (state === "both") return AUTH_LINK_STATUS_CONFIG.bothConnected;
  if (state === "googleOnly") return AUTH_LINK_STATUS_CONFIG.googleOnly;
  if (state === "passwordOnly") return AUTH_LINK_STATUS_CONFIG.passwordOnly;
  return AUTH_LINK_STATUS_CONFIG.none;
}
