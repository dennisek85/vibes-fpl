import { StateCreator } from "zustand";
import { PlannerState, CoreDataSlice } from "../types";
import { FPLPlayer, FPLTeam, FPLEvent } from "@/types/fpl";
import { getActivePin } from "@/lib/auth";

import { setCustomMatchOddsData } from "@/lib/oddsTracker";
import { setCustomFormMomentumData } from "@/lib/formTracker";
import { setCustomTop10kData } from "@/lib/ownershipTracker";
import {
  evaluatePlayerRotationRisk,
  RotationRiskReport,
} from "@/utils/aiLineupRiskEngine";
import { invalidateXpCache } from "./aiOptimizerSlice";

export const createCoreDataSlice: StateCreator<
  PlannerState,
  [],
  [],
  CoreDataSlice
> = (set, get) => ({
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
  lineupRiskMap: new Map(),
  liveEventPoints: {},
  nextGameweekId: 3,

  isGameweekLocked: (gameweek?: number) => {
    const gw = gameweek !== undefined ? gameweek : get().selectedGameweek;
    return gw < get().nextGameweekId;
  },

  getPlayerLineupRisk: (playerId: number): RotationRiskReport => {
    const cached = get().lineupRiskMap.get(playerId);
    if (cached) return cached;
    const player = get().playerMap.get(playerId);
    if (!player) {
      return {
        playerId,
        playerName: "Player",
        teamShort: "EPL",
        startProbability: 100,
        riskLevel: "safe",
        primaryReasonKey: "defaultSafe",
        humanReason: "",
        officialNewsQuote: "",
        isSubRisk: false,
        expectedMinutes: 90,
      };
    }
    const teamShort = get().teamMap.get(player.team)?.short_name || "EPL";
    const evaluated = evaluatePlayerRotationRisk(player, teamShort);
    get().lineupRiskMap.set(playerId, evaluated);
    return evaluated;
  },

  fetchLivePointsForGameweek: async (gw: number, forceRefresh = false) => {
    if (!forceRefresh && get().liveEventPoints[gw]) return;
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

  fetchHistoricalPicksForGameweek: async (gw: number) => {
    const { teamSummary, gameweekPlans, playerMap, isGameweekLocked } = get();
    if (!teamSummary?.id) return;
    if (!isGameweekLocked(gw)) return;

    try {
      const res = await fetch(
        `/api/fpl/entry/${teamSummary.id}/event/${gw}/picks`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.picks && data.picks.length > 0) {
          const newSquad = data.picks.map((p: any) => ({
            element: p.element,
            position: p.position,
            is_captain: p.is_captain,
            is_vice_captain: p.is_vice_captain,
            multiplier: p.multiplier,
            purchase_price:
              p.purchase_price ||
              playerMap.get(p.element)?.now_cost ||
              50,
            selling_price:
              p.selling_price ||
              playerMap.get(p.element)?.now_cost ||
              50,
          }));

          const updatedPlans = { ...gameweekPlans };
          if (updatedPlans[gw]) {
            updatedPlans[gw] = {
              ...updatedPlans[gw],
              squad: newSquad,
              chip: data.active_chip || updatedPlans[gw].chip || "none",
            };
            set({ gameweekPlans: updatedPlans });
          }
        }
      }
    } catch (e) {
      console.warn(`Error fetching historical picks for GW ${gw}:`, e);
    }
  },

  initFPLData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [bootstrapRes, fixturesRes, projectionsRes, telemetryRes] =
        await Promise.all([
          fetch("/api/fpl/bootstrap"),
          fetch("/api/fpl/fixtures"),
          fetch("/api/fpl/projections").catch(() => null),
          fetch("/api/fpl/telemetry").catch(() => null),
        ]);

      if (!bootstrapRes.ok) throw new Error("Failed to load FPL core data");
      const bootstrapData = await bootstrapRes.json();
      const fixturesData = fixturesRes.ok ? await fixturesRes.json() : [];

      if (telemetryRes && telemetryRes.ok) {
        try {
          const telemetryData = await telemetryRes.json();
          if (telemetryData.matchOdds)
            setCustomMatchOddsData(telemetryData.matchOdds);
          if (telemetryData.formMomentum)
            setCustomFormMomentumData(telemetryData.formMomentum);
          if (telemetryData.top10kOwnership)
            setCustomTop10kData(telemetryData.top10kOwnership);
        } catch (e) {
          console.warn("Telemetry hydration note:", e);
        }
      }

      const aiProjectionsMap = new Map<string, number>();
      if (projectionsRes && projectionsRes.ok) {
        try {
          const projData = await projectionsRes.json();
          if (
            projData.predictions &&
            typeof projData.predictions === "object"
          ) {
            for (const [key, val] of Object.entries(projData.predictions)) {
              aiProjectionsMap.set(key, Number(val));
            }
          }
        } catch (e) {
          console.warn("OpenFPL projections parsing warning:", e);
        }
      }

      const teamMap = new Map<number, FPLTeam>();
      for (const t of bootstrapData.teams || []) {
        teamMap.set(t.id, t);
      }

      const playerMap = new Map<number, FPLPlayer>();
      const lineupRiskMap = new Map<number, RotationRiskReport>();
      for (const p of bootstrapData.elements || []) {
        playerMap.set(p.id, p);
        const teamShort = teamMap.get(p.team)?.short_name || "EPL";
        lineupRiskMap.set(p.id, evaluatePlayerRotationRisk(p, teamShort));
      }

      const events: FPLEvent[] = bootstrapData.events || [];
      const nextEvent =
        events.find((e) => e.is_next) ||
        events.find((e) => e.is_current) ||
        events[0];
      const nextGwId = nextEvent ? nextEvent.id : 3;

      set({
        players: bootstrapData.elements || [],
        teams: bootstrapData.teams || [],
        events,
        fixtures: fixturesData || [],
        playerMap,
        teamMap,
        aiProjectionsMap,
        lineupRiskMap,
        nextGameweekId: nextGwId,
        startGameweek: 1,
        selectedGameweek: nextGwId,
      });

      invalidateXpCache();

      const savedPin = getActivePin();
      if (savedPin) {
        await get().loadUserPlanByPin(savedPin);
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      console.error("initFPLData error:", err);
      set({
        error: err.message || "Failed to initialize FPL data",
        isLoading: false,
      });
    }
  },
});
