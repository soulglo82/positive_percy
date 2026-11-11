import { clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge must know our own scale names, or it treats text-title and
// text-total as colours and drops one of the two (Batch D review finding).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['title', 'total'] }], // tokens-allow: tailwind-merge group name, not a class
      'text-color': [{ text: ['subtle-foreground', 'negative', 'spend', 'earn', 'star', 'brand-ink'] }], // tokens-allow: tailwind-merge group name, not a class
      shadow: [{ shadow: ['', 'none'] }],
    },
  },
})

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const isIframe = window.self !== window.top;
