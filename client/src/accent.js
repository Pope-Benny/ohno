export const ACCENTS = {
  lime: { label: 'Lime', value: 'oklch(0.82 0.18 115)' },
  yellow: { label: 'Yellow', value: 'oklch(0.86 0.16 90)' },
  orange: { label: 'Orange', value: 'oklch(0.78 0.16 55)' },
  red: { label: 'Red', value: 'oklch(0.72 0.2 20)' },
  pink: { label: 'Pink', value: 'oklch(0.8 0.15 350)' },
  purple: { label: 'Purple', value: 'oklch(0.7 0.18 300)' },
  blue: { label: 'Blue', value: 'oklch(0.72 0.14 240)' },
  teal: { label: 'Teal', value: 'oklch(0.78 0.12 185)' },
};

export const DEFAULT_ACCENT = 'lime';

export function accentValue(key) {
  const a = ACCENTS[key] || ACCENTS[DEFAULT_ACCENT];
  return a.value;
}