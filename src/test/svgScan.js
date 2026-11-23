// Shared SVG active-content scan (E01 brandAssets, E03 approvedIcons).
// Anything that could run, fetch or embed is refused. Internal url(#id) is the
// only reference the kit uses (its gradient).
export function svgProblems(text) {
  const out = [];
  const rules = [
    [/<script/i, 'script'], [/<foreignObject/i, 'foreignObject'], [/<image\b/i, 'image'],
    [/\b(xlink:)?href\s*=/i, 'href'], [/@import/i, '@import'], [/\son[a-z]+\s*=/i, 'event handler'],
    [/url\(\s*(?!['"]?#)/i, 'external url()'], [/<!ENTITY/i, 'entity'],
  ];
  for (const [re, label] of rules) if (re.test(text)) out.push(label);
  return out;
}

