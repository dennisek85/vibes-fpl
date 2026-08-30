import { StateCreator } from 'zustand';
import { PlannerState, GameweekPlanSlice } from '../types';
import { FPLPlayer, SquadPick, ChipType, PlannedGameweek } from '@/types/fpl';
import { calculateGameweekFinancials, validateClubLimit } from '@/lib/fpl-rules';

export function recalculateMultiGameweekPlans(
  get: () => PlannerState,
  set: (state: Partial<PlannerState>) => void
) {
  const { initialBank, initialFreeTransfers, gameweekPlans, playerMap, baseImportedPicks } = get();
  const maxGw = 38;

  // 1. Calculate Base Total Team Value: Sum of costs of base imported squad + initial bank
  let baseSquadCost = 0;
  if (baseImportedPicks.length > 0) {
    baseImportedPicks.forEach(p => {
      const pl = playerMap.get(p.element);
      baseSquadCost += pl ? pl.now_cost : (p.selling_price || 50);
    });
  } else {
    const firstSquad = (Object.values(gameweekPlans) as PlannedGameweek[]).find(p => p?.squad?.length > 0)?.squad || [];
    firstSquad.forEach(p => {
      const pl = playerMap.get(p.element);
      baseSquadCost += pl ? pl.now_cost : (p.selling_price || 50);
    });
  }
  const totalTeamValue = baseSquadCost + initialBank;

  let rollingFT = initialFreeTransfers;
  const allPlansList = Object.values(gameweekPlans) as PlannedGameweek[];
  let rollingSquad: SquadPick[] = allPlansList.find(p => p && p.squad && p.squad.length > 0)?.squad || baseImportedPicks;

  const newPlans: Record<number, PlannedGameweek> = {};

  for (let gw = 1; gw <= maxGw; gw++) {
    const existing = gameweekPlans[gw];
    const squad = existing ? existing.squad : [...rollingSquad];
    const chip = existing ? existing.chip : 'none';
    const bankOverride = existing?.bankOverride;
    const ftOverride = existing?.freeTransfersOverride;

    // Calculate current squad cost
    let currentSquadCost = 0;
    squad.forEach(pick => {
      const pl = playerMap.get(pick.element);
      currentSquadCost += pl ? pl.now_cost : (pick.selling_price || 50);
    });

    // Invariant: Bank is Total Team Value - Current Squad Cost
    const currentBank = Math.max(0, totalTeamValue - currentSquadCost);

    // Calculate transfers relative to previous gameweek squad (or base squad)
    const prevSquadIds = new Set(rollingSquad.map(p => p.element));
    const currSquadIds = new Set(squad.map(p => p.element));
    
    const derivedTransfersIn = squad.filter(p => !prevSquadIds.has(p.element)).map(p => p.element);
    const derivedTransfersOut = rollingSquad.filter(p => !currSquadIds.has(p.element)).map(p => p.element);
    const transfersCount = derivedTransfersIn.length;

    const financials = calculateGameweekFinancials({
      currentBank,
      availableFreeTransfers: rollingFT,
      transfersCount,
      chip,
      bankOverride,
      ftOverride,
    });

    newPlans[gw] = {
      gameweek: gw,
      squad,
      transfersIn: derivedTransfersIn,
      transfersOut: derivedTransfersOut,
      chip,
      bankOverride,
      freeTransfersOverride: ftOverride,
      calculatedBank: financials.effectiveBank,
      availableTransfers: financials.availableTransfers,
      transfersUsed: financials.transfersUsed,
      transferCost: financials.hitPoints,
    };

    rollingFT = financials.nextGameweekFT;
    rollingSquad = [...squad];
  }

  set({ gameweekPlans: newPlans });
}

export const createGameweekPlanSlice: StateCreator<PlannerState, [], [], GameweekPlanSlice> = (set, get) => ({
  startGameweek: 1,
  selectedGameweek: 3,
  gameweekPlans: {},
  baseImportedPicks: [],
  initialBank: 0,
  initialFreeTransfers: 1,

  selectGameweek: (gw: number) => {
    const { gameweekPlans, nextGameweekId } = get();
    if (gw < nextGameweekId) {
      get().fetchLivePointsForGameweek(gw);
    }

    if (!gameweekPlans[gw] || !gameweekPlans[gw].squad || gameweekPlans[gw].squad.length === 0) {
      const allPlansList = Object.values(gameweekPlans) as PlannedGameweek[];
      const baseSquad = allPlansList.find(p => p && p.squad && p.squad.length > 0)?.squad || [];
      const updatedPlans = { ...gameweekPlans };
      updatedPlans[gw] = {
        gameweek: gw,
        squad: [...baseSquad],
        transfersIn: [],
        transfersOut: [],
        chip: 'none',
        calculatedBank: 0,
        availableTransfers: 1,
        transfersUsed: 0,
        transferCost: 0,
      };
      set({ gameweekPlans: updatedPlans, selectedGameweek: gw, selectedSlotForSwap: null, selectedPlayerForTransfer: null, isMarketOpen: false });
    } else {
      set({ selectedGameweek: gw, selectedSlotForSwap: null, selectedPlayerForTransfer: null, isMarketOpen: false });
    }
    get().saveCurrentPlanToServer();
  },

  setCaptain: (elementId: number) => {
    const { selectedGameweek, gameweekPlans, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    const currentPlan = gameweekPlans[selectedGameweek];
    if (!currentPlan) return;

    const targetPick = currentPlan.squad.find(p => p.element === elementId);
    if (!targetPick) return;

    const wasTargetViceCaptain = targetPick.is_vice_captain;
    const isTripleCaptain = currentPlan.chip === '3xc';

    const newSquad = currentPlan.squad.map(p => {
      if (p.element === elementId) {
        return { 
          ...p, 
          is_captain: true, 
          is_vice_captain: false, 
          multiplier: isTripleCaptain ? 3 : 2 
        };
      }
      if (p.is_captain) {
        return { 
          ...p, 
          is_captain: false, 
          is_vice_captain: wasTargetViceCaptain ? true : p.is_vice_captain, 
          multiplier: 1 
        };
      }
      return p;
    });

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[selectedGameweek] = { ...currentPlan, squad: newSquad };
    set({ gameweekPlans: updatedPlans });
    get().saveCurrentPlanToServer();
  },

  setViceCaptain: (elementId: number) => {
    const { selectedGameweek, gameweekPlans, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    const currentPlan = gameweekPlans[selectedGameweek];
    if (!currentPlan) return;

    const targetPick = currentPlan.squad.find(p => p.element === elementId);
    if (!targetPick) return;

    const wasTargetCaptain = targetPick.is_captain;
    const isTripleCaptain = currentPlan.chip === '3xc';

    const newSquad = currentPlan.squad.map(p => {
      if (p.element === elementId) {
        return { 
          ...p, 
          is_vice_captain: true, 
          is_captain: false, 
          multiplier: 1 
        };
      }
      if (p.is_vice_captain) {
        return { 
          ...p, 
          is_vice_captain: false, 
          is_captain: wasTargetCaptain ? true : p.is_captain, 
          multiplier: wasTargetCaptain ? (isTripleCaptain ? 3 : 2) : p.multiplier 
        };
      }
      return p;
    });

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[selectedGameweek] = { ...currentPlan, squad: newSquad };
    set({ gameweekPlans: updatedPlans });
    get().saveCurrentPlanToServer();
  },

  executeTransfer: (playerIn: FPLPlayer, explicitPlayerOutId?: number | null) => {
    const { selectedPlayerForTransfer, selectedGameweek, gameweekPlans, playerMap, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return false;

    const currentPlan = gameweekPlans[selectedGameweek];
    if (!currentPlan) return false;

    const isAlreadyIn = currentPlan.squad.some(p => p.element === playerIn.id);
    if (isAlreadyIn) {
      alert(`${playerIn.web_name} is already in your squad!`);
      return false;
    }

    const targetOutId = explicitPlayerOutId ?? selectedPlayerForTransfer;
    let outPick = targetOutId 
      ? currentPlan.squad.find(p => p.element === targetOutId) 
      : null;

    if (!outPick) {
      const matchingPicks = currentPlan.squad.filter(p => playerMap.get(p.element)?.element_type === playerIn.element_type);
      if (matchingPicks.length === 0) {
        alert(`No players found in your squad matching ${playerIn.web_name}'s position.`);
        return false;
      }
      outPick = matchingPicks.sort((a, b) => {
        const pA = playerMap.get(a.element);
        const pB = playerMap.get(b.element);
        const costA = a.selling_price || pA?.now_cost || 0;
        const costB = b.selling_price || pB?.now_cost || 0;
        return costB - costA;
      })[0];
    }

    const playerOut = playerMap.get(outPick.element);
    if (!playerOut) return false;

    if (playerOut.element_type !== playerIn.element_type) {
      alert(`Cannot replace ${playerOut.web_name} with ${playerIn.web_name}. Positions must match.`);
      return false;
    }

    const sellPrice = playerOut.now_cost;
    const buyPrice = playerIn.now_cost;
    const priceDiff = sellPrice - buyPrice;

    if (currentPlan.calculatedBank + priceDiff < 0) {
      const deficit = ((buyPrice - sellPrice - currentPlan.calculatedBank) / 10).toFixed(1);
      alert(`Transfer unaffordable! Requires £${deficit}m more in the bank.`);
      return false;
    }

    const newPick: SquadPick = {
      element: playerIn.id,
      position: outPick.position,
      is_captain: outPick.is_captain,
      is_vice_captain: outPick.is_vice_captain,
      multiplier: outPick.multiplier,
      purchase_price: buyPrice,
      selling_price: buyPrice,
    };

    const newSquad = currentPlan.squad.map(p => p.element === playerOut.id ? newPick : p);

    const clubValidation = validateClubLimit(newSquad, playerMap);
    if (!clubValidation.isValid) {
      const offendingTeam = get().teamMap.get(clubValidation.violations[0].teamId);
      alert(`Club limit exceeded! You cannot have more than 3 players from ${offendingTeam?.name || 'the same club'}.`);
      return false;
    }

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[selectedGameweek] = {
      ...currentPlan,
      squad: newSquad,
    };

    set({
      gameweekPlans: updatedPlans,
      isMarketOpen: false,
      selectedPlayerForTransfer: null,
    });

    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
    return true;
  },

  executeDirectTransfer: (playerOutId: number, playerInId: number) => {
    const { playerMap, executeTransfer } = get();
    const playerIn = playerMap.get(playerInId);
    if (!playerIn) return false;
    return executeTransfer(playerIn, playerOutId);
  },

  revertTransfer: () => {
    get().resetCurrentGameweek();
  },

  resetCurrentGameweek: () => {
    const { selectedGameweek, gameweekPlans, nextGameweekId, baseImportedPicks, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    let targetSquad: SquadPick[] = [];
    if (selectedGameweek === nextGameweekId) {
      targetSquad = baseImportedPicks.length > 0 
        ? baseImportedPicks.map(p => ({ ...p })) 
        : (gameweekPlans[nextGameweekId]?.squad || []);
    } else {
      const prevGw = selectedGameweek - 1;
      targetSquad = gameweekPlans[prevGw]?.squad ? gameweekPlans[prevGw].squad.map(p => ({ ...p })) : baseImportedPicks;
    }

    const updatedPlans = { ...gameweekPlans };
    if (updatedPlans[selectedGameweek]) {
      updatedPlans[selectedGameweek] = {
        ...updatedPlans[selectedGameweek],
        squad: targetSquad,
        transfersIn: [],
        transfersOut: [],
        chip: 'none',
        bankOverride: null,
        freeTransfersOverride: null,
      };
    }

    set({ gameweekPlans: updatedPlans, isMarketOpen: false, selectedPlayerForTransfer: null });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
  },

  resetAllFutureGameweeks: () => {
    const { nextGameweekId, gameweekPlans, baseImportedPicks, initialBank, initialFreeTransfers } = get();
    
    const baseSquad = baseImportedPicks.length > 0 
      ? baseImportedPicks.map(p => ({ ...p })) 
      : (gameweekPlans[nextGameweekId]?.squad || []);

    const updatedPlans: Record<number, PlannedGameweek> = {};

    for (let g = 1; g < nextGameweekId; g++) {
      if (gameweekPlans[g]) {
        updatedPlans[g] = gameweekPlans[g];
      }
    }

    let rollingBank = initialBank;
    let rollingFT = initialFreeTransfers;

    for (let gw = nextGameweekId; gw <= 38; gw++) {
      const fin = calculateGameweekFinancials({
        currentBank: rollingBank,
        availableFreeTransfers: rollingFT,
        transfersCount: 0,
        chip: 'none',
      });

      updatedPlans[gw] = {
        gameweek: gw,
        squad: baseSquad.map(p => ({ ...p })),
        transfersIn: [],
        transfersOut: [],
        chip: 'none',
        calculatedBank: fin.effectiveBank,
        availableTransfers: fin.availableTransfers,
        transfersUsed: 0,
        transferCost: 0,
      };

      rollingBank = fin.effectiveBank;
      rollingFT = fin.nextGameweekFT;
    }

    set({
      gameweekPlans: updatedPlans,
      isMarketOpen: false,
      selectedPlayerForTransfer: null,
    });

    get().saveCurrentPlanToServer();
  },

  setChip: (chip: ChipType) => {
    const { selectedGameweek, gameweekPlans, playedChips, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    const currentPlan = gameweekPlans[selectedGameweek];
    if (!currentPlan) return;

    if (chip !== 'none') {
      const alreadyPlayedOfficial = playedChips.find(c => c.name === chip);
      if (alreadyPlayedOfficial && alreadyPlayedOfficial.event !== selectedGameweek) {
        alert(`The ${chip.toUpperCase()} chip was already played in Gameweek ${alreadyPlayedOfficial.event}!`);
        return;
      }
    }

    const updatedPlans = { ...gameweekPlans };
    if (chip !== 'none') {
      Object.keys(updatedPlans).forEach(gwKey => {
        const gw = parseInt(gwKey, 10);
        if (gw !== selectedGameweek && updatedPlans[gw].chip === chip) {
          updatedPlans[gw] = { ...updatedPlans[gw], chip: 'none' };
        }
      });
    }

    updatedPlans[selectedGameweek] = { ...currentPlan, chip };
    set({ gameweekPlans: updatedPlans });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
  },

  setBankOverride: (gw: number, bankTenths: number | null) => {
    const { gameweekPlans, isGameweekLocked } = get();
    if (isGameweekLocked(gw)) return;

    const currentPlan = gameweekPlans[gw];
    if (!currentPlan) return;

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[gw] = { ...currentPlan, bankOverride: bankTenths };
    set({ gameweekPlans: updatedPlans });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
  },

  setFreeTransfersOverride: (gw: number, count: number | null) => {
    const { gameweekPlans, isGameweekLocked } = get();
    if (isGameweekLocked(gw)) return;

    const currentPlan = gameweekPlans[gw];
    if (!currentPlan) return;

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[gw] = { ...currentPlan, freeTransfersOverride: count };
    set({ gameweekPlans: updatedPlans });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
  },
});

