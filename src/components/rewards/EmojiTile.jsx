import { cn } from '@/lib/utils';

// Reward and goal emoji sit in a neutral 40px tile (Batch D: they stay emoji).
export default function EmojiTile({ emoji, className }) {
  return (
    <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg', className)} aria-hidden="true">
      {emoji || '🎁'}
    </span>
  );
}
