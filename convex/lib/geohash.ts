const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lng: number, precision = 6) {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        idx = (idx << 1) + 1;
        lngMin = mid;
      } else {
        idx = idx << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = (idx << 1) + 1;
        latMin = mid;
      } else {
        idx = idx << 1;
        latMax = mid;
      }
    }

    evenBit = !evenBit;
    bit += 1;

    if (bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

const NEIGHBORS = {
  right: ['bc01fg45238967deuvhjyznpkmstqrwx', 'p0r21436x8zb9dcf5h7kjnmqesgutwvy'],
  left: ['238967debc01fg45kmstqrwxuvhjyznp', '14365h7k9dcfesgujnmqp0r2twvyx8zb'],
  top: ['p0r21436x8zb9dcf5h7kjnmqesgutwvy', 'bc01fg45238967deuvhjyznpkmstqrwx'],
  bottom: ['14365h7k9dcfesgujnmqp0r2twvyx8zb', '238967debc01fg45kmstqrwxuvhjyznp'],
} as const;

const BORDERS = {
  right: ['bcfguvyz', 'prxz'],
  left: ['0145hjnp', '028b'],
  top: ['prxz', 'bcfguvyz'],
  bottom: ['028b', '0145hjnp'],
} as const;

function adjacent(hash: string, direction: keyof typeof NEIGHBORS): string {
  const normalized = hash.toLowerCase();
  const lastChar = normalized.slice(-1);
  const type = normalized.length % 2;
  const base = normalized.slice(0, -1);

  const borderChars = BORDERS[direction][type];
  const neighborChars = NEIGHBORS[direction][type];

  const nextBase =
    base && borderChars.includes(lastChar) ? adjacent(base, direction) : base;

  const neighborIndex = neighborChars.indexOf(lastChar);
  const nextChar = BASE32[neighborIndex];

  return nextBase + nextChar;
}

export function neighborGeohashes(hash: string) {
  const top = adjacent(hash, 'top');
  const bottom = adjacent(hash, 'bottom');
  const right = adjacent(hash, 'right');
  const left = adjacent(hash, 'left');

  return [
    hash,
    top,
    bottom,
    right,
    left,
    adjacent(top, 'right'),
    adjacent(top, 'left'),
    adjacent(bottom, 'right'),
    adjacent(bottom, 'left'),
  ];
}

