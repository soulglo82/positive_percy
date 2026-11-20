// V1-D: how a reward is drawn (docs/engineering/V1-D-DESIGN.md §10 R2).
// The parent's chosen picker icon (icon_key) wins, then an existing image,
// then the emoji, then a gift. Nothing is replaced in the data: a reward's
// image and emoji stay stored and show again if its icon is cleared.
import { approvedIcon } from '@/components/icons/PercyIcon';
import { PICKER_ICONS } from '@/lib/rewardPicker';
import { REWARD_ARTWORK, artworkOf } from '@/lib/rewardArtwork';
import { cn } from '@/lib/utils';

// One component per approved picker icon (approvedIcon validates each id).
export const PICKER_ICON_COMPONENTS = Object.fromEntries(PICKER_ICONS.map((id) => [id, approvedIcon(id)]));
const GiftIcon = approvedIcon('phosphor:gift:duotone');
// The approved reward artwork drawn as an icon (book-bookmark for New book).
const ARTWORK_ICON_COMPONENTS = Object.fromEntries(REWARD_ARTWORK.filter((a) => !a.src).map((a) => [a.id, approvedIcon(a.id)]));

// THE lookup for every reward icon id (V1-D §14.1 B1): approved artwork
// (an image file, or an icon) or one of the 71 picker icons; null otherwise.
export function rewardArt(id) {
  const art = artworkOf(id);
  if (art?.src) return { kind: 'image', src: art.src, name: art.name };
  if (art) return { kind: 'icon', Component: ARTWORK_ICON_COMPONENTS[id], name: art.name };
  const Component = id ? PICKER_ICON_COMPONENTS[id] : null;
  return Component ? { kind: 'icon', Component, name: null } : null;
}

// One rendering of an id's art at a given glyph size (decorative).
export function RewardArt({ art, className }) {
  if (art.kind === 'image') return <img src={art.src} alt="" aria-hidden="true" className={cn('object-contain', className)} />;
  const C = art.Component;
  return <C className={className} />;
}

// size: 'sm' 40px tile, 'md' 48px, 'lg' 56px. Always decorative: the reward's
// title sits beside it.
export default function RewardIcon({ reward, size = 'md', className }) {
  const box = size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-14 w-14' : 'h-12 w-12';
  const glyph = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-8 w-8' : 'h-7 w-7';
  const tile = cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-warning text-primary', box, className);
  const art = rewardArt(reward?.icon_key);
  if (art) return <span aria-hidden="true" className={tile} data-reward-icon={reward.icon_key}><RewardArt art={art} className={art.kind === 'image' ? 'h-[85%] w-[85%]' : glyph} /></span>;
  if (reward?.image_url) return <img src={reward.image_url} alt="" aria-hidden="true" className={cn(tile, 'object-cover')} />;
  if (reward?.emoji) return <span aria-hidden="true" className={cn(tile, 'text-lg')}>{reward.emoji}</span>;
  return <span aria-hidden="true" className={tile}><GiftIcon className={glyph} /></span>;
}
