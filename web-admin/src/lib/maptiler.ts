export const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY || "";
export const MAPTILER_STYLE = import.meta.env.VITE_MAPTILER_STYLE || "streets-v2";

export const hasMapTiler = MAPTILER_API_KEY.length > 0;

export const mapTilerStyleUrl = hasMapTiler
  ? `https://api.maptiler.com/maps/${MAPTILER_STYLE}/style.json?key=${MAPTILER_API_KEY}`
  : "";
