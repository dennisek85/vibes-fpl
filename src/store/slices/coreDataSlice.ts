import { StateCreator } from 'zustand';
import { PlannerState, CoreDataSlice } from '../types';
import { FPLPlayer, FPLTeam, FPLEvent } from '@/types/fpl';
import { getActivePin } from '@/lib/auth';

export const createCoreDataSlice: StateCreator<PlannerState, [], [], CoreDataSlice> = (set, get) => ({
  isLoading: false,
  isSaving: false,
  lastSavedTime: null,
  error: null,
  players: [],
  teams: [],
  events: [],
  fixtures: [],
  playerMap: new Map(),
  teamMap: new Map(),
  aiProjectionsMap: new Map(),
  liveEventPoints: {},
  nextGameweekId: 3,

  isGameweekLocked: (gameweek?: number) => {
    const gw = gameweek !== undefined ? gameweek : get().selectedGameweek;
    return gw < get().nextGameweekId;
  },

  fetchLivePointsForGameweek: async (gw: number) => {
    if (get().liveEventPoints[gw]) return;
    try {
      const res = await fetch(`/api/fpl/event/${gw}/live`);
      if (res.ok) {
        const data = await res.json();
        const updated = { ...get().liveEventPoints, [gw]: data };
        set({ liveEventPoints: updated });
      }
    } catch (e) {
      console.warn(`Error fetching live points for GW ${gw}:`, e);
    }
  },

  initFPLData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [bootstrapRes, fixturesRes, projectionsRes] = await Promise.all([
        fetch('/api/fpl/bootstrap'),
        fetch('/api/fpl/fixtures'),
        fetch('/api/fpl/projections').catch(() => null),
      ]);

      if (!bootstrapRes.ok) throw new Error('Failed to load FPL core data');
      const bootstrapData = await bootstrapRes.json();
      const fixturesData = fixturesRes.ok ? await fixturesRes.json() : [];

      const aiProjectionsMap = new Map<string, number>();
      if (projectionsRes && projectionsRes.ok) {
        try {
          const projData = await projectionsRes.json();
          if (projData.predictions && typeof projData.predictions === 'object') {
            for (const [key, val] of Object.entries(projData.predictions)) {
              aiProjectionsMap.set(key, Number(val));
            }
          }
        } catch (e) {
          console.warn('OpenFPL projections parsing warning:', e);
        }
      }

      const playerMap = new Map<number, FPLPlayer>();
      for (const p of bootstrapData.elements || []) {
        playerMap.set(p.id, p);
      }

      const teamMap = new Map<number, FPLTeam>();
      for (const t of bootstrapData.teams || []) {
        teamMap.set(t.id, t);
      }

      const events: FPLEvent[] = bootstrapData.events || [];
      const nextEvent = events.find(e => e.is_next) || events.find(e => e.is_current) || events[0];
      const nextGwId = nextEvent ? nextEvent.id : 3;

      set({
        players: bootstrapData.elements || [],
        teams: bootstrapData.teams || [],
        events,
        fixtures: fixturesData || [],
        playerMap,
        teamMap,
        aiProjectionsMap,
        nextGameweekId: nextGwId,
        startGameweek: 1,
        selectedGameweek: nextGwId,
      });

      // Fetch live points for past GWs
      for (let g = 1; g < nextGwId; g++) {
        get().fetchLivePointsForGameweek(g);
      }

      const savedPin = getActivePin();
      if (savedPin) {
        await get().loadUserPlanByPin(savedPin);
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      console.error('initFPLData error:', err);
      set({ error: err.message || 'Failed to initialize FPL data', isLoading: false });
    }
  },
});

