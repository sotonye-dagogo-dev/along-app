/**
 * Invite/referral configuration (config-driven, zero app deps).
 *
 * Growth policy: inviting is UNLIMITED — `maxInvitesPerUser` never gates
 * linking a new signup to their inviter, on any auth method (email+password
 * or Google OAuth). It only caps the SEND-credit points (`pointsForInviteSent`):
 * the first `maxInvitesPerUser` converted invites also earn the send credit,
 * anything beyond that still links and still earns `pointsForInviteAccepted`.
 * Rationale: cap the cheap (unaccepted-send) points, never the growth loop.
 */
interface InviteConfig {
  /**
   * Cap for send-credit points only — NOT a limit on how many people a user
   * may invite. Linking (`invitedById`) is always applied when a valid
   * invite code is presented.
   */
  maxInvitesPerUser: number;
  pointsForInviteSent: number;
  pointsForInviteAccepted: number;
  leaderboardCacheTtlSeconds: number;
}

export const INVITE_CONFIG: InviteConfig = {
  maxInvitesPerUser: 50,
  pointsForInviteSent: 20,
  pointsForInviteAccepted: 100,
  leaderboardCacheTtlSeconds: 600,
};
