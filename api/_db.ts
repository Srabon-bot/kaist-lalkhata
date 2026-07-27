import { neon } from "@neondatabase/serverless";

/** Lazily creates the Neon HTTP client — safe to call per-request in an
 * Edge function (no persistent connection to manage), throws clearly if
 * DATABASE_URL hasn't been set yet rather than failing with an opaque
 * driver error. */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}
