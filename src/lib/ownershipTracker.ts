import bundledEoData from '@/data/top10k_ownership.json';

export interface PlayerTop10kEo {
  playerId: number;
  ownership: number;         // 0 to 100%
  captaincy: number;         // 0 to 100%
  effectiveOwnership: number;// Ownership + Captaincy (can exceed 100%)
  tier: 'essential' | 'popular' | 'differential' | 'ultra_differential';
  riskLabel: string;
}

export interface Top10kEoDataset {
  lastUpdated: string;
  gameweek: number;
  sampleSize: number;
  players: Record<string, PlayerTop10kEo>;
}

let runtimeEoData: Top10kEoDataset | null = null;

export function setCustomTop10kData(data: Top10kEoDataset) {
  if (data && data.players) {
    runtimeEoData = data;
  }
}

export function readTop10kEoData(): Top10kEoDataset {
  return runtimeEoData || (bundledEoData as Top10kEoDataset);
}

export function getPlayerTop10kEo(playerId: number): PlayerTop10kEo | null {
  if (!playerId) return null;
  const data = readTop10kEoData();
  return data.players?.[`${playerId}`] || null;
}

