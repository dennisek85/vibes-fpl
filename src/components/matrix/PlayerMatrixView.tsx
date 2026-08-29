'use client';

import React, { useMemo } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { MatrixFilterBar } from './MatrixFilterBar';
import { KitIcon } from '@/components/ui/KitIcon';
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
  CheckCircle2,
  Lock
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
    getPlayerGameweekXp,
    getPlayerHorizonXp,
    openTransferDrawer,
    selectedGameweek,
    isGameweekLocked,
    gameweekPlans
  } = usePlannerStore();

  const isLocked = isGameweekLocked(selectedGameweek);
  const currentPlan = gameweekPlans[selectedGameweek];
  const squadElementIds = useMemo(() => {
    return new Set(currentPlan?.squad?.map(p => p.element) || []);
  }, [currentPlan]);

  // Filter and sort players
  const processedPlayers = useMemo(() => {
    let list = players.filter(p => {
      // Position filter
      if (matrixPosition !== null && p.element_type !== matrixPosition) return false;
      // Team filter
      if (matrixTeamId !== null && p.team !== matrixTeamId) return false;
      // Price filter
      if (p.now_cost < matrixMinPrice || p.now_cost > matrixMaxPrice) return false;
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

    // Compute derived sorting values
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
          valA = getPlayerGameweekXp(a.id, selectedGameweek);
          valB = getPlayerGameweekXp(b.id, selectedGameweek);
          break;
        case 'horizonXp':
          valA = getPlayerHorizonXp(a.id, matrixHorizon);
          valB = getPlayerHorizonXp(b.id, matrixHorizon);
          break;
        case 'form':
          valA = parseFloat(a.form || '0');
          valB = parseFloat(b.form || '0');
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
          valA = getPlayerGameweekXp(a.id, selectedGameweek);
          valB = getPlayerGameweekXp(b.id, selectedGameweek);
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

  const renderSortHeader = (label: string, sortKey: string, align: 'left' | 'center' | 'right' = 'center') => {
    const isActive = matrixSortBy === sortKey;
    const alignClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';

    return (
      <button
        onClick={() => setMatrixSort(sortKey)}
        className={`flex items-center gap-1 w-full text-[11px] font-black uppercase tracking-wider transition-colors select-none ${alignClass} ${
          isActive ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-white'
        }`}
      >
        <span>{label}</span>
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
    <div className="w-full flex flex-col gap-4">
      {/* Matrix Controls & Filters */}
      <MatrixFilterBar />

      {/* Main High-Density Matrix Table */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md rounded-3xl border border-white/15 shadow-2xl overflow-hidden flex flex-col">
        {/* Table Summary Bar */}
        <div className="px-5 py-3 border-b border-white/10 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">{processedPlayers.length}</span>
            <span>players matching filters</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-mono text-emerald-400 font-bold">● Live Projections Active</span>
            <span>· Sorted by <strong className="text-white uppercase">{matrixSortBy}</strong></span>
          </div>
        </div>

        {/* Scrollable Table Area */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            {/* Top Category Groups Header */}
            <thead>
              <tr className="bg-slate-950/80 border-b border-white/10 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                <th colSpan={3} className="py-2.5 px-4 text-left border-r border-white/10">
                  Player Information
                </th>
                <th colSpan={3} className="py-2.5 px-3 text-center border-r border-white/10 bg-rose-950/20 text-rose-300">
                  Goal Threat
                </th>
                <th colSpan={2} className="py-2.5 px-3 text-center border-r border-white/10 bg-amber-950/20 text-amber-300">
                  Involvement
                </th>
                <th colSpan={3} className="py-2.5 px-3 text-center border-r border-white/10 bg-blue-950/20 text-blue-300">
                  Creativity
                </th>
                <th colSpan={2} className="py-2.5 px-3 text-center border-r border-white/10 bg-indigo-950/20 text-indigo-300">
                  Defensive
                </th>
                <th colSpan={3} className="py-2.5 px-4 text-center bg-emerald-950/30 text-emerald-300">
                  AI Projections
                </th>
                <th className="py-2.5 px-3 text-center">
                  Action
                </th>
              </tr>

              {/* Sub-Column Header Row */}
              <tr className="bg-slate-950 border-b border-white/15 text-slate-400 font-mono text-[11px]">
                {/* 1. Player Info */}
                <th className="py-3 px-4 min-w-[200px]">
                  {renderSortHeader('Player', 'name', 'left')}
                </th>
                <th className="py-3 px-2 text-center w-16">
                  {renderSortHeader('Price', 'price')}
                </th>
                <th className="py-3 px-2 text-center w-14 border-r border-white/10">
                  {renderSortHeader('Mins', 'mins')}
                </th>

                {/* 2. Goal Threat */}
                <th className="py-3 px-2 text-center w-16 bg-rose-950/10">
                  {renderSortHeader(matrixPer90 ? 'xG/90' : 'xG', 'xG')}
                </th>
                <th className="py-3 px-2 text-center w-14 bg-rose-950/10">
                  {renderSortHeader('Threat', 'threat')}
                </th>
                <th className="py-3 px-2 text-center w-14 bg-rose-950/10 border-r border-white/10">
                  {renderSortHeader('Goals', 'goals')}
                </th>

                {/* 3. Goal Involvement */}
                <th className="py-3 px-2 text-center w-16 bg-amber-950/10">
                  {renderSortHeader(matrixPer90 ? 'xGI/90' : 'xGI', 'xGI')}
                </th>
                <th className="py-3 px-2 text-center w-16 bg-amber-950/10 border-r border-white/10">
                  {renderSortHeader('Points', 'total_points')}
                </th>

                {/* 4. Creativity */}
                <th className="py-3 px-2 text-center w-16 bg-blue-950/10">
                  {renderSortHeader(matrixPer90 ? 'xA/90' : 'xA', 'xA')}
                </th>
                <th className="py-3 px-2 text-center w-14 bg-blue-950/10">
                  {renderSortHeader('Create', 'creativity')}
                </th>
                <th className="py-3 px-2 text-center w-14 bg-blue-950/10 border-r border-white/10">
                  {renderSortHeader('Assists', 'assists')}
                </th>

                {/* 5. Defensive */}
                <th className="py-3 px-2 text-center w-16 bg-indigo-950/10">
                  {renderSortHeader(matrixPer90 ? 'xGC/90' : 'xGC', 'xGC')}
                </th>
                <th className="py-3 px-2 text-center w-14 bg-indigo-950/10 border-r border-white/10">
                  {renderSortHeader('CS', 'cs')}
                </th>

                {/* 6. AI Projections */}
                <th className="py-3 px-3 text-center w-20 bg-emerald-950/20 text-emerald-300">
                  {renderSortHeader(`GW${selectedGameweek} xP`, 'xP')}
                </th>
                <th className="py-3 px-3 text-center w-20 bg-emerald-950/20 text-emerald-300">
                  {renderSortHeader(`${matrixHorizon}GW xP`, 'horizonXp')}
                </th>
                <th className="py-3 px-2 text-center w-14 bg-emerald-950/20 text-emerald-300 border-r border-white/10">
                  {renderSortHeader('Form', 'form')}
                </th>

                {/* Action */}
                <th className="py-3 px-3 text-center w-24">
                  Plan
                </th>
              </tr>
            </thead>

            {/* Table Body Rows */}
            <tbody className="divide-y divide-white/5 font-mono text-xs text-slate-300">
              {processedPlayers.slice(0, 100).map((player, idx) => {
                const team = teamMap.get(player.team);
                const posLabel = player.element_type === 1 ? 'GKP' : player.element_type === 2 ? 'DEF' : player.element_type === 3 ? 'MID' : 'FWD';
                const posBadgeBg = player.element_type === 1 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                                   player.element_type === 2 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                   player.element_type === 3 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                   'bg-rose-500/20 text-rose-300 border-rose-500/30';

                const nextXp = getPlayerGameweekXp(player.id, selectedGameweek);
                const horizonXp = getPlayerHorizonXp(player.id, matrixHorizon);
                const isInSquad = squadElementIds.has(player.id);

                return (
                  <tr
                    key={player.id}
                    className={`hover:bg-slate-800/60 transition-colors group ${
                      idx % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-950/40'
                    }`}
                  >
                    {/* Player Info */}
                    <td className="py-2.5 px-4 flex items-center gap-2.5 min-w-[200px]">
                      <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
                        <KitIcon 
                          teamCode={player.team_code} 
                          teamShortName={team?.short_name} 
                          isGoalkeeper={player.element_type === 1}
                          className="w-7 h-7 object-contain"
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs sm:text-sm truncate leading-tight group-hover:text-emerald-300 transition-colors">
                            {player.web_name}
                          </span>
                          {isInSquad && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1 rounded border border-emerald-500/30">
                              IN SQUAD
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-sans">
                          <span className={`text-[9px] font-black px-1 rounded border ${posBadgeBg}`}>
                            {posLabel}
                          </span>
                          <span>{team?.short_name || 'TBD'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-2.5 px-2 text-center font-bold text-emerald-400">
                      £{(player.now_cost / 10).toFixed(1)}m
                    </td>

                    {/* Minutes */}
                    <td className="py-2.5 px-2 text-center text-slate-400 border-r border-white/10">
                      {player.minutes || 0}
                    </td>

                    {/* Goal Threat: xG */}
                    <td className="py-2.5 px-2 text-center font-bold text-rose-300 bg-rose-950/5">
                      {matrixPer90 ? (player.expected_goals_per_90?.toFixed(2) || '0.00') : (parseFloat(player.expected_goals || '0').toFixed(2))}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-400 bg-rose-950/5">
                      {Math.round(parseFloat(player.threat || '0'))}
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-white bg-rose-950/5 border-r border-white/10">
                      {player.goals_scored || 0}
                    </td>

                    {/* Involvement: xGI & Points */}
                    <td className="py-2.5 px-2 text-center font-bold text-amber-300 bg-amber-950/5">
                      {matrixPer90 ? (player.expected_goal_involvements_per_90?.toFixed(2) || '0.00') : (parseFloat(player.expected_goal_involvements || '0').toFixed(2))}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-200 bg-amber-950/5 border-r border-white/10">
                      {player.total_points || 0}
                    </td>

                    {/* Creativity: xA, Creativity score, Assists */}
                    <td className="py-2.5 px-2 text-center font-bold text-blue-300 bg-blue-950/5">
                      {matrixPer90 ? (player.expected_assists_per_90?.toFixed(2) || '0.00') : (parseFloat(player.expected_assists || '0').toFixed(2))}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-400 bg-blue-950/5">
                      {Math.round(parseFloat(player.creativity || '0'))}
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-white bg-blue-950/5 border-r border-white/10">
                      {player.assists || 0}
                    </td>

                    {/* Defensive: xGC & Clean Sheets */}
                    <td className="py-2.5 px-2 text-center text-slate-400 bg-indigo-950/5">
                      {matrixPer90 ? (player.expected_goals_conceded_per_90?.toFixed(2) || '0.00') : (parseFloat(player.expected_goals_conceded || '0').toFixed(2))}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-indigo-300 bg-indigo-950/5 border-r border-white/10">
                      {player.clean_sheets || 0}
                    </td>

                    {/* AI Projections: GW xP, Horizon xP, Form */}
                    <td className="py-2.5 px-3 text-center font-black text-sm text-emerald-300 bg-emerald-950/15">
                      {nextXp.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-sm text-teal-300 bg-emerald-950/15 font-mono">
                      {horizonXp.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-300 bg-emerald-950/15 border-r border-white/10">
                      {player.form || '0.0'}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-center">
                      {!isLocked ? (
                        <button
                          onClick={() => openTransferDrawer(player.id)}
                          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white font-bold text-[11px] transition-all flex items-center gap-1 mx-auto active:scale-95 shadow"
                        >
                          <ShoppingBag className="w-3 h-3" />
                          <span>Buy</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-bold">Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};