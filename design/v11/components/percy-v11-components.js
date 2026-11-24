/* Positive Percy V1.1 component renderers (design prototype only).
 * Version 0.1.0 · Issued 2026-11-23 · Status: PROPOSAL (stop gate P2).
 * Plain functions that return markup, shared by the showcase and the Home /
 * Children prototype so both show exactly the same components.
 * Placeholders in double braces are filled by design/v11/build.mjs from repo sources.
 */
const PV = (() => {
  const ICONS = {
    'house-line': `{{icon:house-line}}`, users: `{{icon:users}}`, 'chart-line-up': `{{icon:chart-line-up}}`,
    gift: `{{icon:gift}}`, gear: `{{icon:gear}}`, heart: `{{icon:heart}}`, handshake: `{{icon:handshake}}`,
    'shield-star': `{{icon:shield-star}}`, mountains: `{{icon:mountains}}`, check: `{{icon:check}}`,
    'check-circle': `{{icon:check-circle}}`, target: `{{icon:target}}`, 'piggy-bank': `{{icon:piggy-bank}}`,
    trophy: `{{icon:trophy}}`, medal: `{{icon:medal}}`, pencil: `{{icon:pencil}}`, 'calendar-dots': `{{icon:calendar-dots}}`,
    'caret-down': `{{icon:caret-down}}`, sparkle: `{{icon:sparkle}}`, bicycle: `{{icon:bicycle}}`, camera: `{{icon:camera}}`,
    'plus-circle': `{{icon:plus-circle}}`, 'list-checks': `{{icon:list-checks}}`, fish: `{{icon:fish}}`, info: `{{icon:info}}`,
    'calendar-check': `{{icon:calendar-check}}`, 'book-open-text': `{{icon:book-open-text}}`, broom: `{{icon:broom}}`, 'hand-heart': `{{icon:hand-heart}}`,
  };
  const FOX_SRC = `{{img:public/brand/fox-1a-symbol-full.svg}}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n) => ICONS[n] || '';

  // ChildAvatar: photo first, initial fallback at the same size. A photo that
  // fails to load swaps to the fallback (see the error listener at the bottom).
  function avatar(child, size = 'other', { ring = false } = {}) {
    const initial = esc((child.name || '?').trim().charAt(0).toUpperCase());
    const img = child.photo ? `<img src="${esc(child.photo)}" alt="" data-avatar-img>` : '';
    return `<span class="pv-avatar" data-size="${size}" data-kid="${child.kid}"${ring ? ' data-ring' : ''} aria-hidden="true">${img || initial}<template>${initial}</template></span>`;
  }

  // ChildSelector: horizontal, scrollable, names always shown.
  function selector(children, selectedId, { emphasise = true } = {}) {
    if (children.length < 2) return '';
    return `<div class="pv-selector" role="group" aria-label="Choose a child">${children.map((c) => {
      const on = c.id === selectedId;
      return `<button type="button" class="pv-selector__item" data-select-child="${c.id}" aria-pressed="${on}" title="${esc(c.name)}">${avatar(c, on && emphasise ? 'selected' : 'other', { ring: on })}<span class="pv-selector__name">${esc(c.name)}</span></button>`;
    }).join('')}</div>`;
  }

  function quickTile(b, childName) {
    return `<button type="button" class="pv-quick-tile" data-tint="${b.tint}" data-quick="${esc(b.name)}"><span class="pv-medallion">${icon(b.icon)}</span><span class="pv-quick-tile__points"><span class="pv-sr">Give ${esc(childName)} </span>+${b.points}<span class="pv-sr"> for</span></span><span class="pv-quick-tile__label">${esc(b.name)}</span></button>`;
  }

  function goalRow(g) {
    const done = g.done ? ' data-done' : '';
    return `<li class="pv-goal"${done} data-goal="${g.id}">
      <button type="button" class="pv-goal__check" data-goal-toggle="${g.id}" aria-pressed="${!!g.done}" aria-label="${g.done ? 'Completed' : 'Mark complete'}: ${esc(g.title)}"><span>${icon('check')}</span></button>
      <div><p class="pv-goal__title">${esc(g.title)}</p><p class="pv-goal__meta">${g.done ? `Done, +${g.points} point${g.points === 1 ? '' : 's'}` : `+${g.points} point${g.points === 1 ? '' : 's'} when done`}</p></div>
      ${g.done ? `<button type="button" class="pv-goal__undo" data-goal-toggle="${g.id}" aria-label="Undo ${esc(g.title)}">Undo</button>` : ''}
    </li>`;
  }

  // PercyProgressRing: the arc is clamped to 0..1; the number shown beside it never is.
  // A zero or missing denominator draws the neutral dashed ring, never a percentage.
  function ring({ metric, value, max, iconName }) {
    const r = 42, c = 2 * Math.PI * r;
    const has = Number.isFinite(max) && max > 0 && Number.isFinite(value);
    const frac = has ? Math.min(1, Math.max(0, value / max)) : 0;
    const full = has && value >= max;
    return `<span class="pv-ring" data-metric="${metric}"${has ? '' : ' data-empty'}${full ? ' data-full' : ''} aria-hidden="true">
      <svg viewBox="0 0 100 100"><circle class="pv-ring__track" cx="50" cy="50" r="${r}" stroke-width="10"/>${has && frac > 0 ? `<circle class="pv-ring__value" cx="50" cy="50" r="${r}" stroke-width="10" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - frac)).toFixed(2)}"/>` : ''}</svg>
      <span class="pv-ring__centre">${icon(full ? 'check-circle' : iconName)}</span></span>`;
  }

  function stop({ metric, value, max, iconName, label, unit, note, tone, action }) {
    const has = Number.isFinite(max) && max > 0;
    return `<li class="pv-stop">${ring({ metric, value, max, iconName })}<div>
      <p class="pv-stop__label">${esc(label)}</p>
      ${has ? `<p class="pv-stop__figure"><span class="pv-t-number-sm">${value}</span><small>of ${max} ${esc(unit)}</small></p>` : ''}
      <p class="pv-stop__note"${tone ? ` data-tone="${tone}"` : ''}>${esc(note)}</p>${action || ''}</div></li>`;
  }

  function achievement({ state, iconName, title, text }) {
    return `<li class="pv-achievement" data-state="${state}"><span class="pv-medallion">${icon(iconName)}</span><div><p class="pv-t-card">${esc(title)}</p><p class="pv-t-support">${esc(text)}</p></div></li>`;
  }

  function manageAction({ id, iconName, label, text }) {
    return `<li><button type="button" class="pv-manage-action" data-manage="${id}"><span class="pv-medallion">${icon(iconName)}</span><span><span class="pv-manage-action__label">${esc(label)}</span><br><span class="pv-t-support">${esc(text)}</span></span><span class="pv-manage-action__caret">${icon('caret-down')}</span></button></li>`;
  }

  // PercyHeroSlot: resolves a stable fox1a.<pose> key. Until source-faithful
  // pose artwork exists, every key resolves to the seated master (the fallback
  // docs/brand/FOX_1A_POSE_LIBRARY.md requires).
  const POSES = { seated: FOX_SRC };
  function fox({ pose = 'seated', size = 'mid', alt = '' } = {}) {
    const src = POSES[pose] || POSES.seated;
    return `<span class="pv-fox" data-size="${size}" data-pose="${pose}" data-resolved="${POSES[pose] ? pose : 'seated'}"><img src="${src}" alt="${esc(alt)}"${alt ? '' : ' aria-hidden="true"'}></span>`;
  }

  // BiggerGoalDestination: one named goal, saved / cost. Saved points are their
  // own figure and are never derived from the available balance.
  const FLAG = `<svg class="pv-destination__flag" width="44" height="72" viewBox="0 0 44 72" aria-hidden="true"><rect x="6" y="4" width="5" height="68" rx="2.5" fill="var(--pv-purple)"/><path d="M11 8h27l-8 11 8 11H11z" fill="var(--pv-orange)"/></svg>`;
  function destination(b, { headingId = 'dest-title' } = {}) {
    if (!b) return `<div class="pv-card pv-stop">${ring({ metric: 'goal', value: 0, max: 0, iconName: 'gift' })}<div><p class="pv-stop__label">No bigger goal yet</p><p class="pv-stop__note">Mark a reward as a bigger goal to start saving for it.</p><a class="pv-goal__undo" href="#rewards" style="display:inline-flex;align-items:center">Choose a reward</a></div></div>`;
    const left = Math.max(0, b.cost - b.saved);
    return `<article class="pv-destination" aria-labelledby="${headingId}">
      <div class="pv-destination__scene"><div style="display:grid;gap:var(--pv-space-1);padding-bottom:var(--pv-space-3)"><p class="pv-t-meta" style="color:var(--pv-ink)">Bigger goal</p><h3 class="pv-t-card pv-wrap" id="${headingId}">${esc(b.name)}</h3></div>${FLAG}</div>
      <div class="pv-destination__body">
        <div class="pv-stop">${ring({ metric: 'goal', value: b.saved, max: b.cost, iconName: b.icon })}<div><p class="pv-stop__figure"><span class="pv-t-number-sm">${b.saved}</span><small>of ${b.cost} points saved</small></p><p class="pv-stop__note"${left ? '' : ' data-tone="earn"'}>${left ? `${left} to go` : 'Fully saved. Ready to redeem.'}</p></div></div>
        <button type="button" class="pv-btn pv-btn--secondary pv-btn--block" data-info="Savings|Opens the V1 Savings dialog (save, release, reassign, redeem, each with its confirmation). Unchanged from V1.">${icon('piggy-bank')}Manage savings</button>
      </div></article>`;
  }

  const TABS = [['home', 'Home', 'house-line'], ['children', 'Children', 'users'], ['activity', 'Activity', 'chart-line-up'], ['rewards', 'Rewards', 'gift'], ['settings', 'Settings', 'gear']];
  function nav(active, logoSrc) {
    return `<nav class="pv-nav" aria-label="Main">${logoSrc ? `<img class="pv-nav__logo" src="${logoSrc}" alt="Positive Percy">` : ''}<ul>${TABS.map(([id, label, ic]) => `<li><a class="pv-nav__tab" href="#${id}"${id === active ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a></li>`).join('')}</ul></nav>`;
  }

  // A photo that cannot load falls back to the initial, same size.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.hasAttribute('data-avatar-img')) return;
    const a = img.closest('.pv-avatar');
    a.textContent = a.querySelector('template').innerHTML;
    a.setAttribute('data-photo-failed', '');
  }, true);

  // Keep the selected child in view when the selector scrolls.
  function revealSelected(root = document) {
    root.querySelectorAll('.pv-selector').forEach((sel) => {
      const on = sel.querySelector('[aria-pressed="true"]'); if (!on) return;
      sel.scrollLeft = Math.max(0, on.offsetLeft - sel.offsetLeft - (sel.clientWidth - on.offsetWidth) / 2);
    });
  }

  return { icon, esc, avatar, selector, quickTile, goalRow, ring, stop, destination, achievement, manageAction, fox, nav, revealSelected, FOX_SRC };
})();
