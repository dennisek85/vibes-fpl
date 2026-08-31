import bundledMomentumData from '@/data/player_form_momentum.json';

export interface PlayerRollingMomentum {
  playerId: number;
  rolling3Mins: number;
  rolling3Xg90: number;
  rolling3Xa90: number;
  rolling5Xg90: number;
  rolling5Xa90: number;
  momentumMultiplier: number; // 0.85 to 1.15
  trend: 'rising' | 'stable' | 'cooling';
}

export interface FormMomentumDataset {
  lastUpdated: string;
  season: string;
  players: Record<string, PlayerRollingMomentum>;
}

let runtimeMomentumData: FormMomentumDataset | null = null;

export function setCustomFormMomentumData(data: FormMomentumDataset) {
  if (data && data.players) {
    runtimeMomentumData = data;
  }
}

export function readFormMomentumData(): FormMomentumDataset {
  return runtimeMomentumData || (bundledMomentumData as FormMomentumDataset);
}

export function getPlayerFormMomentum(playerId: number): PlayerRollingMomentum | null {
  if (!playerId) return null;
  const data = readFormMomentumData();
  return data.players?.[`${playerId}`] || null;
}

