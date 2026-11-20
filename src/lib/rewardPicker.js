// V1-D reward icon picker (docs/engineering/V1-D-DESIGN.md §4.2). Data from
// the owner approval register (picker.categories: 12 categories, 84
// placements, 71 icons; ux_choices.category_colour_mapping) and the approved
// V1 HTML (blob 9de1df2: APPROVED_PICKER_ICON_ALIASES, pickerItems,
// pickerLabel). src/test/rewardPicker.test.js keeps this equal to the
// register, server/rewardIcons.js and migration 015.

import { REWARD_ARTWORK, REWARD_ARTWORK_IDS, REWARD_ART_GROUP, artworkOf } from './rewardArtwork';

// Everyday words that also find an approved artwork (the same words the
// approved aliases give its Phosphor counterpart).
const ARTWORK_ALIASES = {
  'streamline:plump:duo:computer-devices:controller-1': 'game gaming controller',
  'streamline:plump:duo:images-photography:film-slate': 'movie cinema film night',
  'streamline:plump:duo:food-drink:ice-cream-2': 'ice cream dessert treat',
  'phosphor:book-bookmark:duotone': 'book reading story',
  'streamline:plump:duo:map-travel:bicycle-bike': 'bike cycling ride',
  'streamline:plump:duo:culture:ticket-1': 'outing show cinema day out',
  'streamline:plump:duo:food-drink:cake-slice': 'birthday celebration treat',
  'streamline:plump:duo:interface-essential:paintbrush-2': 'drawing painting creativity art',
};

export const PICKER_CATEGORIES = [
  { name: "Fun & games", accent: "orange", icons: ['phosphor:game-controller:duotone', 'phosphor:dice-five:duotone', 'phosphor:balloon:duotone', 'phosphor:basketball:duotone', 'phosphor:football:duotone', 'phosphor:bowling-ball:duotone', 'phosphor:puzzle-piece:duotone'] },
  { name: "Treats & food", accent: "orange", icons: ['phosphor:ice-cream:duotone', 'phosphor:cake:duotone', 'phosphor:cookie:duotone', 'phosphor:popcorn:duotone', 'phosphor:pizza:duotone', 'phosphor:hamburger:duotone'] },
  { name: "Outings", accent: "sunshine", icons: ['phosphor:mountains:duotone', 'phosphor:car:duotone', 'phosphor:airplane:duotone', 'phosphor:tent:duotone', 'phosphor:train:duotone', 'phosphor:bus:duotone', 'phosphor:bicycle:duotone', 'phosphor:ticket:duotone', 'phosphor:sun:duotone', 'phosphor:fire:duotone'] },
  { name: "Learning & growth", accent: "purple", icons: ['phosphor:music-notes:duotone', 'phosphor:lightbulb:duotone', 'phosphor:palette:duotone', 'phosphor:paint-brush:duotone', 'phosphor:notebook:duotone', 'phosphor:graduation-cap:duotone', 'phosphor:pencil:duotone', 'phosphor:books:duotone', 'phosphor:guitar:duotone', 'phosphor:microscope:duotone'] },
  { name: "Family & kindness", accent: "purple", icons: ['phosphor:smiley:duotone', 'phosphor:hands-clapping:duotone', 'phosphor:handshake:duotone', 'phosphor:medal:duotone', 'phosphor:hand-heart:duotone', 'phosphor:gift:duotone'] },
  { name: "Creative time", accent: "sunshine", icons: ['phosphor:paint-brush:duotone', 'phosphor:piano-keys:duotone', 'phosphor:film-slate:duotone', 'phosphor:music-notes:duotone', 'phosphor:scissors:duotone', 'phosphor:microphone:duotone', 'phosphor:pen:duotone'] },
  { name: "Tech & media", accent: "purple", icons: ['phosphor:game-controller:duotone', 'phosphor:watch:duotone', 'phosphor:television:duotone', 'phosphor:device-mobile:duotone'] },
  { name: "Things & pocket money", accent: "orange", icons: ['phosphor:backpack:duotone', 'phosphor:t-shirt:duotone', 'phosphor:piggy-bank:duotone', 'phosphor:money:duotone', 'phosphor:ticket:duotone'] },
  { name: "Nature & outdoors", accent: "sunshine", icons: ['phosphor:tree:duotone', 'phosphor:sun:duotone', 'phosphor:moon-stars:duotone', 'phosphor:paw-print:duotone', 'phosphor:butterfly:duotone', 'phosphor:fish:duotone', 'phosphor:mountains:duotone'] },
  { name: "Sports & movement", accent: "orange", icons: ['phosphor:basketball:duotone', 'phosphor:football:duotone', 'phosphor:soccer-ball:duotone', 'phosphor:bicycle:duotone', 'phosphor:tennis-ball:duotone', 'phosphor:person-simple-run:duotone', 'phosphor:ping-pong:duotone', 'phosphor:swimming-pool:duotone'] },
  { name: "Celebrations", accent: "sunshine", icons: ['phosphor:confetti:duotone', 'phosphor:sparkle:duotone', 'phosphor:crown:duotone', 'phosphor:medal:duotone', 'phosphor:trophy:duotone', 'phosphor:cake:duotone', 'phosphor:smiley-wink:duotone'] },
  { name: "Animals & pets", accent: "purple", icons: ['phosphor:cat:duotone', 'phosphor:dog:duotone', 'phosphor:fish:duotone', 'phosphor:butterfly:duotone', 'phosphor:rabbit:duotone', 'phosphor:bug:duotone', 'phosphor:cow:duotone'] },
];

// Everyday words that also find an icon (approved HTML, verbatim).
export const PICKER_ALIASES = {
  'game-controller': 'game gaming controller xbox playstation',
  'film-slate': 'movie cinema film night',
  'ice-cream': 'ice cream dessert treat',
  'book-open-text': 'reading books story',
  'books': 'book reading library',
  'bicycle': 'bike cycling ride',
  'piggy-bank': 'money savings pocket money',
  'paw-print': 'pet dog cat animal',
  'mountains': 'adventure outing hiking',
  'ticket': 'outing show cinema day out',
  'cake': 'birthday celebration treat',
  'palette': 'drawing painting creative art',
  'paint-brush': 'drawing painting creativity art',
};

const shortId = (assetId) => assetId.split(':')[1];

// "phosphor:game-controller:duotone" -> "Game Controller" (approved pickerLabel).
// Approved reward artwork is named by its approved reward name ("Gaming time").
export function pickerLabel(assetId) {
  const art = artworkOf(assetId);
  if (art) return art.name;
  return shortId(assetId).split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// The 71 distinct icons, in first-placement order.
export const PICKER_ICONS = [...new Set(PICKER_CATEGORIES.flatMap((c) => c.icons))];

// Approved pickerItems: an empty term shows the category; a term searches
// every category in order, each icon once, by its name and its aliases.
// The approved reward artwork comes first, as its own group (V1-D §14).
export function pickerItems(category, term) {
  const t = String(term || '').trim().toLowerCase();
  if (!t) return category === REWARD_ART_GROUP ? REWARD_ARTWORK_IDS : (PICKER_CATEGORIES.find((c) => c.name === category)?.icons || []);
  const art = REWARD_ARTWORK.filter((a) => (a.name.toLowerCase() + ' ' + (ARTWORK_ALIASES[a.id] || '')).includes(t)).map((a) => a.id);
  const seen = new Set();
  return art.concat(PICKER_CATEGORIES.flatMap((c) => c.icons).filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    const s = shortId(id);
    return (s.replace(/-/g, ' ') + ' ' + (PICKER_ALIASES[s] || '')).includes(t);
  }));
}

// Grid columns follow the owner-approved container breakpoints in
// src/index.css (.picker-container / .picker-grid), checked in the browser tests.

// Approved artwork has no category accent (null: no bar).
export const accentOf = (assetId) => (artworkOf(assetId) ? null : PICKER_CATEGORIES.find((c) => c.icons.includes(assetId))?.accent || 'purple');
