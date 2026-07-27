// Google Identity Services (GIS) — loaded lazily so pages that never touch
// auth don't pay for it. Uses the OAuth2 token-client flow (an access token
// via a popup) rather than GIS's own rendered button, so "Continue with
// Google" can be a normal button matching the rest of the app's styling.
//
// Requires a Google OAuth Client ID in VITE_GOOGLE_CLIENT_ID (create one
// free in Google Cloud Console — OAuth consent screen + a Web application
// client, with this app's origin(s) added under "Authorized JavaScript
// origins"). Nothing here has a client *secret* — this is a public,
// client-side-only identity check, appropriate for a backend-less app.

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

interface GoogleAccountsGlobal {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (resp: { access_token?: string; error?: string }) => void;
        error_callback?: (err: { type: string }) => void;
      }) => TokenClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleAccountsGlobal;
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function googleClientId(): string | null {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  return id && id.trim() ? id.trim() : null;
}

/** Opens the Google account picker/consent popup, resolves with an access
 * token. That token — not any claim decoded from it here — is what proves
 * identity: it's sent to api/auth/google.ts, which independently asks
 * Google's own userinfo endpoint who it belongs to rather than trusting
 * anything the client could have forged. */
export async function signInWithGoogle(): Promise<string> {
  const clientId = googleClientId();
  if (!clientId) throw new Error("GOOGLE_NOT_CONFIGURED");

  await loadScript();
  const google = window.google;
  if (!google?.accounts?.oauth2) throw new Error("GOOGLE_NOT_CONFIGURED");

  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error(resp.error ?? "GOOGLE_AUTH_FAILED"));
      },
      error_callback: () => reject(new Error("GOOGLE_AUTH_FAILED")),
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}
