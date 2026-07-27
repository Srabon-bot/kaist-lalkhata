// Server-side re-verification of the Google identity a client claims —
// the client (src/lib/googleAuth.ts) gets an OAuth access token via Google
// Identity Services and could in principle lie about what it decoded from
// it, so the server independently asks Google's own userinfo endpoint
// rather than trusting client-submitted email/sub fields directly.

export interface GoogleIdentity {
  email: string;
  sub: string;
  name: string | null;
}

export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleIdentity> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("GOOGLE_TOKEN_INVALID");

  const data = (await res.json()) as { email?: string; sub?: string; name?: string };
  if (!data.email || !data.sub) throw new Error("GOOGLE_TOKEN_INVALID");

  return { email: data.email, sub: data.sub, name: data.name ?? null };
}
