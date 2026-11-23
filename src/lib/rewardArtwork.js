// Owner-approved reward artwork (design/stage1/APPROVAL_REGISTER.json
// decisions.rewards; owner decision 2026-11-20, V1-D design §14). Eleven
// Streamline Plump Duo files, served unchanged from public/reward-art (CC BY
// 4.0 credit in public/licenses/CREDITS.txt), and the Phosphor book-bookmark
// for New book. src/test/rewardArtwork.test.js keeps this equal to the
// register and the files byte-identical to their sources.

// The picker group that holds them (provisional label, owner wording item A-1).
export const REWARD_ART_GROUP = 'Reward artwork';

export const REWARD_ARTWORK = [
  { id: 'streamline:plump:duo:computer-devices:controller-1', name: 'Gaming time', src: '/reward-art/controller-1.svg', source: 'design/assets/streamline/plump/duo/computer-devices/controller-1.svg' },
  { id: 'streamline:plump:duo:images-photography:film-slate', name: 'Movie night', src: '/reward-art/film-slate.svg', source: 'design/assets/streamline/plump/duo/images-photography/film-slate.svg' },
  { id: 'streamline:plump:duo:food-drink:ice-cream-2', name: 'Ice cream treat', src: '/reward-art/ice-cream-2.svg', source: 'design/assets/streamline/plump/duo/food-drink/ice-cream-2.svg' },
  { id: 'phosphor:book-bookmark:duotone', name: 'New book' },
  { id: 'streamline:plump:duo:map-travel:bicycle-bike', name: 'Bike ride', src: '/reward-art/bicycle-bike.svg', source: 'design/assets/streamline/plump/duo/map-travel/bicycle-bike.svg' },
  { id: 'streamline:plump:duo:interface-essential:give-gift', name: 'Gift', src: '/reward-art/give-gift.svg', source: 'design/assets/streamline/plump/duo/interface-essential/give-gift.svg' },
  { id: 'streamline:plump:duo:culture:ticket-1', name: 'Day out', src: '/reward-art/ticket-1.svg', source: 'design/assets/streamline/plump/duo/culture/ticket-1.svg' },
  { id: 'streamline:plump:duo:food-drink:cake-slice', name: 'Cake treat', src: '/reward-art/cake-slice.svg', source: 'design/assets/streamline/plump/duo/food-drink/cake-slice.svg' },
  { id: 'streamline:plump:duo:interface-essential:paintbrush-2', name: 'Art activity', src: '/reward-art/paintbrush-2.svg', source: 'design/assets/streamline/plump/duo/interface-essential/paintbrush-2.svg' },
  { id: 'streamline:plump:duo:images-photography:camera-1', name: 'Photo adventure', src: '/reward-art/camera-1.svg', source: 'design/assets/streamline/plump/duo/images-photography/camera-1.svg' },
  { id: 'streamline:plump:duo:entertainment:music-note-2', name: 'Music time', src: '/reward-art/music-note-2.svg', source: 'design/assets/streamline/plump/duo/entertainment/music-note-2.svg' },
  { id: 'streamline:plump:duo:map-travel:beach', name: 'Family outing', src: '/reward-art/beach.svg', source: 'design/assets/streamline/plump/duo/map-travel/beach.svg' },
];

const BY_ID = new Map(REWARD_ARTWORK.map((a) => [a.id, a]));
export const artworkOf = (id) => (id ? BY_ID.get(id) || null : null);
export const REWARD_ARTWORK_IDS = REWARD_ARTWORK.map((a) => a.id);
