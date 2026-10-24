/**
 * Row density: "comfortable" (default) or "compact" for long tables.
 * Stored in localStorage and applied as a data attribute on <html>, so the
 * CSS in globals.css can tighten every row without prop drilling.
 */
export type Density = "comfortable" | "compact";

const KEY = "hoplane:density";

export function getDensity(): Density {
  try {
    return localStorage.getItem(KEY) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

export function applyDensity(density: Density = getDensity()): void {
  document.documentElement.dataset.density = density;
}

export function setDensity(density: Density): void {
  try {
    localStorage.setItem(KEY, density);
  } catch {
    // private mode: the attribute still applies for this session
  }
  applyDensity(density);
}
