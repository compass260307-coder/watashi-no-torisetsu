export type PublicConfig = {
  apiBaseUrl: string | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  reviewLoginEnabled: boolean;
  journalPrototypeEnabled: boolean;
  profilePrototypeEnabled: boolean;
  tarotPrototypeEnabled: boolean;
};

export function getPublicConfig(): PublicConfig {
  return {
    apiBaseUrl: normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL),
    supabaseUrl: nonEmpty(process.env.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: nonEmpty(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    reviewLoginEnabled: process.env.EXPO_PUBLIC_REVIEW_LOGIN_ENABLED === 'true',
    journalPrototypeEnabled:
      process.env.EXPO_PUBLIC_ALICE_JOURNAL_PROTOTYPE_ENABLED === 'true',
    profilePrototypeEnabled:
      process.env.EXPO_PUBLIC_ALICE_PROFILE_PROTOTYPE_ENABLED === 'true',
    tarotPrototypeEnabled:
      process.env.EXPO_PUBLIC_ALICE_TAROT_PROTOTYPE_ENABLED === 'true',
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
