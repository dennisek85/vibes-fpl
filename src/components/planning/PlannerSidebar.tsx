import React, { useState } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { FPLPlayer, ChipType } from '@/types/fpl';
import { formatMoney } from '@/lib/fpl-rules';
import { AiScoutModal } from './AiScoutModal';
import { 
  Sparkles, 
  Zap, 
  Shield, 
  Flame, 
  Eye, 
  ArrowRightLeft, 
  PoundSterling, 
  Edit3, 
  RotateCcw,
  Layers,
  Lock,
  Trophy,
  Trash2,
  AlertCircle,
  Wand2,
  Lightbulb,
  CheckCircle2,
  EyeOff
} from 'lucide-react';

const CHIPS: Array<{ id: ChipType; label: string; icon: any; color: string; desc: string }> = [
  { id: 'wildcard', label: 'Wildcard', icon: Sparkles, color: 'text-purple-300 border-purple-500/30 hover:bg-purple-950/40', desc: 'Unlimited FTs' },
  { id: 'freehit', label: 'Free Hit', icon: Zap, color: 'text-amber-300 border-amber-500/30 hover:bg-amber-950/40', desc: '1 week squad overhaul' },
  { id: 'bboost', label: 'Bench Boost', icon: Shield, color: 'text-blue-300 border-blue-500/30 hover:bg-blue-950/40', desc: 'Bench points count' },
  { id: '3xc', label: 'Triple Captain', icon: Flame, color: 'text-rose-300 border-rose-500/30 hover:bg-rose-950/40', desc: 'Captain 3x points' },
];

interface PlannerSidebarProps {
  onOpenOverrides: () => void;
}

export const PlannerSidebar: React.FC<PlannerSidebarProps> = ({ onOpenOverrides }) => {
  const { 
    selectedGameweek, 
    gameweekPlans, 
    playedChips,
    setChip,
    fixtureHorizon,
    setFixtureHorizon,
    resetCurrentGameweek,
    resetAllFutureGameweeks,
    getPlayerGameweekXp,
    teamHistoryCurrent,
    isGameweekLocked,
    showAiPredictions,
    toggleAiPredictions,
    autoOptimizeStartingXI,
    players,
    playerMap,
    teamMap,
    openTransferDrawer,
    openScoutModal
  } = usePlannerStore();

  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [optimizedToast, setOptimizedToast] = useState(false);

  const isLocked = isGameweekLocked(selectedGameweek);
  const activePlan = gameweekPlans[selectedGameweek];
  const activeChip = activePlan?.chip || 'none';
  const transfersCount = activePlan?.transfersIn?.length || 0;
  const availableFT = activePlan?.availableTransfers || 1;
  const hits = activePlan?.transferCost || 0;
  const bank = activePlan?.calculatedBank || 0;
  const isBankOverridden = activePlan?.bankOverride !== null && activePlan?.bankOverride !== undefined;
  const isFTOverridden = activePlan?.freeTransfersOverride !== null && activePlan?.freeTransfersOverride !== undefined;

  const gwHistory = teamHistoryCurrent?.find(h => h.event === selectedGameweek);

  // Calculate Total Squad Projected Points (xP)
  let totalProjectedXp = 0;
  if (activePlan?.squad) {
    const isBenchBoost = activeChip === 'bboost';
    const isTripleCaptain = activeChip === '3xc';

    activePlan.squad.forEach(pick => {
      const isStarting = pick.position <= 11;
      if (isStarting || isBenchBoost) {
        const xp = getPlayerGameweekXp(pick.element, selectedGameweek);
        let mult = 1;
        if (pick.is_captain) {
          mult = isTripleCaptain ? 3 : 2;
        }
        totalProjectedXp += xp * mult;
      }
    });
  }
  totalProjectedXp = Math.round((totalProjectedXp - hits) * 10) / 10;

  const getChipPlannedGw = (chipId: ChipType): number | null => {
    for (const [gwStr, plan] of Object.entries(gameweekPlans)) {
      const gw = parseInt(gwStr, 10);
      if (plan.chip === chipId) return gw;
    }
    return null;
  };

  const handleResetCurrent = () => {
    if (confirm(`Reset Gameweek ${selectedGameweek} transfers and strategy to default?`)) {
      resetCurrentGameweek();
    }
  };

  const handleResetAll = () => {
    resetAllFutureGameweeks();
    setShowResetAllConfirm(false);
  };

  const handleAutoOptimize = () => {
    autoOptimizeStartingXI();
    setOptimizedToast(true);
    setTimeout(() => setOptimizedToast(false), 2500);
  };

  const handleFindTransfer = () => {
    if (!activePlan?.squad || !players.length) return;
    let bestGain = 0;
    let bestOut: FPLPlayer | null = null;
    let bestIn: FPLPlayer | null = null;

    activePlan.squad.forEach(pick => {
      const pOut = playerMap.get(pick.element);
      if (!pOut) return;
      const outXp = getPlayerGameweekXp(pOut.id, selectedGameweek);
      const maxBudget = bank + pick.selling_price;

      // Find players in same position within budget
      const candidates = players.filter(p => 
        p.element_type === pOut.element_type && 
        p.now_cost <= maxBudget && 
        !activePlan.squad.some(s => s.element === p.id)
      );

      candidates.forEach(cand => {
        const candXp = getPlayerGameweekXp(cand.id, selectedGameweek);
        const gain = candXp - outXp;
        if (gain > bestGain) {
          bestGain = gain;
          bestOut = pOut;
          bestIn = cand;
        }
      });
    });

    if (bestOut && bestIn) {
      openScoutModal(bestOut, bestIn, Math.max(0, Math.round(bestGain * 10) / 10));
    } else {
      alert('Your squad already holds the highest projected players for your budget this week!');
    }
  };

  return (
    <div className="w-full flex flex-col gap-3.5 sm:gap-4.5">
      {/* 1. Official Completed Score Card (When viewing locked gameweek) */}
      {isLocked && (
        <div className="bg-gradient-to-br from-amber-950/90 via-slate-900 to-slate-950 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-amber-500/40 shadow-xl">
          <div className="flex items-center justify-between pb-2.5 border-b border-amber-500/20 mb-3">
            <span className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              GW {selectedGameweek} Result
            </span>
            <span className="text-[11px] bg-amber-400 text-slate-950 font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> Locked
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Final Gameweek Score</span>
              <span className="text-3xl font-black text-white font-mono leading-tight">
                {gwHistory?.points || 0} <span className="text-base font-sans text-amber-400 font-bold">pts</span>
              </span>
            </div>
            {gwHistory?.rank && (
              <div className="text-right">
                <span className="text-xs text-slate-400 block font-medium">Gameweek Rank</span>
                <span className="text-sm font-black text-slate-200 font-mono">
                  #{gwHistory.rank.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Secret AI Assistant Lab Card (Only shown if Easter Egg unlocked) */}
      {showAiPredictions && !isLocked && (
        <div className="bg-gradient-to-br from-purple-950/80 via-slate-900 to-emerald-950/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-emerald-500/50 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2.5 border-b border-emerald-500/20 mb-3">
            <span className="text-xs sm:text-sm font-black text-emerald-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              AI Intelligence Lab
            </span>
            <button
              onClick={toggleAiPredictions}
              className="text-[10px] bg-slate-950 hover:bg-rose-950 text-slate-400 hover:text-rose-300 px-2 py-0.5 rounded-lg border border-white/10 transition-colors flex items-center gap-1"
              title="Hide AI predictions and lab"
            >
              <EyeOff className="w-3 h-3" /> Hide
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Auto-Pick Optimal XI Button */}
            <button
              onClick={handleAutoOptimize}
              className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-95"
            >
              <Wand2 className="w-4 h-4" />
              Auto-Optimize Starting XI &amp; (C)
            </button>

            {/* AI Transfer Scout Button */}
            <button
              onClick={handleFindTransfer}
              className="w-full py-2 px-3 rounded-2xl bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all hover:scale-101 active:scale-98"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              Scout Best Transfer (+xP)
            </button>

            {optimizedToast && (
              <div className="text-center text-xs font-black text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 p-2 rounded-xl flex items-center justify-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Optimal XI &amp; Captain Applied!
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Fixture Horizon Filter Card (Only for unlocked future gameweeks) */}
      {!isLocked && (
        <div className="bg-slate-900/90 backdrop-blur-md p-3 sm:p-3.5 rounded-3xl border border-white/15 shadow-xl flex items-center justify-between gap-2">
          <span className="text-xs sm:text-[13px] font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <Eye className="w-4 h-4 text-emerald-400" />
            {([1, 3, 5] as const).map(count => (
              <button
                key={count}
                className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all ${
                  fixtureHorizon === count
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {count}GW
            ))}
          </div>
        </div>
      )}

      {/* 4. Budget & Strategy Card */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-white/15 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs sm:text-sm font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            GW {selectedGameweek} {isLocked ? 'Record' : 'Strategy'}
          </span>
          {!isLocked && (
            <button
              onClick={handleResetCurrent}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-300 bg-slate-950/80 hover:bg-rose-950/60 px-2.5 py-1 rounded-xl border border-white/10 hover:border-rose-500/30 transition-colors"
              title={`Reset GW ${selectedGameweek} to default`}
            >
              <RotateCcw className="w-3 h-3" />
              Reset GW {selectedGameweek}
            </button>
          )}
        </div>

        <div className="space-y-3">
          {/* AI Expected Points Hero Box (Only if AI Unlocked) */}
          {showAiPredictions && !isLocked && (
            <div className="bg-gradient-to-r from-emerald-950/90 via-teal-950/80 to-slate-950 p-3.5 sm:p-4 rounded-2xl border border-emerald-500/40 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                    <Sparkles className="w-5 h-5 text-emerald-300 animate-pulse" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider">AI Expected Points</span>
                    <span className="text-xl sm:text-2xl font-black text-white font-mono leading-tight">
                      {totalProjectedXp > 0 ? totalProjectedXp.toFixed(1) : '--'} <span className="text-xs font-sans text-emerald-300 font-bold">xP</span>
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-400 bg-emerald-900/60 px-2.5 py-1 rounded-xl border border-emerald-500/30 font-black">
                  GW {selectedGameweek}
                </div>
              </div>
            </div>
          )}

          {/* 2 Square Tiles: Free Transfers & Bank Balance */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Free Transfers Tile */}
            <div 
              onClick={isLocked ? undefined : onOpenOverrides}
              className={`bg-slate-950 p-3.5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[96px] transition-all ${
                isLocked ? 'cursor-default' : 'cursor-pointer hover:border-emerald-400 hover:bg-slate-900 group shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400">
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                {!isLocked && <Edit3 className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />}
              </div>
              <div className="mt-2">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">Free Transfers</span>
                <span className="text-lg sm:text-xl font-black text-white leading-tight">
                  {transfersCount} / {availableFT}
                </span>
                {isFTOverridden && <span className="text-[9px] text-amber-400 font-normal block">(override)</span>}
              </div>
            </div>

            {/* Projected Bank Tile */}
            <div 
              onClick={isLocked ? undefined : onOpenOverrides}
              className={`bg-slate-950 p-3.5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[96px] transition-all ${
                isLocked ? 'cursor-default' : 'cursor-pointer hover:border-emerald-400 hover:bg-slate-900 group shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400">
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <PoundSterling className="w-4 h-4" />
                </div>
                {!isLocked && <Edit3 className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />}
              </div>
              <div className="mt-2">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">{isLocked ? 'Bank' : 'Bank Balance'}</span>
                <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono leading-tight">
                  {formatMoney(bank, true)}
                </span>
                {isBankOverridden && <span className="text-[9px] text-amber-400 font-normal block">(override)</span>}
              </div>
            </div>
          </div>

          {/* Point Hits if any */}
          {hits > 0 && (
            <div className="flex items-center justify-between bg-rose-950/80 border border-rose-500/40 text-rose-300 p-2.5 rounded-2xl text-xs font-black">
              <span>Transfer Penalty</span>
              <span>-{hits} pts</span>
            </div>
          )}

          {/* Action Buttons: Edit Budget & Reset All Future Gameweeks */}
          {!isLocked && (
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={onOpenOverrides}
                className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all hover:scale-101 active:scale-99 shadow-md"
              >
                <Edit3 className="w-4 h-4 text-emerald-400" />
                Edit Budget &amp; FTs
              </button>

              {showResetAllConfirm ? (
                <div className="bg-rose-950/80 border border-rose-500/40 p-3 rounded-2xl flex flex-col gap-2 text-center animate-in fade-in zoom-in-95">
                  <span className="text-xs text-rose-200 font-bold flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    Reset all future gameweeks to default?
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleResetAll}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-colors"
                    >
                      Yes, Reset All
                    </button>
                    <button
                      onClick={() => setShowResetAllConfirm(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowResetAllConfirm(true)}
                  className="w-full py-2 rounded-2xl bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-white/5 hover:border-rose-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  title="Reset all planned transfers across future gameweeks"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset All Future Gameweeks
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Chips Strategy Card (2x2 Chunky Square Grid) */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-white/15 shadow-xl">
        <span className="text-xs sm:text-sm font-black text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          Chips Strategy
        </span>

        {/* 2x2 Square Grid of Chips */}
        <div className="grid grid-cols-2 gap-2.5">
          {CHIPS.map(chip => {
            const Icon = chip.icon;
            const isSelectedThisGw = activeChip === chip.id;
            
            const playedInHistory = playedChips.find(c => c.name === chip.id);
            const isPlayedInPast = !!playedInHistory;

            const plannedGw = getChipPlannedGw(chip.id);
            const isPlannedOtherGw = plannedGw !== null && plannedGw !== selectedGameweek;

            let subtext = chip.desc;
            let isDisabled = isLocked || false;

            if (isPlayedInPast) {
              subtext = `GW ${playedInHistory.event}`;
              if (playedInHistory.event !== selectedGameweek) {
                isDisabled = true;
              }
            } else if (isPlannedOtherGw) {
              subtext = `GW ${plannedGw}`;
            }

            return (
              <button
                key={chip.id}
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  setChip(isSelectedThisGw ? 'none' : chip.id);
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between min-h-[105px] transition-all select-none ${
                  isSelectedThisGw
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg scale-102 font-black'
                    : isPlayedInPast
                    ? 'bg-slate-950/40 border-white/5 opacity-45 cursor-not-allowed text-slate-500'
                    : isPlannedOtherGw
                    ? 'bg-slate-950/70 border-amber-500/30 text-amber-300/80 hover:bg-slate-800'
                    : isLocked
                    ? 'bg-slate-950/40 border-white/5 opacity-40 cursor-default text-slate-500'
                    : `bg-slate-950/80 border-white/10 hover:border-white/20 hover:scale-102 ${chip.color}`
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`p-2 rounded-xl ${isSelectedThisGw ? 'bg-slate-950 text-amber-400' : 'bg-slate-900'}`}>
                    {isPlayedInPast || (isLocked && !isSelectedThisGw) ? (
                      <Lock className="w-4 h-4 text-slate-500" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  {isPlayedInPast && (
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-mono font-bold">
                      USED
                    </span>
                  )}
                  {isSelectedThisGw && (
                    <span className="text-[9px] bg-slate-950 text-amber-300 px-1.5 py-0.5 rounded-md font-black uppercase">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-col">
                  <span className={`text-xs sm:text-sm font-black truncate leading-tight ${isSelectedThisGw ? 'text-slate-950' : 'text-white'}`}>
                    {chip.label}
                  </span>
                  <span className={`text-[10px] sm:text-[11px] truncate mt-0.5 ${isSelectedThisGw ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                    {subtext}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};