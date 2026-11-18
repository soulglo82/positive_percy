import { cn } from '@/lib/utils';

// A child's photo, or their first initial on their own colour (Batch D v0.5).
// `colour` comes from childColour(); without it the avatar is neutral.
// decorative: the name is shown beside it, so the photo is hidden from
// assistive tech (E05: a chip reads "Sam", not "Sam Sam").
export default function ChildAvatar({ name, url, size = 'md', colour, className, decorative = false }) {
  const box = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-title' : 'w-12 h-12 text-lg';
  const ring = colour ? cn('ring-2 ring-offset-2 ring-offset-card', colour.ring) : '';
  if (url) {
    return <img src={url} alt={decorative ? '' : (name || '')} aria-hidden={decorative ? 'true' : undefined} className={cn(box, 'rounded-full object-cover shrink-0', ring, className)} />;
  }
  return (
    <div className={cn(box, 'rounded-full font-display font-bold text-foreground flex items-center justify-center shrink-0', colour ? colour.soft : 'bg-selected', ring, className)} aria-hidden="true">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}
