import type { County } from './types';

/**
 * County centroids. v1 distance is approximate: the search origin is the
 * centroid of the chosen county (or the county a ZIP prefix maps to). Results
 * always say "about X miles" — never claim precision we don't have.
 */
export const countyCentroids: Record<County, { lat: number; lng: number }> = {
  bronx: { lat: 40.8448, lng: -73.8648 },
  kings: { lat: 40.6782, lng: -73.9442 },
  'new-york': { lat: 40.7831, lng: -73.9712 },
  queens: { lat: 40.7282, lng: -73.7949 },
  richmond: { lat: 40.5795, lng: -74.1502 },
  nassau: { lat: 40.729, lng: -73.5895 },
  westchester: { lat: 41.122, lng: -73.7949 },
};

/** First-3-digit ZIP prefix → county, for the NYC metro coverage area. */
const zipPrefixToCounty: Record<string, County> = {
  '100': 'new-york',
  '101': 'new-york',
  '102': 'new-york',
  '103': 'richmond',
  '104': 'bronx',
  '105': 'westchester',
  '106': 'westchester',
  '107': 'westchester',
  '108': 'westchester',
  '110': 'nassau',
  '111': 'queens',
  '112': 'kings',
  '113': 'queens',
  '114': 'queens',
  '115': 'nassau',
  '116': 'queens',
};

export function zipToCounty(zip: string): County | null {
  return zipPrefixToCounty[zip.slice(0, 3)] ?? null;
}

export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
