// V1-D parent confirmation strings (docs/engineering/V1-D-DESIGN.md §4.3).
// NOT in the approved V1 HTML: owner item C5. Kept in one place so the
// owner's approved wording replaces them in one edit.
const rewards = (n) => (n === 1 ? 'reward' : 'rewards');
export const REQUEST_COPY = {
  heading: (name) => `${name} asked for`,
  notNow: 'Not now',
  agree: (n) => `Agree to ${n} ${rewards(n)}`,
  agreed: (name, n) => `${name} can enjoy ${n} ${rewards(n)}.`,
};
