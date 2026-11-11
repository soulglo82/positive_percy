import { cn } from '@/lib/utils';

// Fox-and-star mark. With `wordmark`, the name sits beside it in brand ink.
export default function Logo({ size = 32, wordmark = false, decorative = false, className }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <img
        src="/logo-mark.png"
        alt={wordmark || decorative ? '' : 'Positive Percy'}
        width={size}
        height={size}
        className="shrink-0 object-contain"
      />
      {wordmark && <span className="text-base font-semibold text-brand-ink whitespace-nowrap">Positive Percy</span>}
    </span>
  );
}
