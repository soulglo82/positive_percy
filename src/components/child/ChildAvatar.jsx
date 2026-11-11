import { cn } from '@/lib/utils';

// A child's photo, or their first initial on a solid tile.
export default function ChildAvatar({ name, url, size = 'md', className }) {
  const box = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-title' : 'w-12 h-12 text-lg';
  if (url) {
    return <img src={url} alt={name || ''} className={cn(box, 'rounded-full object-cover shrink-0', className)} />;
  }
  return (
    <div className={cn(box, 'rounded-full bg-selected text-foreground font-semibold flex items-center justify-center shrink-0', className)} aria-hidden="true">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}
