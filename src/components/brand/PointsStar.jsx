import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// The points symbol. Decoration only: the number next to it carries the meaning.
export default function PointsStar({ className }) {
  return (
    <Star
      aria-hidden="true"
      strokeWidth={1.5}
      className={cn('inline-block h-4 w-4 shrink-0 fill-star text-star', className)}
    />
  );
}

// "★ 15": a compact points value.
export function Points({ value, className, starClassName }) {
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', className)}>
      <PointsStar className={starClassName} />
      {value}
    </span>
  );
}
