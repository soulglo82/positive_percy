// Invite links put the family code after '#', which browsers never send to
// the server, so the code stays out of server and proxy logs.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_HASH = new RegExp(`^#([${CODE_CHARS}]{6})$`, 'i');

// Returns the code from an invite link, or null. Always clears a matching
// hash from the address bar so the code isn't left in history or a reshare.
export function takeInviteCode() {
  if (typeof window === 'undefined') return null;
  const match = INVITE_HASH.exec(window.location.hash || '');
  if (!match) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return match[1].toUpperCase();
}
