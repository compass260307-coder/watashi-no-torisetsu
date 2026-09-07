export type PublicConfig = {
  apiBaseUrl: string | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  reviewLoginEnabled: boolean;
};

export function getPublicConfig(): PublicConfig {
  return {
    apiBaseUrl: normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL),
    supabaseUrl: nonEmpty(process.env.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: nonEmpty(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    reviewLoginEnabled: process.env.EXPO_PUBLIC_REVIEW_LOGIN_ENABLED === 'true',
  };
}

function normalizeBaseUrl(value: string | undefined) {
  const url = nonEmpty(value);
  return url ? url.replace(/\/$/, '') : null;
}

function nonEmpty(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
