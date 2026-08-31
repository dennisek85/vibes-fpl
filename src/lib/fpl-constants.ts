export const POSITION_MAP: Record<number, { name: string; short: 'GK' | 'DEF' | 'MID' | 'FWD'; minPitch: number; maxPitch: number; totalSquad: number }> = {
  1: { name: 'Goalkeeper', short: 'GK', minPitch: 1, maxPitch: 1, totalSquad: 2 },
  2: { name: 'Defender', short: 'DEF', minPitch: 3, maxPitch: 5, totalSquad: 5 },
  3: { name: 'Midfielder', short: 'MID', minPitch: 2, maxPitch: 5, totalSquad: 5 },
  4: { name: 'Forward', short: 'FWD', minPitch: 1, maxPitch: 3, totalSquad: 3 },
};

export const FDR_COLORS: Record<number, { bg: string; text: string; label: string; border: string }> = {
  1: { bg: 'bg-[#00bb6e]', text: 'text-white', label: 'Very Easy', border: 'border-[#00bb6e]' },
  2: { bg: 'bg-[#01fc7a]', text: 'text-gray-900', label: 'Easy', border: 'border-[#01fc7a]' },
  3: { bg: 'bg-[#e1e5e8]', text: 'text-gray-800', label: 'Medium', border: 'border-gray-300' },
  4: { bg: 'bg-[#ff1751]', text: 'text-white', label: 'Hard', border: 'border-[#ff1751]' },
  5: { bg: 'bg-[#80072d]', text: 'text-white', label: 'Very Hard', border: 'border-[#80072d]' },
};

// Known Premier League Team Palette & Shirt styling for realistic pitch display
export const TEAM_STYLES: Record<string, { primary: string; secondary: string; text: string; pattern?: string }> = {
  ARS: { primary: '#EF0107', secondary: '#FFFFFF', text: '#FFFFFF' },
  AVL: { primary: '#670E36', secondary: '#95BFE5', text: '#FFFFFF' },
  BOU: { primary: '#DA291C', secondary: '#000000', text: '#FFFFFF' },
  BRE: { primary: '#E30613', secondary: '#FFFFFF', text: '#FFFFFF' },
  BHA: { primary: '#0057B8', secondary: '#FFFFFF', text: '#FFFFFF' },
  CHE: { primary: '#034694', secondary: '#FFFFFF', text: '#FFFFFF' },
  CRY: { primary: '#1B458F', secondary: '#C4122E', text: '#FFFFFF' },
  EVE: { primary: '#003399', secondary: '#FFFFFF', text: '#FFFFFF' },
  FUL: { primary: '#FFFFFF', secondary: '#000000', text: '#000000' },
  IPS: { primary: '#0047AB', secondary: '#FFFFFF', text: '#FFFFFF' },
  LEI: { primary: '#003090', secondary: '#FDBE11', text: '#FFFFFF' },
  LIV: { primary: '#C8102E', secondary: '#00B2A9', text: '#FFFFFF' },
  MCI: { primary: '#6CABDD', secondary: '#1C2C5B', text: '#FFFFFF' },
  MUN: { primary: '#DA291C', secondary: '#FFE500', text: '#FFFFFF' },
  NEW: { primary: '#241F20', secondary: '#FFFFFF', text: '#FFFFFF' },
  NFO: { primary: '#DD0000', secondary: '#FFFFFF', text: '#FFFFFF' },
  SOU: { primary: '#D71920', secondary: '#FFFFFF', text: '#FFFFFF' },
  TOT: { primary: '#132257', secondary: '#FFFFFF', text: '#FFFFFF' },
  WHU: { primary: '#7A263A', secondary: '#1BB1E7', text: '#FFFFFF' },
  WOL: { primary: '#FDB913', secondary: '#231F20', text: '#231F20' },
  // Historical / Promoted fallback
  LEE: { primary: '#FFCD00', secondary: '#1D428A', text: '#1D428A' },
  SUN: { primary: '#EB172B', secondary: '#FFFFFF', text: '#FFFFFF' },
  COV: { primary: '#00AEEF', secondary: '#FFFFFF', text: '#FFFFFF' },
  SHU: { primary: '#EE2737', secondary: '#000000', text: '#FFFFFF' },
  BUR: { primary: '#6C1D45', secondary: '#99D6EA', text: '#FFFFFF' },
  LUT: { primary: '#FF5F00', secondary: '#002D62', text: '#FFFFFF' },
};

export const MAX_SAVED_FREE_TRANSFERS = 5; // 2026/27 Rule
export const HIT_COST_POINTS = 4;
export const CURRENT_PL_SEASON_BUCKET = 'premierleague25';

