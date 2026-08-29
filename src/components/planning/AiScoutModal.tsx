'use client';

import React from 'react';
import { KitIcon } from '@/components/ui/KitIcon';
import { FdrFixtureCell } from '@/components/ui/FdrBadge';
import { usePlannerStore } from '@/store/usePlannerStore';
import { 
  Sparkles, 
  X, 
  ArrowRight, 
  ArrowRightLeft, 
  Check, 
  ShoppingBag, 
  TrendingUp, 
  CheckCircle2
} from 'lucide-react';

export const AiScoutModal: React.FC = () => {
  const { 
    isScoutModalOpen,
    closeScoutModal,
    scoutPlayerOut,
    scoutPlayerIn,
    scoutGain,
    teamMap, 
    selectedGameweek, 
    getPlayerUpcomingFixtures, 
    getPlayerGameweekXp,
    executeTransfer,
    openTransferDrawer
  } = usePlannerStore();

  if (!isScoutModalOpen || !scoutPlayerOut || !scoutPlayerIn) return null;

  const teamOut = teamMap.get(scoutPlayerOut.team);
  const teamIn = teamMap.get(scoutPlayerIn.team);

  const outXp = getPlayerGameweekXp(scoutPlayerOut.id, selectedGameweek);
  const inXp = getPlayerGameweekXp(scoutPlayerIn.id, selectedGameweek);

  const outFixtures = getPlayerUpcomingFixtures(scoutPlayerOut.id, 3);
  const inFixtures = getPlayerUpcomingFixtures(scoutPlayerIn.id, 3);

  const priceDiff = (scoutPlayerOut.now_cost - scoutPlayerIn.now_cost) / 10;

  const handleApplyTransfer = () => {
    usePlannerStore.setState({ selectedPlayerForTransfer: scoutPlayerOut.id });
    const success = executeTransfer(scoutPlayerIn);
    if (success) {
      closeScoutModal();
    }
  };

  const handleOpenMarket = () => {
    const outId = scoutPlayerOut.id;
    closeScoutModal();
    openTransferDrawer(outId);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={closeScoutModal}
    >
      <div 
        className="relative w-full max-w-lg md:max-w-xl my-auto bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/50 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-emerald-950/80 overflow-hidden select-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Background Glows */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                AI Transfer Recommendation
              </h2>
              <p className="text-xs text-slate-400">Optimal single transfer for Gameweek {selectedGameweek}</p>
            </div>
          </div>
          <button
            onClick={closeScoutModal}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Projected XP Gain Hero Banner */}
        <div className="my-3.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border border-emerald-500/40 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-200">Projected Net Points Gain:</span>
          </div>
          <span className="text-base sm:text-lg font-black text-emerald-300 font-mono bg-emerald-900/60 px-2.5 py-0.5 rounded-xl border border-emerald-500/30">
            +{scoutGain.toFixed(1)} xP
          </span>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-2 my-3 relative z-10">
          {/* 1. Outgoing Player (SELL) */}
          <div className="bg-gradient-to-b from-rose-950/50 to-slate-950/90 border border-rose-500/40 rounded-2xl p-4 flex flex-col items-center text-center relative shadow-lg">
            <span className="absolute top-2.5 left-2.5 text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
              SELL
            </span>
            <div className="w-16 h-16 sm:w-20 sm:h-20 my-2 flex items-center justify-center">
              <KitIcon 
                teamCode={scoutPlayerOut.team_code} 
                teamShortName={teamOut?.short_name} 
                isGoalkeeper={scoutPlayerOut.element_type === 1}
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md" 
              />
            </div>
            <span className="text-sm sm:text-base font-black text-white truncate max-w-full">
              {scoutPlayerOut.web_name}
            </span>
            <span className="text-xs text-rose-300/90 font-bold mt-0.5">
              {teamOut?.name || 'TBD'}
            </span>
            <div className="mt-2 flex items-center justify-center gap-2 w-full pt-2 border-t border-white/10">
              <span className="text-xs font-mono font-bold text-slate-300">
                £{(scoutPlayerOut.now_cost / 10).toFixed(1)}m
              </span>
              <span className="text-xs font-mono font-black text-slate-400">
                {outXp.toFixed(1)} xP
              </span>
            </div>

            {/* Upcoming Fixtures */}
            <div className="w-full mt-2.5 flex rounded-lg overflow-hidden border border-white/10">
              {outFixtures.map(f => (
                <FdrFixtureCell key={f.event} fixture={f} totalCount={outFixtures.length} />
              ))}
            </div>
          </div>

          {/* Transfer Arrow Middle Element */}
          <div className="flex flex-col items-center justify-center p-2">
            <div className="p-3 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-lg animate-pulse">
              <ArrowRightLeft className="w-5 h-5 hidden sm:block" />
              <ArrowRight className="w-5 h-5 sm:hidden rotate-90" />
            </div>
            <span className="text-[10px] font-mono font-bold mt-1 text-slate-400">
              {priceDiff > 0 ? `+£${priceDiff.toFixed(1)}m` : priceDiff < 0 ? `-£${Math.abs(priceDiff).toFixed(1)}m` : '£0.0m'}
            </span>
          </div>

          {/* 2. Incoming Player (BUY) */}
          <div className="bg-gradient-to-b from-emerald-950/50 to-slate-950/90 border border-emerald-500/50 rounded-2xl p-4 flex flex-col items-center text-center relative shadow-lg">
            <span className="absolute top-2.5 left-2.5 text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              BUY
            </span>
            <div className="w-16 h-16 sm:w-20 sm:h-20 my-2 flex items-center justify-center">
              <KitIcon 
                teamCode={scoutPlayerIn.team_code} 
                teamShortName={teamIn?.short_name} 
                isGoalkeeper={scoutPlayerIn.element_type === 1}
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md" 
              />
            </div>
            <span className="text-sm sm:text-base font-black text-white truncate max-w-full">
              {scoutPlayerIn.web_name}
            </span>
            <span className="text-xs text-emerald-300/90 font-bold mt-0.5">
              {teamIn?.name || 'TBD'}
            </span>
            <div className="mt-2 flex items-center justify-center gap-2 w-full pt-2 border-t border-white/10">
              <span className="text-xs font-mono font-bold text-emerald-400">
                £{(scoutPlayerIn.now_cost / 10).toFixed(1)}m
              </span>
              <span className="text-xs font-mono font-black text-emerald-300">
                {inXp.toFixed(1)} xP
              </span>
            </div>

            {/* Upcoming Fixtures */}
            <div className="w-full mt-2.5 flex rounded-lg overflow-hidden border border-white/10">
              {inFixtures.map(f => (
                <FdrFixtureCell key={f.event} fixture={f} totalCount={inFixtures.length} />
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4 relative z-10">
          <button
            onClick={handleApplyTransfer}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            Apply Transfer to GW {selectedGameweek}
          </button>

          <button
            onClick={handleOpenMarket}
            className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            View in Market
          </button>
        </div>
      </div>
    </div>
  );
};