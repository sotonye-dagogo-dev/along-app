"use client";

import { useEffect, useState } from "react";
import { AppButton, AppAlert } from "@/app/components/ui";
import { toastService } from "@/app/lib/services/toastService";
import { MailCheck, MailPlus, KeyRound } from "lucide-react";

interface Props {
  /** Refetch trigger for profile header (verified badge). */
  onChanged?: () => void;
}

/**
 * EmailSecurityPanel — verify / change-email / change-password, gated by
 * account state (config-driven availability, non-breaking additive):
 * - Verify section: only when email unverified.
 * - Change email: verified accounts, or unverified users who mistyped it.
 * - Change password: only when hasPassword (Google-only sees the add form
 *   in AuthLinkPanel instead); Google-linked hint when both methods exist.
 */
export function EmailSecurityPanel({ onChanged }: Props) {
  const [status, setStatus] = useState<{ hasGoogle: boolean; hasPassword: boolean } | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [verifyOtp, setVerifyOtp] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [changeOtp, setChangeOtp] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [awaitingChangeOtp, setAwaitingChangeOtp] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [linkRes, meRes] = await Promise.all([
          fetch("/api/auth/link/status"),
          fetch("/api/auth/me"),
        ]);
        if (linkRes.ok) setStatus(await linkRes.json());
        if (meRes.ok) {
          const d = await meRes.json();
          const u = d.user ?? d;
          setVerified(typeof u.verified === "boolean" ? u.verified : null);
          setEmail(u.email ?? "");
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key); setError(null);
    try {
      const msg = await fn();
      toastService.success(msg);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({})) as { error?: string; message?: string };
    if (!res.ok) throw new Error(d.error ?? "Request failed");
    return d.message ?? "Done";
  };
  const put = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({})) as { error?: string; message?: string };
    if (!res.ok) throw new Error(d.error ?? "Request failed");
    return d.message ?? "Done";
  };

  if (loading) return <div className="h-20 bg-bg-elevated animate-pulse rounded-lg" />;
  const showVerify = verified === false;
  const showChangePw = status?.hasPassword === true;
  // NOTE: verified === true + passwordless (Google-only) renders only the
  // change-email section above — no extra branch needed (previous empty
  // `if` removed; it also tripped TS's no-overlap comparison check).

  return (
    <div className="bg-bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <MailCheck size={18} className="text-primary" />
        <h3 className="text-sm font-semibold text-text-primary">Email &amp; Security</h3>
        {verified === true && <span className="text-[11px] px-2 py-0.5 rounded-full bg-success text-white font-semibold">Verified</span>}
        {verified === false && <span className="text-[11px] px-2 py-0.5 rounded-full bg-warning text-warning-text font-semibold">Unverified</span>}
      </div>
      {error && <AppAlert variant="error" className="mb-3" dismissible onDismiss={() => setError(null)}>{error}</AppAlert>}
      {email && <p className="text-xs text-text-muted mb-3 font-mono truncate">{email}</p>}

      <div className="flex flex-col gap-3">
        {showVerify && (
          <div className="p-3 rounded-md bg-bg-elevated border border-border flex flex-col gap-2">
            <div className="text-sm font-medium">Verify your email</div>
            <p className="text-xs text-text-muted">We sent a code when you signed up. Didn&apos;t get it?</p>
            <div className="flex gap-2 flex-wrap">
              <AppButton size="sm" variant="secondary" loading={busy === "resend"} onClick={() => run("resend", () => post("/api/auth/verify-email", {}))}>
                Resend code
              </AppButton>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); run("confirm", async () => { const m = await put("/api/auth/verify-email", { email, otp: verifyOtp }); setVerified(true); setVerifyOtp(""); return m; }); }}
              className="flex gap-2">
              <input value={verifyOtp} onChange={(e) => setVerifyOtp(e.target.value)} placeholder="6-digit code"
                inputMode="numeric" aria-label="Verification code"
                className="h-9 flex-1 border border-border rounded-md bg-bg-card px-3 text-sm font-mono" />
              <AppButton type="submit" size="sm" loading={busy === "confirm"}>Verify</AppButton>
            </form>
          </div>
        )}

        <div className="p-3 rounded-md bg-bg-elevated border border-border flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-sm font-medium"><MailPlus size={14} /> Change email</div>
          <p className="text-xs text-text-muted">
            {verified === false ? "Mistyped your address? Move it here, then confirm the new one." : "A confirmation code goes to the NEW address."}
          </p>
          {!awaitingChangeOtp ? (
            <form
              onSubmit={(e) => { e.preventDefault(); run("change-req", async () => { const m = await post("/api/auth/change-email", { newEmail }); setConfirmEmail(newEmail.trim().toLowerCase()); setAwaitingChangeOtp(true); return m; }); }}
              className="flex gap-2">
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@example.com"
                type="email" aria-label="New email"
                className="h-9 flex-1 border border-border rounded-md bg-bg-card px-3 text-sm" />
              <AppButton type="submit" size="sm" loading={busy === "change-req"}>Send code</AppButton>
            </form>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); run("change-confirm", async () => { const m = await put("/api/auth/change-email", { newEmail: confirmEmail || newEmail, otp: changeOtp }); setEmail(confirmEmail || newEmail); setVerified(true); setAwaitingChangeOtp(false); setChangeOtp(""); setNewEmail(""); return m; }); }}
              className="flex gap-2">
              <input value={changeOtp} onChange={(e) => setChangeOtp(e.target.value)} placeholder="6-digit code"
                inputMode="numeric" aria-label="Email-change code"
                className="h-9 flex-1 border border-border rounded-md bg-bg-card px-3 text-sm font-mono" />
              <AppButton type="submit" size="sm" loading={busy === "change-confirm"}>Confirm</AppButton>
            </form>
          )}
        </div>

        {showChangePw ? (
          <div className="p-3 rounded-md bg-bg-elevated border border-border flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium"><KeyRound size={14} /> Change password</div>
            <form
              onSubmit={(e) => { e.preventDefault(); run("pw", async () => { const m = await post("/api/auth/change-password", { currentPassword: currentPw, newPassword: newPw }); setCurrentPw(""); setNewPw(""); return m; }); }}
              className="flex flex-col gap-2">
              <input value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Current password"
                type="password" aria-label="Current password"
                className="h-9 w-full border border-border rounded-md bg-bg-card px-3 text-sm" />
              <div className="flex gap-2">
                <input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New (8+ chars)"
                  type="password" aria-label="New password"
                  className="h-9 flex-1 border border-border rounded-md bg-bg-card px-3 text-sm" />
                <AppButton type="submit" size="sm" loading={busy === "pw"}>Update</AppButton>
              </div>
            </form>
            {status?.hasGoogle && <p className="text-[11px] text-text-muted">Google sign-in stays linked — either method works.</p>}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted px-1">
            {status?.hasGoogle ? "Signed in with Google only — add a password in Connected Accounts to enable email sign-in." : "Add a password in Connected Accounts, then you can change it here."}
          </p>
        )}
      </div>
    </div>
  );
}
