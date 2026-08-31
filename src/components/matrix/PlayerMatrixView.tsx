'use client';

import React, { useMemo } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { MatrixFilterBar } from './MatrixFilterBar';
import { KitIcon } from '@/components/ui/KitIcon';
import { getAllPricePredictions, PlayerPricePrediction } from '@/utils/aiPricePredictor';
import { getPlayerTop10kEo } from '@/lib/ownershipTracker';
import { getPlayerSetPieceProfile } from '@/lib/setPieces';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ShoppingBag, 
  TrendingUp, 
  Sparkles, 
  Shield, 
  Target, 
  Flame, 
  Zap,
  Snowflake,
  Lock,
  Star
} from 'lucide-react';

export const PlayerMatrixView: React.FC = () => {
  const {
    players,
    playerMap,
    teamMap,
    matrixSearch,
    matrixPosition,
    matrixTeamId,
    matrixMinPrice,
    matrixMaxPrice,
    matrixHorizon,
    matrixPer90,
    matrixSortBy,
    matrixSortDirection,
    setMatrixSort,
    matrixViewTab,
    matrixPriceFilter,
    getPlayerGameweekXp,
    getPlayerHorizonXp,
    openTransferDrawer,
    openPlayerDetail,
    selectedGameweek,
    isGameweekLocked,
    gameweekPlans,
    showAiPredictions
  } = usePlannerStore();

  const isLocked = isGameweekLocked(selectedGameweek);
  const currentPlan = gameweekPlans[selectedGameweek];
  const squadElementIds = useMemo(() => {
    return new Set(currentPlan?.squad?.map(p => p.element) || []);
  }, [currentPlan]);

  // Price Predictions list
  const allPricePredictions = useMemo(() => {
    return getAllPricePredictions(players, squadElementIds);
  }, [players, squadElementIds]);

  // Filter and sort for Price Radar View
  const processedPricePredictions = useMemo(() => {
    let list = allPricePredictions.filter(item => {
      const p = item.player;
      // Position filter
      if (matrixPosition !== null && p.element_type !== matrixPosition) return false;
      // Team filter
      if (matrixTeamId !== null && p.team !== matrixTeamId) return false;
      // Price filter
      if (p.now_cost < matrixMinPrice || p.now_cost > matrixMaxPrice) return false;
      // Price category filter
      if (matrixPriceFilter === 'rising' && item.targetProgress < 100) return false;
      if (matrixPriceFilter === 'approaching' && (item.targetProgress < 80 || item.targetProgress >= 100)) return false;
      if (matrixPriceFilter === 'falling' && item.targetProgress > -100) return false;
      if (matrixPriceFilter === 'squad' && !item.isInSquad) return false;

      // Search filter
      if (matrixSearch.trim()) {
        const q = matrixSearch.toLowerCase().trim();
        const team = teamMap.get(p.team);
        const matchName = p.web_name.toLowerCase().includes(q) || 
                          p.first_name.toLowerCase().includes(q) || 
                          p.second_name.toLowerCase().includes(q);
        const matchTeam = team && (team.name.toLowerCase().includes(q) || team.short_name.toLowerCase().includes(q));
        if (!matchName && !matchTeam) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      let valA: number = 0;
      let valB: number = 0;

      switch (matrixSortBy) {
        case 'name':
          return matrixSortDirection === 'asc' 
            ? a.player.web_name.localeCompare(b.player.web_name) 
            : b.player.web_name.localeCompare(a.player.web_name);
        case 'price':
          valA = a.nowCost;
          valB = b.nowCost;
          break;
        case 'transfers_today':
          valA = a.netTransfersToday;
          valB = b.netTransfersToday;
          break;
        case 'target_progress':
          valA = a.projectedTonightProgress !== undefined ? a.projectedTonightProgress : a.targetProgress;
          valB = b.projectedTonightProgress !== undefined ? b.projectedTonightProgress : b.targetProgress;
          break;
        case 'season_delta':
          valA = a.seasonDelta;
          valB = b.seasonDelta;
          break;
        default:
          valA = a.projectedTonightProgress !== undefined ? a.projectedTonightProgress : a.targetProgress;
          valB = b.projectedTonightProgress !== undefined ? b.projectedTonightProgress : b.targetProgress;
      }

      return matrixSortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [
    allPricePredictions,
    matrixPosition,
    matrixTeamId,
    matrixMinPrice,
    matrixMaxPrice,
    matrixPriceFilter,
    matrixSearch,
    matrixSortBy,
    matrixSortDirection,
    teamMap
  ]);

  // Filter and sort for Performance Stats Matrix View
  const processedPlayers = useMemo(() => {
    let list = players.filter(p => {
      if (matrixPosition !== null && p.element_type !== matrixPosition) return false;
      if (matrixTeamId !== null && p.team !== matrixTeamId) return false;
      if (p.now_cost < matrixMinPrice || p.now_cost > matrixMaxPrice) return false;
      if (matrixSearch.trim()) {
        const q = matrixSearch.toLowerCase().trim();
        const team = teamMap.get(p.team);
        const matchName = p.web_name.toLowerCase().includes(q) || 
                          p.first_name.toLowerCase().includes(q) || 
                          p.second_name.toLowerCase().includes(q);
        const matchTeam = team && (team.name.toLowerCase().includes(q) || team.short_name.toLowerCase().includes(q));
        if (!matchName && !matchTeam) return false;
      }
      return true;
    });

    const sortValCache = new Map<number, number>();
    if (matrixSortBy === 'xP' || !matrixSortBy) {
      list.forEach(p => sortValCache.set(p.id, getPlayerGameweekXp(p.id, selectedGameweek)));
    } else if (matrixSortBy === 'horizonXp') {
      list.forEach(p => sortValCache.set(p.id, getPlayerHorizonXp(p.id, matrixHorizon)));
    }

    return list.sort((a, b) => {
      let valA: number = 0;
      let valB: number = 0;

      switch (matrixSortBy) {
        case 'name':
          return matrixSortDirection === 'asc' 
            ? a.web_name.localeCompare(b.web_name) 
            : b.web_name.localeCompare(a.web_name);
        case 'price':
          valA = a.now_cost;
          valB = b.now_cost;
          break;
        case 'apps':
          valA = (a.starts ?? 0) || (a.minutes && a.minutes > 0 ? Math.ceil(a.minutes / 90) : 0);
          valB = (b.starts ?? 0) || (b.minutes && b.minutes > 0 ? Math.ceil(b.minutes / 90) : 0);
          break;
        case 'mins':
          valA = a.minutes ?? 0;
          valB = b.minutes ?? 0;
          break;
        case 'xG':
          valA = matrixPer90 ? (a.expected_goals_per_90 || 0) : parseFloat(a.expected_goals || '0');
          valB = matrixPer90 ? (b.expected_goals_per_90 || 0) : parseFloat(b.expected_goals || '0');
          break;
        case 'goals':
          valA = a.goals_scored || 0;
          valB = b.goals_scored || 0;
          break;
        case 'threat':
          valA = parseFloat(a.threat || '0');
          valB = parseFloat(b.threat || '0');
          break;
        case 'xA':
          valA = matrixPer90 ? (a.expected_assists_per_90 || 0) : parseFloat(a.expected_assists || '0');
          valB = matrixPer90 ? (b.expected_assists_per_90 || 0) : parseFloat(b.expected_assists || '0');
          break;
        case 'assists':
          valA = a.assists || 0;
          valB = b.assists || 0;
          break;
        case 'creativity':
          valA = parseFloat(a.creativity || '0');
          valB = parseFloat(b.creativity || '0');
          break;
        case 'xGI':
          valA = matrixPer90 ? (a.expected_goal_involvements_per_90 || 0) : parseFloat(a.expected_goal_involvements || '0');
          valB = matrixPer90 ? (b.expected_goal_involvements_per_90 || 0) : parseFloat(b.expected_goal_involvements || '0');
          break;
        case 'xGC':
          valA = matrixPer90 ? (a.expected_goals_conceded_per_90 || 0) : parseFloat(a.expected_goals_conceded || '0');
          valB = matrixPer90 ? (b.expected_goals_conceded_per_90 || 0) : parseFloat(b.expected_goals_conceded || '0');
          break;
        case 'cs':
          valA = a.clean_sheets || 0;
          valB = b.clean_sheets || 0;
          break;
        case 'xP':
          valA = sortValCache.get(a.id) ?? 0;
          valB = sortValCache.get(b.id) ?? 0;
          valA = sortValCache.get(a.id) ?? 0;
          valB = sortValCache.get(b.id) ?? 0;
          break;
        case 'form':
          break;
        case 'bps':
          valA = a.bps || 0;
          valB = b.bps || 0;
          break;
        case 'total_points':
          valA = a.total_points || 0;
          valB = b.total_points || 0;
          break;
        default:
          valA = sortValCache.get(a.id) ?? 0;
          valB = sortValCache.get(b.id) ?? 0;
      }

      return matrixSortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [
    players,
    matrixPosition, 
    matrixTeamId, 
    matrixMinPrice, 
    matrixMaxPrice, 
    matrixSearch, 
    matrixSortBy, 
    matrixSortDirection, 
    matrixHorizon, 
    matrixPer90, 
    selectedGameweek, 
    getPlayerGameweekXp, 
    getPlayerHorizonXp,
    teamMap
  ]);

// Comprehensive tooltip explanations for all matrix metrics
const COLUMN_TOOLTIPS: Record<string, string> = {
  name: 'Player Name, Position and Club',
  pos: 'Player Position (GKP, DEF, MID, FWD)',
  price: 'Current player market price in millions (£m)',
  mins: 'Total minutes played on pitch this season',
  xG: 'Expected Goals — statistical measure of the quality and probability of scoring chances',
  threat: 'Official FPL Threat — gauge of player goal threat and penalty box danger',
  goals: 'Total actual goals scored this season',
  xGI: 'Expected Goal Involvement — combined probability of scoring or assisting (xG + xA)',
  total_points: 'Total official FPL points scored so far this season',
  xA: 'Expected Assists — probability that a pass will lead directly to a goal',
  creativity: 'Official FPL Creativity — frequency and quality of chance creation for teammates',
  assists: 'Total actual assists awarded this season',
  xGC: 'Expected Goals Conceded — defensive metric measuring opponent scoring danger',
  cs: 'Clean Sheets — matches where the team conceded 0 goals (while player played 60+ minutes)',
  xP: 'AI Projected Points for the selected Gameweek (OpenFPL Machine Learning)',
  horizonXp: 'Cumulative AI Projected Points across the selected Gameweek horizon',
  form: 'Official FPL Form — average points scored per match over the last 30 days',
  bps: 'Bonus Points System score — match activity metric determining 3, 2, 1 bonus points',
  transfers_today: 'Net transfers in/out during the current 24-hour daily cycle',
  velocity: 'Hourly transfer rate speed (% progress per hour towards price threshold)',
  target_progress: 'Percentage progress towards overnight price rise (+100%) or fall (-100%) threshold',
  timing: 'Estimated timing when price change is forecasted to trigger (e.g. Tonight, Tomorrow)',
  prediction: 'AI Price prediction status (Rising, Falling, Approaching, Stable)',
  action: 'Quick transfer scout and detail actions',
};

  const renderSortHeader = (label: string, sortKey: string, align: 'left' | 'center' | 'right' = 'center', customTooltip?: string) => {
    const isActive = matrixSortBy === sortKey;
    const alignClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
    const tooltipText = customTooltip || COLUMN_TOOLTIPS[sortKey] || label;

    return (
      <button
        onClick={() => setMatrixSort(sortKey)}
        title={tooltipText}
        className={`group flex items-center gap-1 w-full text-[11px] font-black uppercase tracking-wider transition-colors select-none cursor-pointer ${alignClass} ${
          isActive ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-white'
        }`}
      >
        <span title={tooltipText}>{label}</span>
        {isActive ? (
          matrixSortDirection === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-emerald-400" />
          ) : (
            <ArrowDown className="w-3 h-3 text-emerald-400" />
          )
        ) : (
          <ArrowUpDown className="w-2.5 h-2.5 opacity-30 group-hover:opacity-100" />
        )}
      </button>
    );
  };

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-2 sm:px-4 py-4 flex flex-col gap-5">
      {/* 1. Filter and Control Bar */}
      <MatrixFilterBar />

      {/* 2. Main Content View Card */}
      <div className="w-full bg-slate-900/80 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {matrixViewTab === 'price_radar' ? (
          /* ========================================================
             PRICE CHANGE & TRANSFER VELOCITY RADAR VIEW
             ======================================================== */
          <>
            {/* Top Summary Banner */}
            <div className="px-6 py-3.5 border-b border-white/10 bg-slate-950/70 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <strong className="text-white font-mono">{processedPricePredictions.length}</strong> players monitored
                </span>
                <span className="text-slate-600">·</span>
                <span>FPL Deadline: <strong className="text-white font-mono">01:30 AM GMT</strong> tonight</span>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Rise Quota (100%+)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Fall Quota (-100%+)</span>
              </div>
            </div>

            {/* Price Radar Table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-slate-950/90 border-b border-white/15 text-slate-400 font-mono text-[11px]">
                    <th className="py-3.5 px-4 min-w-[210px]">
                      {renderSortHeader('Player', 'name', 'left')}
                    </th>
                    <th className="py-3.5 px-3 text-center w-16" title={COLUMN_TOOLTIPS.pos}>
                      <span className="cursor-help">Pos</span>
                    </th>
                    <th className="py-3.5 px-3 text-right w-20">
                      {renderSortHeader('Price', 'price', 'right')}
                    </th>
                    <th className="py-3.5 px-3 text-right w-32">
                      {renderSortHeader('Transfers Today', 'transfers_today', 'right')}
                    </th>
                    <th className="py-3.5 px-3 text-right w-28" title={COLUMN_TOOLTIPS.velocity}>
                      <span className="cursor-help">Velocity</span>
                    </th>
                    <th className="py-3.5 px-4 text-center min-w-[180px]">
                      {renderSortHeader('Target Progress', 'target_progress')}
                    </th>
                    <th className="py-3.5 px-3 text-center w-28" title={COLUMN_TOOLTIPS.timing}>
                      <span className="cursor-help">Timing</span>
                    </th>
                    <th className="py-3.5 px-4 text-center w-36" title={COLUMN_TOOLTIPS.prediction}>
                      <span className="cursor-help">Prediction</span>
                    </th>
                    <th className="py-3.5 px-4 text-right w-20" title={COLUMN_TOOLTIPS.action}>
                      <span className="cursor-help">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium text-slate-200 text-xs">
                  {processedPricePredictions.map(item => {
                    const p = item.player;
                    const team = teamMap.get(p.team);
                    const posName = p.element_type === 1 ? 'GKP' : p.element_type === 2 ? 'DEF' : p.element_type === 3 ? 'MID' : 'FWD';
                    const isRise = item.targetProgress > 0;
                    const absProgress = Math.min(100, Math.abs(item.targetProgress));
                    const deltaStr = item.seasonDelta > 0 ? `+£${item.seasonDelta.toFixed(1)}m` : item.seasonDelta < 0 ? `-£${Math.abs(item.seasonDelta).toFixed(1)}m` : '£0.0m';

                    const fillBg = isRise 
                      ? (item.targetProgress >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400')
                      : (item.targetProgress <= -100 ? 'bg-gradient-to-r from-rose-500 to-red-400 shadow-sm shadow-rose-400/50' : 'bg-rose-400/70');

                    return (
                      <tr 
                        key={p.id}
                        onClick={() => openPlayerDetail(p.id)}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      >
                        {/* Player Info */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <KitIcon teamCode={team?.code} teamShortName={team?.short_name} isGoalkeeper={p.element_type === 1} className="w-7 h-7 shrink-0" />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-white text-sm group-hover:text-emerald-400 transition-colors">
                                  {p.web_name}
                                </span>
                                {item.isInSquad && (
                                  <span className="text-[9px] bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold px-1.5 py-0.2 rounded">
                                    SQUAD
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {team?.short_name || 'TBD'} · {deltaStr} Season
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Position */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="text-[10.5px] font-black px-2 py-0.5 rounded-lg bg-slate-950 border border-white/10 text-slate-300">
                            {posName}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-3 text-right font-mono font-black text-sm text-white">
                          £{(item.nowCost / 10).toFixed(1)}m
                        </td>

                        {/* Net Transfers Today */}
                        <td className={`py-3.5 px-3 text-right font-mono font-black text-xs ${
                          item.netTransfersToday > 0 ? 'text-emerald-400' : item.netTransfersToday < 0 ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {item.netTransfersToday > 0 ? '+' : ''}{item.netTransfersToday.toLocaleString()}
                        </td>

                        {/* Hourly Velocity */}
                        <td className="py-3.5 px-3 text-right font-mono text-xs">
                          <span className={`px-1.5 py-0.5 rounded-md font-bold ${
                            item.hourlyVelocity > 0 ? 'text-emerald-300 bg-emerald-950/60' : item.hourlyVelocity < 0 ? 'text-rose-300 bg-rose-950/60' : 'text-slate-400'
                          }`}>
                            {item.hourlyVelocityText}
                          </span>
                        </td>

                        {/* Target Progress Meter */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-between text-[11px] font-mono font-black mb-1">
                            <span className={isRise ? (item.targetProgress >= 100 ? 'text-emerald-400' : 'text-amber-400') : 'text-rose-400'}>
                              {item.targetProgress > 0 ? '+' : ''}{item.targetProgress.toFixed(1)}%
                            </span>
                            <span className="text-[9px] text-slate-500 uppercase font-mono">Target 100%</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/10">
                            <div 
                              className={`h-full ${fillBg} rounded-full transition-all duration-300`} 
                              style={{ width: `${absProgress}%` }}
                            />
                          </div>
                        </td>

                        {/* Timing */}
                        <td className="py-3.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-mono font-bold border ${
                            item.changeTime === 'Tonight' 
                              ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 animate-pulse'
                              : item.changeTime === 'Tomorrow'
                              ? 'bg-slate-900 text-slate-300 border-white/10'
                              : item.changeTime === 'Locked'
                              ? 'bg-slate-950 text-slate-500 border-white/5'
                              : 'text-slate-500 border-transparent'
                          }`}>
                            {item.changeTime}
                          </span>
                        </td>

                        {/* Prediction */}
                        <td className="py-3.5 px-4 text-center">
                          {item.isLocked ? (
                            <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-white/10 text-slate-400 font-bold text-[10.5px] flex items-center justify-center gap-1 mx-auto w-max">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          ) : (item.status === 'rising' || (item.changeTime === 'Tonight' && item.targetProgress > 0)) ? (
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 font-black text-[11px] shadow-sm animate-pulse flex items-center justify-center gap-1 mx-auto w-max">
                              <Flame className="w-3.5 h-3.5 text-emerald-400" /> RISE (+£0.1m)
                            </span>
                          ) : (item.status === 'falling' || (item.changeTime === 'Tonight' && item.targetProgress < 0)) ? (
                            <span className="px-2.5 py-1 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-300 font-black text-[11px] shadow-sm animate-pulse flex items-center justify-center gap-1 mx-auto w-max">
                              <Snowflake className="w-3.5 h-3.5 text-rose-400" /> FALL (-£0.1m)
                            </span>
                          ) : (item.status === 'approaching_rise' || item.targetProgress >= 75) ? (
                            <span className="px-2.5 py-1 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold text-[10.5px] flex items-center justify-center gap-1 mx-auto w-max">
                              <Zap className="w-3 h-3 text-amber-400" /> Likely Soon
                            </span>
                          ) : (item.status === 'approaching_fall' || item.targetProgress <= -75) ? (
                            <span className="px-2.5 py-1 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 font-semibold text-[10.5px] flex items-center justify-center gap-1 mx-auto w-max">
                              At Risk
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px] font-mono">Stable</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          {item.isInSquad ? (
                            <span className="text-xs text-slate-500 font-bold">In Squad</span>
                          ) : !isLocked ? (
                            <button
                              onClick={() => openTransferDrawer(p.id)}
                              className="px-3 py-1 rounded-xl bg-slate-950 hover:bg-emerald-600 border border-white/10 hover:border-emerald-500 text-slate-200 hover:text-white font-bold transition-all text-xs shadow"
                            >
                              Buy
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {processedPricePredictions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                        No players found matching your radar filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* ========================================================
             PERFORMANCE & STATS MATRIX VIEW
             ======================================================== */
          <>
            {/* Top Table Info Bar */}
            <div className="px-5 py-3 border-b border-white/10 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300">{processedPlayers.length}</span>
                <span>players matching filters</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                {showAiPredictions ? (
                  <span className="font-mono text-emerald-400 font-bold">● Live Projections Active</span>
                ) : (
                  <span className="font-mono text-slate-400 font-bold">● Official Match Stats</span>
                )}
                <span>· Sorted by <strong className="text-white uppercase">{matrixSortBy}</strong></span>
              </div>
            </div>

            {/* Scrollable Table Area */}
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-white/10 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    <th colSpan={3} className="py-2.5 px-4 text-left border-r border-white/10" title="Player identity, club, position, pricing and match minutes">
                      <span className="cursor-help">Player Information</span>
                    </th>
                    <th colSpan={3} className="py-2.5 px-3 text-center border-r border-white/10 bg-rose-950/20 text-rose-300" title="Underlying attacking shooting metrics, expected goals & goal conversion">
                      <span className="cursor-help">Goal Threat</span>
                    </th>
                    <th colSpan={2} className="py-2.5 px-3 text-center border-r border-white/10 bg-amber-950/20 text-amber-300" title="Overall offensive involvement (xG + xA) and total season points">
                      <span className="cursor-help">Involvement</span>
                    </th>
                    <th colSpan={3} className="py-2.5 px-3 text-center border-r border-white/10 bg-blue-950/20 text-blue-300" title="Key passes, expected assists, and chance creation for teammates">
                      <span className="cursor-help">Creativity</span>
                    </th>
                    <th colSpan={2} className="py-2.5 px-3 text-center border-r border-white/10 bg-indigo-950/20 text-indigo-300" title="Defensive security, expected goals conceded (xGC) and clean sheet equity">
                      <span className="cursor-help">Defensive</span>
                    </th>
                    {showAiPredictions ? (
                      <th colSpan={3} className="py-2.5 px-4 text-center bg-emerald-950/30 text-emerald-300" title="OpenFPL Bayesian Expected Points (xP) ML projections">
                        <span className="cursor-help">AI Projections</span>
                      </th>
                    ) : (
                      <th colSpan={1} className="py-2.5 px-3 text-center border-r border-white/10 text-slate-300" title="Average points scored per match over the last 30 days">
                        <span className="cursor-help">Form</span>
                      </th>
                    )}
                    <th className="py-2.5 px-3 text-center" title="Direct transfer scout and player detail modal actions">
                      <span className="cursor-help">Action</span>
                    </th>
                  </tr>

                  {/* Sub-Column Header Row */}
                  <tr className="bg-slate-950 border-b border-white/15 text-slate-400 font-mono text-[11px]">
                    <th className="py-3 px-4 min-w-[200px]">
                      {renderSortHeader('Player', 'name', 'left')}
                    </th>
                    <th className="py-3 px-2 text-center w-16">
                      {renderSortHeader('Price', 'price')}
                    </th>
                    <th className="py-3 px-2 text-center w-14 border-r border-white/10">
                      {renderSortHeader('Mins', 'mins')}
                    </th>

                    <th className="py-3 px-2 text-center w-16 bg-rose-950/10">
                      {renderSortHeader(matrixPer90 ? 'xG/90' : 'xG', 'xG')}
                    </th>
                    <th className="py-3 px-2 text-center w-14 bg-rose-950/10">
                      {renderSortHeader('Threat', 'threat')}
                    </th>
                    <th className="py-3 px-2 text-center w-14 bg-rose-950/10 border-r border-white/10">
                      {renderSortHeader('Goals', 'goals')}
                    </th>

                    <th className="py-3 px-2 text-center w-16 bg-amber-950/10">
                      {renderSortHeader(matrixPer90 ? 'xGI/90' : 'xGI', 'xGI')}
                    </th>
                    <th className="py-3 px-2 text-center w-16 bg-amber-950/10 border-r border-white/10">
                      {renderSortHeader('Points', 'total_points')}
                    </th>

                    <th className="py-3 px-2 text-center w-16 bg-blue-950/10">
                      {renderSortHeader(matrixPer90 ? 'xA/90' : 'xA', 'xA')}
                    </th>
                    <th className="py-3 px-2 text-center w-14 bg-blue-950/10">
                      {renderSortHeader('Create', 'creativity')}
                    </th>
                    <th className="py-3 px-2 text-center w-14 bg-blue-950/10 border-r border-white/10">
                      {renderSortHeader('Assists', 'assists')}
                    </th>

                    <th className="py-3 px-2 text-center w-16 bg-indigo-950/10">
                      {renderSortHeader(matrixPer90 ? 'xGC/90' : 'xGC', 'xGC')}
                    </th>
                    <th className="py-3 px-2 text-center w-14 bg-indigo-950/10 border-r border-white/10">
                      {renderSortHeader('CS', 'cs')}
                    </th>

                    {showAiPredictions ? (
                      <>
                        <th className="py-3 px-3 text-center w-20 bg-emerald-950/20 text-emerald-300">
                          {renderSortHeader(`GW${selectedGameweek} xP`, 'xP')}
                        </th>
                        <th className="py-3 px-3 text-center w-20 bg-emerald-950/20 text-emerald-300">
                          {renderSortHeader(`${matrixHorizon}GW xP`, 'horizonXp')}
                        </th>
                        <th className="py-3 px-2 text-center w-14 bg-emerald-950/20 text-emerald-300 border-r border-white/10">
                          {renderSortHeader('Form', 'form')}
                        </th>
                      </>
                    ) : (
                      <th className="py-3 px-3 text-center w-16 border-r border-white/10">
                        {renderSortHeader('Form', 'form')}
                      </th>
                    )}

                    <th className="py-3 px-3 text-center w-16">
                      Buy
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5 font-medium text-slate-200 text-xs">
                  {processedPlayers.map(p => {
                    const team = teamMap.get(p.team);
                    const isInSquad = squadElementIds.has(p.id);
                    const posName = p.element_type === 1 ? 'GKP' : p.element_type === 2 ? 'DEF' : p.element_type === 3 ? 'MID' : 'FWD';
                    const xgVal = matrixPer90 ? (p.expected_goals_per_90 || 0).toFixed(2) : parseFloat(p.expected_goals || '0').toFixed(1);
                    const xaVal = matrixPer90 ? (p.expected_assists_per_90 || 0).toFixed(2) : parseFloat(p.expected_assists || '0').toFixed(1);
                    const xgiVal = matrixPer90 ? (p.expected_goal_involvements_per_90 || 0).toFixed(2) : parseFloat(p.expected_goal_involvements || '0').toFixed(1);
                    const xgcVal = matrixPer90 ? (p.expected_goals_conceded_per_90 || 0).toFixed(2) : parseFloat(p.expected_goals_conceded || '0').toFixed(1);

                    const gwXp = getPlayerGameweekXp(p.id, selectedGameweek);
                    const horizonXp = getPlayerHorizonXp(p.id, matrixHorizon);

                    return (
                      <tr 
                        key={p.id}
                        onClick={() => openPlayerDetail(p.id)}
                        className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <KitIcon teamCode={team?.code} teamShortName={team?.short_name} isGoalkeeper={p.element_type === 1} className="w-6 h-6 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white truncate group-hover:text-emerald-400 transition-colors text-xs sm:text-sm">
                                  {p.web_name}
                                </span>
                                {isInSquad && (
                                  <span className="text-[9px] bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-bold px-1 rounded">
                                    SQUAD
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400 font-mono">
                                <span>{team?.short_name}</span>
                                <span>·</span>
                                <span>{posName}</span>
                                {(() => {
                                  const eo = getPlayerTop10kEo(p.id);
                                  const sp = getPlayerSetPieceProfile(p, team?.short_name);
                                  return (
                                    <>
                                      {eo && eo.effectiveOwnership >= 20 && (
                                        <span className="text-[9px] font-bold text-cyan-300 bg-cyan-950/80 px-1 py-0.2 rounded border border-cyan-500/30">
                                          {eo.effectiveOwnership}% EO
                                        </span>
                                      )}
                                      {sp.roles.slice(0, 1).map((r, i) => (
                                        <span key={i} className="text-[9px] font-bold text-amber-300 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/30">
                                          {r}
                                        </span>
                                      ))}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-2 text-center font-mono font-black text-emerald-400">
                          £{(p.now_cost / 10).toFixed(1)}
                        </td>

                        <td className="py-2.5 px-2 text-center font-mono text-slate-400 border-r border-white/10">
                          {p.minutes ?? 0}
                        </td>

                        <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-400 bg-rose-950/5">
                          {xgVal}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-300 bg-rose-950/5">
                          {p.threat || '0'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-black text-white bg-rose-950/5 border-r border-white/10">
                          {p.goals_scored || 0}
                        </td>

                        <td className="py-2.5 px-2 text-center font-mono font-black text-amber-400 bg-amber-950/5">
                          {xgiVal}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-white bg-amber-950/5 border-r border-white/10">
                          {p.total_points || 0}
                        </td>

                        <td className="py-2.5 px-2 text-center font-mono font-bold text-blue-400 bg-blue-950/5">
                          {xaVal}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-300 bg-blue-950/5">
                          {p.creativity || '0'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-black text-white bg-blue-950/5 border-r border-white/10">
                          {p.assists || 0}
                        </td>

                        <td className="py-2.5 px-2 text-center font-mono text-indigo-300 bg-indigo-950/5">
                          {xgcVal}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-white bg-indigo-950/5 border-r border-white/10">
                          {p.clean_sheets || 0}
                        </td>

                        {showAiPredictions ? (
                          <>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-400 bg-emerald-950/20 text-sm">
                              {gwXp.toFixed(1)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-teal-300 bg-emerald-950/20">
                              {horizonXp.toFixed(1)}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-300 bg-emerald-950/20 border-r border-white/10">
                              {p.form || '0.0'}
                            </td>
                          </>
                        ) : (
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-200 border-r border-white/10">
                            {p.form || '0.0'}
                          </td>
                        )}

                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {!isLocked && !isInSquad ? (
                            <button
                              onClick={() => openTransferDrawer(p.id)}
                              className="p-1.5 rounded-xl bg-slate-950 hover:bg-emerald-600 text-slate-300 hover:text-white border border-white/10 transition-colors shadow"
                              title={`Buy ${p.web_name}`}
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                            </button>
                          ) : isInSquad ? (
                            <span className="text-[10px] text-emerald-500 font-bold">Owned</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {processedPlayers.length === 0 && (
                    <tr>
                      <td colSpan={15} className="py-12 text-center text-slate-500 font-medium">
                        No players found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};