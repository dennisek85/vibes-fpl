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
import {
  generateGameweekAuditReport,
  CANONICAL_BASELINES,
} from "@/utils/aiCalibrationEngine";
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
  nextGameweekId: 1,
  auditReports: [],
  activeCalibrations: { ...CANONICAL_BASELINES },

  approveAuditCalibration: (gw: number) => {
    const reports = get().auditReports.map((r) => {
      if (r.gw === gw) return { ...r, status: "applied" as const };
      if (r.status === "applied") return { ...r, status: "archived" as const };
      return r;
    });
    const targetReport = reports.find((r) => r.gw === gw);
    const updatedCalibrations: Record<string, number> = {
      ...get().activeCalibrations,
    };
    if (targetReport) {
      for (const cal of targetReport.calibrations) {
        if (cal.status === "passed") {
          updatedCalibrations[cal.id] = cal.proposedValue;
        }
      }
    }
    set({ auditReports: reports, activeCalibrations: updatedCalibrations });
    invalidateXpCache();
  },

  revertCalibrationToBaseline: () => {
    const reports = get().auditReports.map((r) => ({
      ...r,
      status: (r.status === "applied" ? "staged" : r.status) as any,
    }));
    set({
      auditReports: reports,
      activeCalibrations: { ...CANONICAL_BASELINES },
    });
    invalidateXpCache();
  },

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
    const completedMatches = Math.max(1, get().events.filter((e) => e.finished).length);
    const evaluated = evaluatePlayerRotationRisk(player, teamShort, completedMatches);
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
          updatedPlans[gw] = {
            ...(updatedPlans[gw] || {
              gameweek: gw,
              transfersIn: [],
              transfersOut: [],
              chip: "none",
              calculatedBank: 0,
              availableTransfers: 1,
              transfersUsed: 0,
              transferCost: 0,
            }),
            gameweek: gw,
            squad: newSquad,
            chip: data.active_chip || updatedPlans[gw]?.chip || "none",
          };
          set({ gameweekPlans: updatedPlans });
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

      const events: FPLEvent[] = bootstrapData.events || [];
      const completedMatches = Math.max(1, events.filter((e) => e.finished).length);
      const playerMap = new Map<number, FPLPlayer>();
      const lineupRiskMap = new Map<number, RotationRiskReport>();
      for (const p of bootstrapData.elements || []) {
        playerMap.set(p.id, p);
        const teamShort = teamMap.get(p.team)?.short_name || "EPL";
        lineupRiskMap.set(p.id, evaluatePlayerRotationRisk(p, teamShort, completedMatches));
      }
      const nextEvent =
        events.find((e) => e.is_next) ||
        events.find((e) => e.is_current) ||
        events[0];
      const nextGwId = nextEvent ? nextEvent.id : 1;

      // Sync all live points for finished and current gameweeks upfront so switching GWs is instant
      const finishedOrCurrentEvents = events.filter((e) => e.finished || e.is_current);
      const finishedGwIds = finishedOrCurrentEvents.map((e) => e.id);
      const livePointsResults = await Promise.all(
        finishedGwIds.map(async (gwId) => {
          try {
            const res = await fetch(`/api/fpl/event/${gwId}/live`);
            if (res.ok) {
              const data = await res.json();
              return { gwId, data };
            }
          } catch {}
          return null;
        })
      );

      const liveEventPointsMap: Record<number, Record<number, number>> = {
        ...get().liveEventPoints,
      };
      for (const res of livePointsResults) {
        if (res && res.data) {
          liveEventPointsMap[res.gwId] = res.data;
        }
      }

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
        liveEventPoints: liveEventPointsMap,
      });

      // Generate audit reports for completed gameweeks now that playerMap, fixtures, and projections are fully hydrated
      const finishedEvents = events.filter((e) => e.finished);
      const reportGws = finishedEvents.length > 0 ? finishedEvents.map((e) => e.id) : [2, 1];
      const currentReports = reportGws
        .map((gwId) =>
          generateGameweekAuditReport(
            gwId,
            bootstrapData.elements || [],
            events,
            liveEventPointsMap[gwId] || {},
            (id, g) => get().getPlayerGameweekXp(id, g),
            teamMap
          )
        )
        .sort((a, b) => b.gw - a.gw); // Latest report always on top!

      set({
        auditReports: currentReports,
      });

      invalidateXpCache();

      const savedPin = getActivePin();
      if (savedPin) {
        let lastTeamId: number | null = null;
        if (typeof window !== "undefined") {
          const storedId = localStorage.getItem("fpl_last_team_id");
          if (storedId) lastTeamId = Number(storedId);
        }
        await get().loadUserPlanByPin(savedPin, lastTeamId);
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
