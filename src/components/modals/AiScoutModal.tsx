'use client';

import React, { useState, useMemo } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { 
  getSmartTransferRecommendations, 
  getDreamTargets, 
  getChipRadarRecommendations,
  analyzeTransferHit,
  TransferRecommendation,
  DreamTargetPick,
  DoubleTransferHitCombo
} from '@/utils/aiTransferScout';
import { 
  X, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  Award, 
  Target, 
  Flame, 
  ShieldAlert 
} from 'lucide-react';
import { formatMoney } from '@/lib/fpl-rules';

export const AiScoutModal: React.FC = () => {
  const {
    isScoutModalOpen,
    closeScoutModal,
    selectedGameweek,
    gameweekPlans,
    players,
    playerMap,
    teamMap,
    getPlayerGameweekXp,
    getPlayerUpcomingFixtures,
    isGameweekLocked,
    executeDirectTransfer
  } = usePlannerStore();

  const [activeTab, setActiveTab] = useState<'transfers' | 'targets' | 'hits' | 'chips'>('transfers');
  const [horizon, setHorizon] = useState<'1gw' | '3gw' | '5gw'>('3gw');
  const [targetPosition, setTargetPosition] = useState<number | 'value'>(3); // Default MID
  const [appliedTransferMsg, setAppliedTransferMsg] = useState<string | null>(null);

  const isLocked = isGameweekLocked(selectedGameweek);
  const currentPlan = gameweekPlans[selectedGameweek];
  const squad = useMemo(() => currentPlan?.squad || [], [currentPlan?.squad]);
  const bankInMillions = (currentPlan?.calculatedBank || 0) / 10.0;
  const availableFT = currentPlan?.availableTransfers || 1;
  const transfersInIds = useMemo(() => currentPlan?.transfersIn || [], [currentPlan?.transfersIn]);
  const transfersOutIds = useMemo(() => currentPlan?.transfersOut || [], [currentPlan?.transfersOut]);

  // 1. Smart Transfer Recommendations for current squad
  const recommendations = useMemo(() => {
    if (!isScoutModalOpen) return [];
    return getSmartTransferRecommendations(
      squad,
      players,
      playerMap,
      bankInMillions,
      selectedGameweek,
      getPlayerGameweekXp
    );
  }, [isScoutModalOpen, squad, players, playerMap, bankInMillions, selectedGameweek, getPlayerGameweekXp]);

  // 2. Unconstrained Dream Targets & Value Picks
  const dreamTargets = useMemo(() => {
    if (!isScoutModalOpen) return { topByPosition: {}, topValuePicks: [] };
    return getDreamTargets(
      players,
      teamMap,
      selectedGameweek,
      getPlayerGameweekXp,
      (pId) => getPlayerUpcomingFixtures(pId, 5)
    );
  }, [isScoutModalOpen, players, teamMap, selectedGameweek, getPlayerGameweekXp, getPlayerUpcomingFixtures]);

  // 3. "Should I Take A Hit?" Analysis
  const hitAnalysis = useMemo(() => {
    if (!isScoutModalOpen) return null;
    return analyzeTransferHit(
      transfersInIds,
      transfersOutIds,
      availableFT,
      selectedGameweek,
      playerMap,
      getPlayerGameweekXp,
      squad,
      players,
      bankInMillions
    );
  }, [isScoutModalOpen, transfersInIds, transfersOutIds, availableFT, selectedGameweek, playerMap, getPlayerGameweekXp, squad, players, bankInMillions]);

  // 4. Chip Strategy Radar
  const chipRadar = useMemo(() => {
    if (!isScoutModalOpen) return [];
    return getChipRadarRecommendations(squad, players, selectedGameweek, getPlayerGameweekXp);
  }, [isScoutModalOpen, squad, players, selectedGameweek, getPlayerGameweekXp]);

  if (!isScoutModalOpen) return null;

  const handleApplyTransfer = (rec: TransferRecommendation) => {
    if (isLocked) return;
    executeDirectTransfer(rec.playerOut.id, rec.playerIn.id);
    setAppliedTransferMsg(`Applied: ${rec.playerIn.web_name} in for ${rec.playerOut.web_name}!`);
    setTimeout(() => setAppliedTransferMsg(null), 3500);
  };

  const handleApplyDoubleTransfer = (combo: DoubleTransferHitCombo) => {
    if (isLocked) return;
    executeDirectTransfer(combo.out1.id, combo.in1.id);
    setTimeout(() => {
      executeDirectTransfer(combo.out2.id, combo.in2.id);
      setAppliedTransferMsg(`Applied Double Move (-4 hit): +${combo.netProfitAfterHit} net pts profit!`);
      setTimeout(() => setAppliedTransferMsg(null), 3500);
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl sm:max-w-7xl max-h-[92vh] bg-slate-900 border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-950/50">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">AI Transfer Scout &amp; Market Intelligence</h2>
                <span className="bg-emerald-900/80 text-emerald-300 text-[10px] sm:text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                  OpenFPL ML
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Machine learning forecasts for Gameweek {selectedGameweek} · Bank: <strong className="text-emerald-400">{formatMoney(currentPlan?.calculatedBank || 0, true)}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={closeScoutModal}
            className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Applied Transfer Notification Banner */}
        {appliedTransferMsg && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top duration-200">
            <CheckCircle2 className="w-4 h-4" />
            {appliedTransferMsg}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 px-4 sm:px-6 py-3 border-b border-white/10 bg-slate-950/70 select-none overflow-hidden flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setActiveTab('transfers')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black flex items-center gap-2 rounded-lg transition-all border ${
              activeTab === 'transfers'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                : 'bg-slate-900/90 text-slate-400 hover:text-white border-white/10 hover:border-white/20'
            }`}
          >
            <Target className="w-4 h-4" />
            Smart Transfers ({recommendations.length})
          </button>

          <button
            onClick={() => setActiveTab('targets')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black flex items-center gap-2 rounded-lg transition-all border ${
              activeTab === 'targets'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                : 'bg-slate-900/90 text-slate-400 hover:text-white border-white/10 hover:border-white/20'
            }`}
          >
            <Award className="w-4 h-4" />
            Dream Targets
          </button>

          <button
            onClick={() => setActiveTab('hits')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black flex items-center gap-2 rounded-lg transition-all border ${
              activeTab === 'hits'
                ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                : 'bg-slate-900/90 text-slate-400 hover:text-white border-white/10 hover:border-white/20'
            }`}
          >
            <Flame className="w-4 h-4" />
            Hit Calculator (-4 pts)
          </button>

          <button
            onClick={() => setActiveTab('chips')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black flex items-center gap-2 rounded-lg transition-all border ${
              activeTab === 'chips'
                ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                : 'bg-slate-900/90 text-slate-400 hover:text-white border-white/10 hover:border-white/20'
            }`}
          >
            <Zap className="w-4 h-4" />
            AI Chip Radar
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: SMART SQUAD TRANSFERS */}
          {activeTab === 'transfers' && (
            <div className="space-y-4">
              {/* Horizon Filter Controls */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2">
                <span className="text-xs text-slate-400 font-medium">
                  Evaluating all affordable, legal moves for your exact 15-man squad:
                </span>

                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-white/10 text-xs font-black gap-1">
                  <button
                    onClick={() => setHorizon('1gw')}
                    className={`px-3.5 py-1.5 rounded-md transition-all font-black ${
                      horizon === '1gw' 
                        ? 'bg-emerald-500 text-slate-950 shadow font-black' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1-GW Sprint
                  </button>
                  <button
                    onClick={() => setHorizon('3gw')}
                    className={`px-3.5 py-1.5 rounded-md transition-all font-black ${
                      horizon === '3gw' 
                        ? 'bg-emerald-500 text-slate-950 shadow font-black' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    3-GW Swing
                  </button>
                  <button
                    onClick={() => setHorizon('5gw')}
                    className={`px-3.5 py-1.5 rounded-md transition-all font-black ${
                      horizon === '5gw' 
                        ? 'bg-emerald-500 text-slate-950 shadow font-black' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    5-GW Hold
                  </button>
                </div>
              </div>

              {/* Recommendation Cards List */}
              {recommendations.length === 0 ? (
                <div className="text-center py-12 bg-slate-950/50 rounded-3xl border border-white/5 p-6">
                  <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-2 opacity-80" />
                  <h3 className="text-sm sm:text-base font-black text-white">No profitable transfers found</h3>
                  <p className="text-xs text-slate-400 mt-1">Your current squad is already highly optimal for this gameweek within your bank budget!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {recommendations.slice(0, 15).map((rec, idx) => {
                    const gain = horizon === '1gw' ? rec.xpGainImmediate : horizon === '3gw' ? rec.xpGain3Gw : rec.xpGain5Gw;
                    const outTeam = teamMap.get(rec.playerOut.team);
                    const inTeam = teamMap.get(rec.playerIn.team);

                    return (
                      <div
                        key={`${rec.playerOut.id}_${rec.playerIn.id}_${idx}`}
                        className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-emerald-500/50 transition-all flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md group"
                      >
                        {/* Transfer Player Comparison Pair */}
                        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                          {/* Player OUT */}
                          <div className="flex flex-col text-left">
                            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Sell</span>
                            <span className="text-xs sm:text-sm font-black text-slate-300">
                              {rec.playerOut.web_name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {outTeam?.short_name} · £{(rec.playerOut.now_cost / 10).toFixed(1)}m
                            </span>
                          </div>

                          <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0" />

                          {/* Player IN */}
                          <div className="flex flex-col text-left">
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Buy</span>
                            <span className="text-xs sm:text-sm font-black text-white">
                              {rec.playerIn.web_name}
                            </span>
                            <span className="text-[11px] text-emerald-400/90 font-mono font-bold">
                              {inTeam?.short_name} · £{(rec.playerIn.now_cost / 10).toFixed(1)}m
                            </span>
                          </div>
                        </div>

                        {/* Financial & Point Gains Metric Badges */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                          {/* Financial Impact */}
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-medium">Bank Balance</span>
                            <span className="text-xs font-mono font-bold text-slate-200">
                              £{rec.netBankAfter.toFixed(1)}m
                            </span>
                          </div>

                          {/* Projected Point Gain */}
                          <div className="text-right bg-emerald-950/80 border border-emerald-500/40 px-3 py-1.5 rounded-xl">
                            <span className="text-[10px] text-emerald-300 block font-bold uppercase tracking-wider">
                              {horizon.toUpperCase()} Gain
                            </span>
                            <span className="text-sm font-black text-emerald-400 font-mono">
                              +{gain > 0 ? gain.toFixed(1) : '0.0'} xP
                            </span>
                          </div>

                          {/* 1-Click Apply Button */}
                          {!isLocked && (
                            <button
                              onClick={() => handleApplyTransfer(rec)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all hover:scale-102 active:scale-95 shadow-md flex items-center gap-1.5 shrink-0"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              Apply
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PREMIER LEAGUE DREAM TARGETS */}
          {activeTab === 'targets' && (
            <div className="space-y-4">
              {/* Position / Value Filter Tabs */}
              <div className="flex items-center gap-2 flex-wrap pb-1">
                {[
                  { id: 3, label: 'Midfielders' },
                  { id: 4, label: 'Forwards' },
                  { id: 2, label: 'Defenders' },
                  { id: 1, label: 'Goalkeepers' },
                  { id: 'value', label: '💰 Value ROI Picks (xP/£)' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setTargetPosition(tab.id as any)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all border ${
                      targetPosition === tab.id
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                        : 'bg-slate-900/90 text-slate-400 hover:text-white border-white/10 hover:border-white/20'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Targets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {((targetPosition === 'value' ? dreamTargets.topValuePicks : dreamTargets.topByPosition[targetPosition as number]) || []).map((target, idx) => (
                  <div
                    key={target.player.id}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-black text-slate-500 w-5">
                        #{idx + 1}
                      </span>
                      <div className="flex flex-col text-left">
                        <span className="text-xs sm:text-sm font-black text-white">
                          {target.player.web_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {target.team?.short_name} · £{(target.player.now_cost / 10).toFixed(1)}m
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      {/* Upcoming 3 FDR dots */}
                      <div className="flex items-center gap-1">
                        {target.upcomingDifficulties.slice(0, 3).map((fdr, fIdx) => (
                          <span
                            key={fIdx}
                            className={`w-3 h-3 rounded-full text-[9px] font-black flex items-center justify-center ${
                              fdr === 1 ? 'bg-emerald-500 text-black' :
                              fdr === 2 ? 'bg-emerald-600 text-white' :
                              fdr === 3 ? 'bg-slate-600 text-white' :
                              fdr === 4 ? 'bg-rose-500 text-white' : 'bg-rose-900 text-white'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="bg-slate-900 px-2.5 py-1 rounded-xl border border-white/10">
                        <span className="text-[9px] text-slate-400 block font-bold">3-GW xP</span>
                        <span className="text-xs sm:text-sm font-black text-amber-400 font-mono">
                          {target.xp3Gw} pts
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: "SHOULD I TAKE A HIT?" CALCULATOR */}
          {activeTab === 'hits' && hitAnalysis && (
            <div className="space-y-5">
              {/* Verdict Header Banner */}
              <div className={`p-4 sm:p-5 rounded-3xl border shadow-xl flex flex-col gap-2.5 ${
                hitAnalysis.verdict === 'STRONG_YES'
                  ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 border-emerald-500/50'
                  : hitAnalysis.verdict === 'MARGINAL'
                  ? 'bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 border-amber-500/50'
                  : hitAnalysis.verdict === 'AVOID_HIT'
                  ? 'bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 border-rose-500/50'
                  : 'bg-slate-950 border-white/10'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
                    {hitAnalysis.verdictHeadline}
                  </span>

                  {hitAnalysis.hasPlannedHit && (
                    <span className="text-xs bg-rose-900/80 text-rose-200 border border-rose-500/40 px-3 py-1 rounded-full font-mono font-bold">
                      -{hitAnalysis.hitPenaltyPoints} pts Hit
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {hitAnalysis.verdictExplanation}
                </p>

                {hitAnalysis.hasPlannedHit && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
                    <div className="p-2 bg-slate-900/80 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-bold">Immediate Net</span>
                      <span className={`text-xs sm:text-sm font-black font-mono ${hitAnalysis.netImmediateGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {hitAnalysis.netImmediateGain >= 0 ? `+${hitAnalysis.netImmediateGain}` : hitAnalysis.netImmediateGain} pts
                      </span>
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-bold">2-GW Net Profit</span>
                      <span className={`text-xs sm:text-sm font-black font-mono ${hitAnalysis.netTwoGwGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {hitAnalysis.netTwoGwGain >= 0 ? `+${hitAnalysis.netTwoGwGain}` : hitAnalysis.netTwoGwGain} pts
                      </span>
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-bold">3-GW Net Profit</span>
                      <span className={`text-xs sm:text-sm font-black font-mono ${hitAnalysis.netThreeGwGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {hitAnalysis.netThreeGwGain >= 0 ? `+${hitAnalysis.netThreeGwGain}` : hitAnalysis.netThreeGwGain} pts
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Double Transfer Hit Opportunities */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    High-Profit Double Transfer Combos (Even with -4 Hit)
                  </span>
                </div>

                {hitAnalysis.bestDoubleTransferCombos.length === 0 ? (
                  <div className="text-center py-6 bg-slate-950/40 rounded-2xl border border-white/5 p-4">
                    <p className="text-xs text-slate-400">
                      No 2-player swap combos generate enough point divergence to justify a -4 penalty. Rolling your transfer is mathematically optimal!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {hitAnalysis.bestDoubleTransferCombos.map((combo, cIdx) => (
                      <div
                        key={cIdx}
                        className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-emerald-500/50 transition-all flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md"
                      >
                        {/* 2-Player Out -> 2-Player In */}
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-rose-400 font-bold uppercase text-[10px]">Sell:</span>
                            <span className="text-slate-300 font-black">{combo.out1.web_name}</span>
                            <span className="text-slate-500">+</span>
                            <span className="text-slate-300 font-black">{combo.out2.web_name}</span>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-emerald-400 font-bold uppercase text-[10px]">Buy:</span>
                            <span className="text-white font-black">{combo.in1.web_name}</span>
                            <span className="text-slate-500">+</span>
                            <span className="text-white font-black">{combo.in2.web_name}</span>
                          </div>
                        </div>

                        {/* Net Gains & 1-Click Apply */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-medium">Gross 2-GW Gain</span>
                            <span className="text-xs font-mono font-bold text-slate-200">
                              +{combo.twoGwPointDelta} pts
                            </span>
                          </div>

                          <div className="text-right bg-emerald-950/80 border border-emerald-500/40 px-3 py-1.5 rounded-xl">
                            <span className="text-[10px] text-emerald-300 block font-bold uppercase tracking-wider">
                              Net Profit After -4 Hit
                            </span>
                            <span className="text-sm font-black text-emerald-400 font-mono">
                              +{combo.netProfitAfterHit} pts
                            </span>
                          </div>

                          {!isLocked && (
                            <button
                              onClick={() => handleApplyDoubleTransfer(combo)}
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition-all hover:scale-102 active:scale-95 shadow-md flex items-center gap-1.5 shrink-0"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              Apply Both
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AI CHIP RADAR */}
          {activeTab === 'chips' && (
            <div className="space-y-4">
              <span className="text-xs text-slate-400 font-medium block">
                OpenFPL model forecast radar detecting optimal Gameweeks for chip deployment:
              </span>

              <div className="grid grid-cols-1 gap-3">
                {chipRadar.map(item => (
                  <div
                    key={item.chipKey}
                    className="p-4 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-purple-500/30 shadow-xl flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        <Zap className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-black text-purple-300 uppercase tracking-wider">
                          {item.chipName}
                        </span>
                        <h4 className="text-sm sm:text-base font-black text-white">
                          {item.headline}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.subtext}
                        </p>
                      </div>
                    </div>

                    <div className="bg-purple-950/80 border border-purple-500/40 px-3.5 py-2 rounded-2xl text-right shrink-0">
                      <span className="text-[10px] text-purple-300 block font-bold uppercase">Estimated Yield</span>
                      <span className="text-sm sm:text-base font-black text-purple-200 font-mono">
                        {item.projectedYield}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <span>AI predictions updated automatically before every deadline</span>
          <button
            onClick={closeScoutModal}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
