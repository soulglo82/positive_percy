// V1-D parent confirmation strings (docs/engineering/V1-D-DESIGN.md §4.3).
// Owner-approved wording, C5 (2026-11-19, recorded on PR #59).
const rewards = (n) => (n === 1 ? 'reward' : 'rewards');
export const REQUEST_COPY = {
  heading: (name) => `${name} asked for`,
  notNow: 'Not this time',
  agree: (n) => `Approve ${n} ${rewards(n)}`,
  // The exact total of the requests being approved (the same items and
  // prices the confirmation sends; a change is refused, never charged).
  total: (total, name) => `This will spend ${total} ${total === 1 ? 'point' : 'points'} from ${name}'s balance.`,
  // Owner-approved 2026-11-20: the success and removal messages.
  agreed: (name, n) => `Approved ${n} ${rewards(n)} for ${name}.`,
  removed: (reward, name) => `Removed ${reward} from ${name}'s requests.`,
  changed: 'The requests changed. Check them again.',
};
