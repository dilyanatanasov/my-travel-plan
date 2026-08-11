/*
  Remembers that this device has signed in at least once.

  Without it, an expired session on a returning user's device is
  indistinguishable from a first visit, and they would be silently handed a
  fresh empty guest map — which looks exactly like their travel history being
  deleted. Knowing an account exists, we send them to /login instead.

  This lives apart from authApi because the base query needs it too, and
  authApi imports the base query — reaching back would be a cycle.
*/
const ACCOUNT_KNOWN_KEY = 'contrail-account-known';

export function hasKnownAccount(): boolean {
  try {
    return localStorage.getItem(ACCOUNT_KNOWN_KEY) === '1';
  } catch {
    // Private mode or blocked storage: fall back to guest, never to a
    // redirect loop.
    return false;
  }
}

export function rememberAccount(): void {
  try {
    localStorage.setItem(ACCOUNT_KNOWN_KEY, '1');
  } catch {
    /* non-fatal */
  }
}

export function forgetAccount(): void {
  try {
    localStorage.removeItem(ACCOUNT_KNOWN_KEY);
  } catch {
    /* non-fatal */
  }
}
