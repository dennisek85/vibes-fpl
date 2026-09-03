export const AUTH_STORAGE_KEY = "fpl_hub_auth_active_pin";

// Irreversible SHA-256 hash of the authorized ML Lab administrator user key
const AUTHORIZED_LAB_USER_HASH =
  "8551223b27ce7a972fb4627e066d53e752816504b2cd9c3441ddf559c6cb07da";

// Synchronous SHA-256 hashing utility (zero external dependencies)
function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = "";

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isPrime[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isPrime[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += "\x80";
  while (ascii.length % 64 !== 56) ascii += "\x00";
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return "";
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15] || 0,
        w2 = w[i - 2] || 0;

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i] || 0
          : ((w[i - 16] || 0) + s0 + (w[i - 7] || 0) + s1) | 0;

      const s1_hash =
        rightRotate(hash[4], 6) ^
        rightRotate(hash[4], 11) ^
        rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1_hash + ch + k[i] + w[i]) | 0;
      const s0_hash =
        rightRotate(hash[0], 2) ^
        rightRotate(hash[0], 13) ^
        rightRotate(hash[0], 22);
      const maj =
        (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0_hash + maj) | 0;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

export function getActivePin(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

export function isPinVerified(): boolean {
  return !!getActivePin();
}

export function saveActivePin(pin: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(AUTH_STORAGE_KEY, pin.trim());
  }
}

export function logoutPin(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

/**
 * Gatekeeper for the Private ML Lab.
 * Uses one-way SHA-256 hashing so no plaintext PINs or team IDs are ever exposed in source code.
 */
export function isMlLabAuthorized(
  teamSummary?: { id?: number | string | null } | null,
  activePin?: string | null
): boolean {
  // 1. Direct state check from active session
  const pin = activePin ? String(activePin).trim() : "";
  const teamId = teamSummary?.id ? String(teamSummary.id).trim() : "";
  if (teamId && pin) {
    const candidateKey = `fpl_user_${teamId}_${pin}`;
    if (sha256Sync(candidateKey) === AUTHORIZED_LAB_USER_HASH) {
      return true;
    }
  }

  // 2. Persisted storage fallback (e.g. during page reloads before full store rehydration)
  if (typeof window !== "undefined") {
    try {
      const storedPin = localStorage.getItem(AUTH_STORAGE_KEY)?.trim() || "";
      const storedTeamId =
        localStorage.getItem("fpl_last_team_id")?.trim() || "";
      if (storedTeamId && storedPin) {
        const candidateKey = `fpl_user_${storedTeamId}_${storedPin}`;
        if (sha256Sync(candidateKey) === AUTHORIZED_LAB_USER_HASH) {
          return true;
        }
      }
    } catch {}
  }

  return false;
}

