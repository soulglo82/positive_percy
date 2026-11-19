// V1-D reward icon picker (approved design 9de1df2, screen "rewardform";
// register picker.ux_choices). Categories plus search; each icon once in
// search results; 3/5/6 columns by the picker's own width (index.css);
// category accents as a decorative bar, the icon always purple on white.
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PICKER_CATEGORIES, pickerItems, pickerLabel, accentOf } from '@/lib/rewardPicker';
import { PICKER_ICON_COMPONENTS } from './RewardIcon';

const ACCENT_BAR = { purple: 'bg-primary', orange: 'bg-sunrise', sunshine: 'bg-star' };

// "7 icons in Fun & games" / "1 icon matches your search" (approved wording,
// singular for one: owner item C6).
export function countLine(n, category, searching) {
  const noun = n === 1 ? 'icon' : 'icons';
  return searching ? `${n} ${noun} ${n === 1 ? 'matches' : 'match'} your search` : `${n} ${noun} in ${category}`;
}

export default function RewardPicker({ value, onChange, id }) {
  // Opens on the chosen icon's category, so its pressed tile is in view.
  const [category, setCategory] = useState(() => (PICKER_CATEGORIES.find((c) => c.icons.includes(value)) || PICKER_CATEGORIES[0]).name);
  const [term, setTerm] = useState('');
  const searchId = useId();
  const searching = term.trim().length > 0;
  const ids = pickerItems(category, term);
  const accentFor = (id) => (searching ? accentOf(id) : PICKER_CATEGORIES.find((c) => c.name === category).accent);

  return (
    <div id={id} className="picker-container space-y-3">
      <div className="space-y-2">
        <Label htmlFor={searchId}>Find an icon</Label>
        <Input id={searchId} type="search" value={term} autoComplete="off"
          placeholder="Search (e.g. movie, cake, games)" onChange={(e) => setTerm(e.target.value)} />
      </div>
      {/* Wraps instead of the approved sideways scroll: the app keeps no horizontal scrolling (WCAG 1.4.10 reflow). */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Icon categories">
        {PICKER_CATEGORIES.map((c) => (
          <button key={c.name} type="button" aria-pressed={!searching && category === c.name}
            onClick={() => { setCategory(c.name); setTerm(''); }}
            className={cn('min-h-11 rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              !searching && category === c.name ? 'border-2 border-selected-border bg-selected text-primary' : 'border border-border bg-card text-muted-foreground hover:bg-accent')}>
            {c.name}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">{countLine(ids.length, category, searching)}</p>
      {ids.length === 0 ? (
        <p className="py-5 text-center text-muted-foreground">No matching icons. Try a different word.</p>
      ) : (
        <div className="picker-grid" role="group" aria-label="Reward icons">
          {ids.map((id) => {
            const Icon = PICKER_ICON_COMPONENTS[id];
            const on = value === id;
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => onChange(id)} data-icon-tile={id}
                className={cn('relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg px-1 pb-2 pt-3 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  on ? 'border-2 border-selected-border bg-muted' : 'border border-border bg-card hover:bg-accent')}>
                <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1', ACCENT_BAR[accentFor(id)])} />
                <Icon className="h-7 w-7" />
                <span className="max-w-full break-words text-center text-xs font-semibold text-muted-foreground">{pickerLabel(id)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
