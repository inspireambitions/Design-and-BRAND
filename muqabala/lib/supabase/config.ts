export function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function serverSupabaseConfig() {
  const publicConfig = publicSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  return publicConfig && secretKey ? { ...publicConfig, secretKey } : null;
}
