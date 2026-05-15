/**
 * Toronto neighborhood coordinates mapping
 *
 * Used to auto-set walker location from their selected Service Areas.
 * When walker saves Service Areas, the first area's coordinates become
 * their searchable location for the searchNearby query.
 *
 * Coordinates are approximate center points for each neighborhood.
 */

export interface NeighborhoodCoordinates {
  lat: number;
  lng: number;
}

export const TORONTO_NEIGHBORHOODS: Record<string, NeighborhoodCoordinates> = {
  // Core neighborhoods (from service-areas.tsx defaults)
  'Downtown Toronto': { lat: 43.6532, lng: -79.3832 },
  'High Park': { lat: 43.6465, lng: -79.4637 },
  'The Annex': { lat: 43.6711, lng: -79.404 },
  'Yorkville': { lat: 43.6703, lng: -79.3943 },
  'Liberty Village': { lat: 43.6387, lng: -79.4204 },
  'Queen West': { lat: 43.6477, lng: -79.4039 },
  'Leslieville': { lat: 43.6628, lng: -79.3339 },
  'Beaches': { lat: 43.6762, lng: -79.2953 },

  // Additional neighborhoods (for future expansion)
  'King West': { lat: 43.6441, lng: -79.3996 },
  'Kensington Market': { lat: 43.6547, lng: -79.4024 },
  'Little Italy': { lat: 43.6551, lng: -79.4205 },
  'Roncesvalles': { lat: 43.6488, lng: -79.4499 },
  'Junction': { lat: 43.6649, lng: -79.4673 },
  'Parkdale': { lat: 43.6391, lng: -79.4429 },
  'Riverdale': { lat: 43.6685, lng: -79.3476 },
  'Danforth': { lat: 43.6788, lng: -79.3524 },
  'St. Lawrence Market': { lat: 43.6487, lng: -79.3715 },
  'Distillery District': { lat: 43.6503, lng: -79.3596 },
  'Cabbagetown': { lat: 43.6668, lng: -79.3644 },
  'Church-Wellesley': { lat: 43.6657, lng: -79.3806 },
  'Entertainment District': { lat: 43.6465, lng: -79.3897 },
  'Financial District': { lat: 43.6488, lng: -79.3811 },
  'Harbourfront': { lat: 43.6389, lng: -79.3817 },
  'Midtown': { lat: 43.6992, lng: -79.3935 },
  'North York': { lat: 43.7615, lng: -79.4111 },
  'Etobicoke': { lat: 43.6205, lng: -79.5132 },
  'Scarborough': { lat: 43.7731, lng: -79.2578 },
};

/**
 * Get coordinates for a neighborhood name.
 * Returns undefined if neighborhood not found.
 */
export function getNeighborhoodCoordinates(
  name: string,
): NeighborhoodCoordinates | undefined {
  return TORONTO_NEIGHBORHOODS[name];
}

/**
 * Get coordinates for the first matching neighborhood from a list.
 * Useful for determining walker's primary location from their service areas.
 */
export function getFirstMatchingCoordinates(
  serviceAreas: string[],
): NeighborhoodCoordinates | undefined {
  for (const area of serviceAreas) {
    const coords = TORONTO_NEIGHBORHOODS[area];
    if (coords) {
      return coords;
    }
  }
  return undefined;
}
