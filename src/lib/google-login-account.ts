// Resolve a verified Google email without overwriting an existing identity.
// The store boundary keeps these rules testable without touching the database.
interface Account { id: string; email: string | null }
interface AccountStore {
  findByEmail(email: string): Promise<{ id: string } | null>;
  claimAnonymous(id: string, email: string): Promise<{ id: string } | null>;
  create(email: string): Promise<{ id: string }>;
}

export async function resolveGoogleLoginAccount(
  email: string,
  current: Account | null,
  store: AccountStore,
): Promise<{ id: string }> {
  const existing = await store.findByEmail(email);
  if (existing) return existing;
  if (current && current.email === null) {
    const claimed = await store.claimAnonymous(current.id, email);
    if (!claimed) throw new Error("Anonymous account changed during Google login");
    return claimed;
  }
  // A different signed-in identity is left intact; the existing completion
  // flow asks for confirmation before switching to this new account.
  return store.create(email);
}
