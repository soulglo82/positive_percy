// V1.1 building blocks for Home and Children (design/v11, owner review of
// 23 Nov 2026). Styles: src/styles/percy-v11.css. These only draw: every
// figure is passed in from the server data the pages already load.
import { useEffect, useRef, useState } from 'react';
import { logoSrc } from '@/components/brand/logoArt';
import { CHILD_COLOURS, childColour } from '@/lib/childColour';

// The child's own colour as a V1.1 class (written in full for the token check).
const KID_CLASS = ['pv-kid-1', 'pv-kid-2', 'pv-kid-3', 'pv-kid-4', 'pv-kid-5', 'pv-kid-6'];
export function kidClass(child, children) {
  const i = CHILD_COLOURS.indexOf(childColour(child, children));
  return i < 0 ? '' : KID_CLASS[i];
}

// ChildAvatar, photo first. A missing or broken photo shows the initial at
// exactly the same size. decorative: the name is shown beside it.
export function PercyAvatar({ child, children, size = 'other', ring = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [child.avatar_url]);
  const url = !failed && child.avatar_url;
  return (
    <span className={`pv-avatar ${kidClass(child, children)}`} data-size={size} data-ring={ring ? '' : undefined}
      data-avatar={url ? 'photo' : 'initial'} aria-hidden="true">
      {url ? <img src={url} alt="" onError={() => setFailed(true)} /> : (child.name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

// ChildSelector: a sideways scroller, names always shown, nothing shrinks.
// emphasise: the selected child is drawn larger (Home); on Children the
// profile photo below carries the emphasis instead.
export function ChildSelector({ children, selectedId, onSelect, emphasise = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const on = el && el.querySelector('[aria-pressed="true"]');
    if (!on || typeof el.scrollTo !== 'function') return;
    el.scrollTo({ left: Math.max(0, on.offsetLeft - el.offsetLeft - (el.clientWidth - on.offsetWidth) / 2) });
  }, [selectedId]);
  if (children.length < 2) return null;
  return (
    <div ref={ref} className="pv-selector" role="group" aria-label="Choose a child">
      {children.map((c) => {
        const on = c.id === selectedId;
        return (
          <button key={c.id} type="button" className="pv-selector__item" aria-pressed={on} title={c.name} onClick={() => onSelect(c.id)}>
            <PercyAvatar child={c} children={children} size={on && emphasise ? 'selected' : 'other'} ring={on} />
            <span className="pv-selector__name">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// PercyHeroSlot. Screens ask for a stable pose key (design/v11/fox1a/
// asset-manifest.json); until owner-approved pose artwork exists, every key
// shows the seated Fox 1A file, unaltered and never mirrored.
const POSE_ART = { seated: logoSrc('symbol', 'full') };
export function PercyFox({ pose = 'seated', size = 'mid', play = 0 }) {
  const resolved = POSE_ART[pose] ? pose : 'seated';
  return (
    <span className="pv-fox" data-size={size} data-pose={pose} data-resolved={resolved} data-motion={play ? 'award' : undefined} aria-hidden="true">
      {/* A new key restarts the one-shot hop after each award. */}
      <img key={play} src={POSE_ART[resolved]} alt="" decoding="async" />
    </span>
  );
}

// PercyProgressRing. The arc is clamped to full; the figure shown beside it
// never is. No denominator (0 or missing): a dashed neutral ring, no fraction.
// progress: optional { label, valueText } to expose the ring as a progressbar.
export function ProgressRing({ metric, value, max, icon, doneIcon, progress }) {
  const r = 42, c = 2 * Math.PI * r;
  const has = Number.isFinite(max) && max > 0 && Number.isFinite(value);
  const frac = has ? Math.min(1, Math.max(0, value / max)) : 0;
  const full = has && value >= max;
  const aria = progress ? {
    role: 'progressbar', 'aria-label': progress.label, 'aria-valuemin': 0, 'aria-valuemax': Math.max(max || 0, 0),
    'aria-valuenow': has ? Math.max(0, Math.min(value, max)) : 0, 'aria-valuetext': progress.valueText,
  } : { 'aria-hidden': 'true' };
  return (
    <span className="pv-ring" data-metric={metric} data-empty={has ? undefined : ''} data-full={full ? '' : undefined} {...aria}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="pv-ring__track" cx="50" cy="50" r={r} strokeWidth="10" />
        {has && frac > 0 && (
          <circle className="pv-ring__value" cx="50" cy="50" r={r} strokeWidth="10"
            strokeDasharray={c.toFixed(2)} strokeDashoffset={(c * (1 - frac)).toFixed(2)} data-ring-value />
        )}
      </svg>
      <span className="pv-ring__centre" aria-hidden="true">{full && doneIcon ? doneIcon : icon}</span>
    </span>
  );
}

export function JourneyStop({ ring, label, value, max, unit, note, tone, children: extra }) {
  const has = Number.isFinite(max) && max > 0;
  return (
    <li className="pv-stop">
      {ring}
      <div>
        <p className="pv-stop__label">{label}</p>
        {/* The figure is always shown, never clamped; "of N" only when there is an N. */}
        {has ? (
          <p className="pv-stop__figure"><span className="pv-t-number-sm">{value}</span> <small>of {max} {unit}</small></p>
        ) : Number.isFinite(value) && value > 0 ? (
          <p className="pv-stop__figure"><span className="pv-t-number-sm">{value}</span> <small>{unit}</small></p>
        ) : null}
        <p className="pv-stop__note" data-tone={tone || undefined}>{note}</p>
        {extra}
      </div>
    </li>
  );
}

// Scene shapes. Simple code-drawn placeholders for the illustrated look; they
// are not illustrator artwork (design/v11/HANDBACK.md).
export function MorningArt() {
  return (
    <svg className="pv-scene__art" viewBox="0 0 400 300" preserveAspectRatio="xMinYMax slice" aria-hidden="true" focusable="false">
      <circle className="pv-art-halo" cx="40" cy="300" r="150" />
      <circle className="pv-art-sun" cx="40" cy="300" r="104" />
    </svg>
  );
}
export function SkyArt() {
  return (
    <svg className="pv-scene__art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <path className="pv-art-hill" d="M0 300V236C70 196 150 206 220 232s130 22 180-12v80z" />
    </svg>
  );
}
export function Flag() {
  return (
    <svg className="pv-destination__flag" width="44" height="72" viewBox="0 0 44 72" aria-hidden="true" focusable="false">
      <rect className="pole" x="6" y="4" width="5" height="68" rx="2.5" />
      <path className="pennant" d="M11 8h27l-8 11 8 11H11z" />
    </svg>
  );
}
