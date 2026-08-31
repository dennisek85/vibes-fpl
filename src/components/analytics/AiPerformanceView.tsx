'use client';

import React, { useMemo, useState } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { calculateAiSeasonBacktest } from '@/utils/aiBacktestEngine';
import { UI_TEXT } from '@/lib/ui-text';
import { KitIcon } from '@/components/ui/KitIcon';
import { 
  TrendingUp, 
  Crown, 
  ArrowRightLeft, 
  Shield, 
  Target, 
  Sparkles, 
  Zap, 
  DollarSign, 
  Award,
  ArrowUpRight,
  Flame
} from 'lucide-react';

export const AiPerformanceView: React.FC = () => {
  const {
    teamSummary,
    teamHistoryCurrent,
    gameweekPlans,
    playerMap,
    players,
    events,
    getPlayerGameweekXp,
    liveEventPoints,
    fetchLivePointsForGameweek,
    teamMap
  } = usePlannerStore();

  const [activeTab, setActiveTab] = useState<'all' | 'captaincy' | 'transfers' | 'attribution'>('all');

  // Eagerly fetch real historical match points for all completed gameweeks to power backtest
  React.useEffect(() => {
    const completedEvents = events.filter(e => e.finished || e.is_current);
    completedEvents.forEach(ev => {
      fetchLivePointsForGameweek(ev.id);
    });
  }, [events, fetchLivePointsForGameweek]);

  const backtest = useMemo(() => {
    return calculateAiSeasonBacktest(
      teamSummary,
      teamHistoryCurrent,
      gameweekPlans,
      playerMap,
      players,
      events,
      getPlayerGameweekXp,
      liveEventPoints
    );
  }, [teamSummary, teamHistoryCurrent, gameweekPlans, playerMap, players, events, getPlayerGameweekXp, liveEventPoints]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">
      {/* 1. Header Banner */}
      <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {UI_TEXT.analytics.title}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl font-medium">
              {UI_TEXT.analytics.subtitle}
            </p>
          </div>

          {/* Quick Sub-Tab Filter */}
          <div className="flex items-center bg-slate-900 border border-white/10 rounded-2xl p-1 shadow-inner self-start md:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'all' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('captaincy')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'captaincy' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Captaincy
            </button>
            <button
              onClick={() => setActiveTab('transfers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'transfers' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Transfers
            </button>
            <button
              onClick={() => setActiveTab('attribution')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'attribution' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Attribution
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
          {/* Net AI Alpha */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {UI_TEXT.analytics.badges.aiAlpha}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                {UI_TEXT.analytics.badges.pointsDelta(backtest.netAlpha)}
              </span>
              <span className="text-xs font-bold text-emerald-300/80 font-mono flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" /> Edge
              </span>
            </div>
          </div>

          {/* Actual Season Points */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {UI_TEXT.analytics.badges.actualTotal}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-200 font-mono">
                {backtest.totalActualPoints} pts
              </span>
            </div>
          </div>

          {/* AI Co-Pilot Simulation */}
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {UI_TEXT.analytics.badges.simulatedTotal}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">
                {backtest.totalAiPoints} pts
              </span>
            </div>
          </div>

          {/* Projected Overall Rank */}
          <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {UI_TEXT.analytics.badges.rankProjection}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono">
                #{backtest.estimatedRank.toLocaleString()}
              </span>
              <span className="text-[10.5px] font-bold text-slate-400 line-through">
                #{backtest.actualRank.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Trajectory Drift Chart */}
      {(activeTab === 'all') && (
        <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                {UI_TEXT.analytics.sections.driftTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {UI_TEXT.analytics.sections.driftSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-full bg-slate-500 inline-block"></span> Actual
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block animate-pulse"></span> AI Co-Pilot
              </span>
            </div>
          </div>

          {/* Gameweek Step Progress View */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {backtest.driftTrajectory.map(pt => (
              <div key={pt.gw} className="bg-slate-900/90 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between shadow-md">
                <div>
                  <span className="text-xs font-black text-slate-400 uppercase font-mono block">
                    GW {pt.gw}
                  </span>
                  <span className="text-sm font-bold text-slate-200 mt-0.5 block">
                    Actual: <strong className="font-mono text-white">{pt.actualCumulative} pts</strong>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-emerald-400 font-mono block">
                    AI: {pt.aiCumulative} pts
                  </span>
                  <span className="text-[11px] font-bold text-emerald-300 font-mono">
                    +{pt.alpha} pts swing
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Captaincy Alpha Analyzer */}
      {(activeTab === 'all' || activeTab === 'captaincy') && (
        <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                {UI_TEXT.analytics.sections.captainTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {UI_TEXT.analytics.sections.captainSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl font-mono text-xs text-amber-300 font-black">
              Total Armband Swing: {backtest.totalCaptaincyDelta >= 0 ? `+${backtest.totalCaptaincyDelta}` : backtest.totalCaptaincyDelta} pts
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {backtest.captaincyComparisons.map(cap => {
              const uPlayer = cap.userCaptain?.player;
              const aPlayer = cap.aiCaptain?.player;
              const uTeam = uPlayer ? teamMap.get(uPlayer.team) : null;
              const aTeam = aPlayer ? teamMap.get(aPlayer.team) : null;

              return (
                <div key={cap.gw} className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-md space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-black text-amber-400 font-mono uppercase">
                      Gameweek {cap.gw}
                    </span>
                    <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${
                      cap.delta > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {cap.delta > 0 ? `+${cap.delta} pts AI Gain` : 'Matched'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* User Captain */}
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-white/5 flex items-center gap-2.5">
                      <KitIcon teamCode={uTeam?.code} teamShortName={uTeam?.short_name} className="w-9 h-9 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Your Pick</span>
                        <span className="text-xs font-black text-white truncate block">{uPlayer?.web_name || 'None'}</span>
                        <span className="text-xs font-mono font-bold text-slate-300 mt-0.5 block">
                          {cap.userCaptain?.doubledPoints ?? 0} pts (x2)
                        </span>
                      </div>
                    </div>

                    {/* AI Top Captain */}
                    <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/30 flex items-center gap-2.5">
                      <KitIcon teamCode={aTeam?.code} teamShortName={aTeam?.short_name} className="w-9 h-9 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-emerald-400 block uppercase flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" /> AI Pick
                        </span>
                        <span className="text-xs font-black text-emerald-200 truncate block">{aPlayer?.web_name || 'None'}</span>
                        <span className="text-xs font-mono font-bold text-emerald-300 mt-0.5 block">
                          {cap.aiCaptain?.doubledPoints ?? 0} pts (x2)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Points Attribution Breakdown */}
      {(activeTab === 'all' || activeTab === 'attribution') && (
        <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
          <div className="border-b border-white/10 pb-4">
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" />
              {UI_TEXT.analytics.sections.attributionTitle}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {UI_TEXT.analytics.sections.attributionSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {/* Clean Sheets */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5 uppercase">
                  <Shield className="w-4 h-4" /> {UI_TEXT.analytics.attribution.cleanSheets}
                </span>
                <span className="text-xs font-mono font-black text-emerald-400">
                  +{backtest.attribution.cleanSheets.points} pts
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                {UI_TEXT.analytics.attribution.cleanSheetsDesc}
              </p>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${backtest.attribution.cleanSheets.percentage}%` }}></div>
              </div>
            </div>

            {/* Goal Conversion */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-300 flex items-center gap-1.5 uppercase">
                  <Target className="w-4 h-4" /> {UI_TEXT.analytics.attribution.goals}
                </span>
                <span className="text-xs font-mono font-black text-emerald-400">
                  +{backtest.attribution.goals.points} pts
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                {UI_TEXT.analytics.attribution.goalsDesc}
              </p>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${backtest.attribution.goals.percentage}%` }}></div>
              </div>
            </div>

            {/* Assists & Creativity */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-300 flex items-center gap-1.5 uppercase">
                  <Zap className="w-4 h-4" /> {UI_TEXT.analytics.attribution.assists}
                </span>
                <span className="text-xs font-mono font-black text-emerald-400">
                  +{backtest.attribution.assists.points} pts
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                {UI_TEXT.analytics.attribution.assistsDesc}
              </p>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${backtest.attribution.assists.percentage}%` }}></div>
              </div>
            </div>

            {/* BPS Magnetism */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase">
                  <Flame className="w-4 h-4" /> {UI_TEXT.analytics.attribution.bonus}
                </span>
                <span className="text-xs font-mono font-black text-emerald-400">
                  +{backtest.attribution.bonus.points} pts
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                {UI_TEXT.analytics.attribution.bonusDesc}
              </p>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${backtest.attribution.bonus.percentage}%` }}></div>
              </div>
            </div>

            {/* Price Radar Team Value */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5 uppercase">
                  <DollarSign className="w-4 h-4" /> {UI_TEXT.analytics.attribution.teamValue}
                </span>
                <span className="text-xs font-mono font-black text-emerald-400">
                  +£{backtest.attribution.teamValueGain.million}m Bank
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                {UI_TEXT.analytics.attribution.teamValueDesc}
              </p>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `75%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Transfer Decision Matrix */}
      {(activeTab === 'all' || activeTab === 'transfers') && (
        <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                {UI_TEXT.analytics.sections.transfersTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {UI_TEXT.analytics.sections.transfersSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-mono text-xs text-emerald-300 font-black">
              Total Transfer Swing: {backtest.totalTransferSwing >= 0 ? `+${backtest.totalTransferSwing}` : backtest.totalTransferSwing} pts
            </div>
          </div>

          {backtest.transferSwings.length > 0 ? (
            <div className="space-y-3 pt-2">
              {backtest.transferSwings.map((t, idx) => (
                <div key={idx} className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-400 font-mono uppercase bg-slate-950 px-2.5 py-1 rounded-lg border border-white/5">
                      GW {t.gw}
                    </span>
                    <div className="text-xs font-medium text-slate-300">
                      You: <strong className="text-white">{t.userTransfer?.playerOut.web_name}</strong> ➔ <strong className="text-emerald-400">{t.userTransfer?.playerIn.web_name}</strong> ({t.userTransfer?.netPoints} pts)
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                    <div className="text-xs font-medium text-slate-300">
                      AI #1: <strong className="text-white">{t.aiTransfer?.playerOut.web_name}</strong> ➔ <strong className="text-cyan-400">{t.aiTransfer?.playerIn.web_name}</strong> ({t.aiTransfer?.netPoints} pts)
                    </div>
                    <span className={`text-xs font-black font-mono px-2.5 py-1 rounded-xl ${
                      t.swing > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {t.swing > 0 ? `+${t.swing} pts AI Edge` : 'Neutral'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-slate-400 text-xs sm:text-sm font-medium">
              No historical transfers recorded yet. Transfer swing decisions will appear here as gameweeks complete!
            </div>
          )}
        </div>
      )}
    </div>
  );
};
