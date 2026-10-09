export const $ = (id) => document.getElementById(id);
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
