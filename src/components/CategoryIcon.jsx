import { iconFor } from '@/lib/categoryIcons';
import { cn } from '@/lib/utils';

// One behaviour icon, drawn from its stored key. Unknown keys draw a circle.
export default function CategoryIcon({ iconKey, className }) {
  const Icon = iconFor(iconKey);
  return <Icon className={cn('w-4 h-4 shrink-0', className)} aria-hidden="true" />;
}
