'use client';

import React, { useState, useMemo } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { UI_TEXT } from '@/lib/ui-text';
import { KitIcon } from '@/components/ui/KitIcon';
import { 
  AlertTriangle, 
  Search, 
  ShoppingBag, 
  Plane, 
  ShieldAlert, 
  Sparkles,
  Users
} from 'lucide-react';
import { RiskLevel } from '@/utils/aiLineupRiskEngine';

export const LineupRiskRadar: React.FC = () => {
  const { 
    players, 
    teamMap, 
    selectedGameweek, 
    gameweekPlans, 
    openPlayerDetail, 
    openTransferDrawer,
    getPlayerLineupRisk
  } = usePlannerStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'squad' | 'high' | 'doubtful' | 'fatigue'>('squad');

  const currentSquad = useMemo(() => {
    const picks = gameweekPlans[selectedGameweek]?.squad || [];
    return new Set(picks.map(p => p.element));
  }, [gameweekPlans, selectedGameweek]);

  // Evaluate all players
  const evaluatedPlayers = useMemo(() => {
    return players
      .map(p => {
        const team = teamMap.get(p.team);
        const risk = getPlayerLineupRisk(p.id);
        const inSquad = currentSquad.has(p.id);
        return {
          player: p,
          team,
          risk,
          inSquad
        };
      })
      .filter(item => item.risk.riskLevel !== 'safe');
  }, [players, teamMap, getPlayerLineupRisk, currentSquad]);

  // Filtered list
  const filteredList = useMemo(() => {
    return evaluatedPlayers.filter(item => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.player.web_name.toLowerCase().includes(query) || 
                            item.player.first_name.toLowerCase().includes(query) || 
                            item.player.second_name.toLowerCase().includes(query);
        const matchesTeam = item.team?.name.toLowerCase().includes(query) || 
                            item.team?.short_name.toLowerCase().includes(query);
        if (!matchesName && !matchesTeam) return false;
      }

      // 2. Category filter
      if (activeFilter === 'squad') return item.inSquad;
      if (activeFilter === 'high') return item.risk.riskLevel === 'high';
      if (activeFilter === 'doubtful') return item.risk.riskLevel === 'doubtful' || item.risk.riskLevel === 'medium';
      if (activeFilter === 'fatigue') return item.risk.riskLevel === 'fatigue';
      return true;
    });
  }, [evaluatedPlayers, searchQuery, activeFilter]);

  // Squad at-risk count
  const squadAtRisk = useMemo(() => {
    return evaluatedPlayers.filter(item => item.inSquad);
  }, [evaluatedPlayers]);

  const getRiskBadgeStyles = (level: RiskLevel) => {
    switch (level) {
      case 'high':
        return 'bg-rose-950/80 text-rose-300 border-rose-500/40';
      case 'fatigue':
        return 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      case 'doubtful':
      case 'medium':
        return 'bg-amber-950/80 text-amber-300 border-amber-500/40';
      default:
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-4 space-y-5 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-white/10 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10.5px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Live Pre-Deadline Intelligence
              </span>
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10.5px] font-black px-2 py-0.5 rounded-full font-mono">
                {squadAtRisk.length} Squad Traps Flagged
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              🚨 {UI_TEXT.rotationRisk.title}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              {UI_TEXT.rotationRisk.subtitle}
            </p>
          </div>

          {/* Search Box */}
          <div className="w-full md:w-72 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player or team..."
              className="w-full bg-slate-950/80 border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Filter Switcher */}
        <div className="flex flex-wrap items-center gap-2 mt-5 border-t border-white/10 pt-4">
          <button
            onClick={() => setActiveFilter('squad')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              activeFilter === 'squad'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 font-extrabold'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Your Squad Only ({squadAtRisk.length})
          </button>
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeFilter === 'all'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-extrabold'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            All League Traps ({evaluatedPlayers.length})
          </button>
          <button
            onClick={() => setActiveFilter('high')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              activeFilter === 'high'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> High Bench Risk
          </button>
          <button
            onClick={() => setActiveFilter('doubtful')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeFilter === 'doubtful'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 font-extrabold'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Doubtful / Illness
          </button>
          <button
            onClick={() => setActiveFilter('fatigue')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              activeFilter === 'fatigue'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Plane className="w-3.5 h-3.5" /> European Fatigue
          </button>
        </div>
      </div>

      {/* 2. Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredList.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-slate-900/60 rounded-3xl border border-white/10">
            <Sparkles className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <h3 className="text-base font-bold text-white">No rotation traps found</h3>
            <p className="text-xs text-slate-400 mt-1">All players in this filter category have 100% starting certainty.</p>
          </div>
        ) : (
          filteredList.map(({ player, team, risk, inSquad }) => {
            return (
              <div
                key={player.id}
                onClick={() => openPlayerDetail(player.id)}
                className={`bg-slate-900/85 backdrop-blur-md border rounded-2xl p-4 space-y-3 cursor-pointer transition-all shadow-lg hover:scale-[1.01] ${
                  inSquad ? 'border-amber-500/40 bg-slate-900/95 ring-1 ring-amber-500/20' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <KitIcon
                      teamCode={team?.code}
                      teamShortName={team?.short_name}
                      isGoalkeeper={player.element_type === 1}
                      className="w-10 h-10 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-black text-white">{player.web_name}</h3>
                        {inSquad && (
                          <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded uppercase font-mono">
                            In Squad
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {team?.name || 'Premier League'} · £{(player.now_cost / 10).toFixed(1)}m
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full font-black text-xs font-mono border ${getRiskBadgeStyles(risk.riskLevel)}`}>
                    {UI_TEXT.rotationRisk.badges.startProbability(risk.startProbability)}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                    {UI_TEXT.rotationRisk.detailModal.aiVerdictLabel}
                  </span>
                  <p className="text-xs text-slate-200 font-medium leading-snug">
                    {risk.humanReason}
                  </p>
                </div>

                {player.news && (
                  <p className="text-[11px] text-slate-400 italic bg-slate-950/40 p-2 rounded-lg border border-white/5 truncate">
                    &ldquo;{player.news}&rdquo;
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Exp. Minutes: <strong className="text-white font-bold">~{risk.expectedMinutes}m</strong>
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openTransferDrawer(player.id);
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow"
                  >
                    <ShoppingBag className="w-3 h-3" /> Replace
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

