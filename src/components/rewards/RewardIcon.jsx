// V1-D: how a reward is drawn (docs/engineering/V1-D-DESIGN.md §10 R2).
// The parent's chosen picker icon (icon_key) wins, then an existing image,
// then the emoji, then a gift. Nothing is replaced in the data: a reward's
// image and emoji stay stored and show again if its icon is cleared.
import { approvedIcon } from '@/components/icons/PercyIcon';
import { PICKER_ICONS } from '@/lib/rewardPicker';
import { cn } from '@/lib/utils';

// One component per approved picker icon (approvedIcon validates each id).
export const PICKER_ICON_COMPONENTS = Object.fromEntries(PICKER_ICONS.map((id) => [id, approvedIcon(id)]));
const GiftIcon = approvedIcon('phosphor:gift:duotone');

// size: 'sm' 40px tile, 'md' 48px, 'lg' 56px. Always decorative: the reward's
// title sits beside it.
export default function RewardIcon({ reward, size = 'md', className }) {
  const box = size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-14 w-14' : 'h-12 w-12';
  const glyph = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-8 w-8' : 'h-7 w-7';
  const tile = cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-warning text-primary', box, className);
  const Icon = reward?.icon_key ? PICKER_ICON_COMPONENTS[reward.icon_key] : null;
  if (Icon) return <span aria-hidden="true" className={tile} data-reward-icon={reward.icon_key}><Icon className={glyph} /></span>;
  if (reward?.image_url) return <img src={reward.image_url} alt="" aria-hidden="true" className={cn(tile, 'object-cover')} />;
  if (reward?.emoji) return <span aria-hidden="true" className={cn(tile, 'text-lg')}>{reward.emoji}</span>;
  return <span aria-hidden="true" className={tile}><GiftIcon className={glyph} /></span>;
}
