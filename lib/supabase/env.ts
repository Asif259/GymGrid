export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  return {
    url,
    key,
    gymName: process.env.NEXT_PUBLIC_GYM_NAME ?? 'GymGrid',
    defaultGymSlug: process.env.NEXT_PUBLIC_DEFAULT_GYM_SLUG ?? 'default-gym',
  };
}
