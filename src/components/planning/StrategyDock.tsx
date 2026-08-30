import React, { useState, useMemo } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { ChipType } from '@/types/fpl';
import { 
  Sparkles, 
  Zap, 
  Shield, 
  Flame, 
  RotateCcw,
  Wand2,
  Lightbulb,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Gauge,
  Layers
} from 'lucide-react';
import { useSquadRating } from '@/hooks/useSquadRating';

const CHIPS: Array<{ id: ChipType; label: string; icon: any; color: string; desc: string }> = [
  { id: 'wildcard', label: 'WC', icon: Sparkles, color: 'text-purple-300 border-purple-500/30 hover:bg-purple-950/40', desc: 'Wildcard' },
  { id: 'freehit', label: 'FH', icon: Zap, color: 'text-amber-300 border-amber-500/30 hover:bg-amber-950/40', desc: 'Free Hit' },
  { id: 'bboost', label: 'BB', icon: Shield, color: 'text-blue-300 border-blue-500/30 hover:bg-blue-950/40', desc: 'Bench Boost' },
  { id: '3xc', label: '3TC', icon: Flame, color: 'text-rose-300 border-rose-500/30 hover:bg-rose-950/40', desc: 'Triple Captain' },
];

interface StrategyDockProps {
  onOpenOverrides: () => void;
}

export const StrategyDock: React.FC<StrategyDockProps> = ({ onOpenOverrides }) => {
  const { 
    selectedGameweek, 
    gameweekPlans, 
    playedChips,
    setChip,
    fixtureHorizon,
    setFixtureHorizon,
    resetCurrentGameweek,
    resetAllFutureGameweeks,
    isGameweekLocked,
    showAiPredictions,
    toggleAiPredictions,
    optimizeSquadLineup,
    openScoutModal,
  } = usePlannerStore();

  const [activeSlide, setActiveSlide] = useState(0);
  const [optResult, setOptResult] = useState<any | null>(null);

  const isLocked = isGameweekLocked(selectedGameweek);
  const activePlan = gameweekPlans[selectedGameweek];
  const activeChip = activePlan?.chip || 'none';

  const squadRating = useSquadRating();

  const getChipPlannedGw = (chipId: ChipType): number | null => {
    for (const [gwStr, plan] of Object.entries(gameweekPlans)) {
      const gw = parseInt(gwStr, 10);
      if (plan.chip === chipId) return gw;
    }
    return null;
  };

  const handleAutoOptimize = () => {
    const res = optimizeSquadLineup(selectedGameweek);
    if (res) {
      setOptResult(res);
      setTimeout(() => setOptResult(null), 5000);
    }
  };

  return (
    <div className="w-full max-w-7xl px-1 sm:px-4 mt-4 sm:mt-6 mb-8">
      {/* Mobile Slide Controls */}
      <div className="flex md:hidden items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Strategy & AI Controls
        </span>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
            disabled={activeSlide === 0}
            className="p-1 rounded-lg bg-slate-900 border border-white/10 text-slate-300 disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex gap-1 px-1">
            {[0, 1, 2].map(idx => (
              <span 
                key={idx} 
                className={`h-1.5 rounded-full transition-all ${activeSlide === idx ? 'w-4 bg-emerald-400' : 'w-1.5 bg-slate-700'}`}
              />
            ))}
          </div>
          <button 
            onClick={() => setActiveSlide(Math.min(2, activeSlide + 1))}
            disabled={activeSlide === 2}
            className="p-1 rounded-lg bg-slate-900 border border-white/10 text-slate-300 disabled:opacity-30"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3-Column Desktop Grid / Responsive Mobile Carousel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        
        {/* Card 1: Strategy Chips */}
        <div className={`bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xl ${activeSlide !== 0 ? 'hidden md:flex' : 'flex'}`}>
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Chips Strategy
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {activeChip !== 'none' ? `${activeChip.toUpperCase()} Active` : 'No Chip Active'}
              </span>
            </div>

            {!isLocked && (
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {CHIPS.map(chip => {
                  const playedInHistory = playedChips.find(c => c.name === chip.id);
                  const isUsed = !!playedInHistory;
                  const isCurrent = activeChip === chip.id;
                  const plannedGw = getChipPlannedGw(chip.id);
                  const isPlannedElsewhere = plannedGw !== null && plannedGw !== selectedGameweek;

                  return (
                    <button
                      key={chip.id}
                      disabled={isUsed || isPlannedElsewhere}
                      onClick={() => setChip(isCurrent ? 'none' : chip.id)}
                      className={`py-2 rounded-xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 ${
                        isCurrent
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-950/60 scale-102'
                          : isUsed || isPlannedElsewhere
                          ? 'bg-slate-950/40 border-white/5 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-950/80 border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-white'
                      }`}
                      title={chip.desc}
                    >
                      <span>{chip.label}</span>
                      <span className="text-[9px] font-normal opacity-70">
                        {isUsed ? 'Used' : isPlannedElsewhere ? `GW${plannedGw}` : chip.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <button
              onClick={() => {
                if (confirm(`Reset Gameweek ${selectedGameweek} plan to default?`)) {
                  resetCurrentGameweek();
                }
              }}
              className="flex-1 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              Reset GW {selectedGameweek}
            </button>
          </div>
        </div>

        {/* Card 2: AI Intelligence Hub & Horizon (Secret Easter Egg - Unlocked via football long-click) */}
        {showAiPredictions && (
          <div className={`bg-slate-900/85 backdrop-blur-xl border border-emerald-500/40 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xl animate-in fade-in ${activeSlide !== 1 ? 'hidden md:flex' : 'flex'}`}>
            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
                <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                  AI Intelligence & Radar
                </span>
                <button
                  onClick={toggleAiPredictions}
                  className="text-[10px] bg-slate-950 hover:bg-rose-950/80 px-2 py-0.5 rounded-lg border border-white/10 text-slate-400 hover:text-rose-300 transition flex items-center gap-1"
                  title="Deactivate AI Mode"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Hide</span>
                </button>
              </div>

              {/* AI-Only: Squad Power Rating (0-100% vs Dream XI) */}
              {squadRating && (
                <div className="p-2.5 rounded-2xl bg-slate-950/90 border border-white/10 flex flex-col gap-1.5 shadow-inner mb-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                      Team Rating
                    </span>
                    <span className={`text-sm font-black font-mono px-2 py-0.5 rounded-lg border ${
                      squadRating.overallPercentage >= 85 
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' 
                        : squadRating.overallPercentage >= 75 
                        ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40' 
                        : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                    }`}>
                      {squadRating.overallPercentage}%
                    </span>
                  </div>

                  {/* Sub-percentages row */}
                  <div className="grid grid-cols-4 gap-1 text-center font-mono">
                    <div className="bg-slate-900/90 py-1 rounded-lg border border-white/5">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase block font-sans">DEF</span>
                      <span className="text-[11px] font-black text-slate-200">{squadRating.defensePercentage}%</span>
                    </div>
                    <div className="bg-slate-900/90 py-1 rounded-lg border border-white/5">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase block font-sans">MID</span>
                      <span className="text-[11px] font-black text-slate-200">{squadRating.midfieldPercentage}%</span>
                    </div>
                    <div className="bg-slate-900/90 py-1 rounded-lg border border-white/5">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase block font-sans">FWD</span>
                      <span className="text-[11px] font-black text-slate-200">{squadRating.forwardPercentage}%</span>
                    </div>
                    <div className="bg-slate-900/90 py-1 rounded-lg border border-white/5">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase block font-sans">CAP</span>
                      <span className="text-[11px] font-black text-amber-300">{squadRating.captainPercentage}%</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 mb-3">
                <button
                  onClick={() => openScoutModal()}
                  className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 hover:brightness-110 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition active:scale-98"
                >
                  <Lightbulb className="w-4 h-4 text-amber-300" />
                  Open AI Transfer Radar (+xP)
                </button>

                <button
                  onClick={() => openScoutModal(undefined, undefined, undefined, 'optimal_squad')}
                  className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-700 hover:brightness-110 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-950/80 transition active:scale-98 border border-emerald-400/40 animate-in fade-in"
                >
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  🔮 Strongest Team Solver
                </button>
              </div>
            </div>

            {/* Fixture Horizon */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Horizon:
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-white/10">
                {[1, 3, 5].map((hz) => (
                  <button
                    key={hz}
                    onClick={() => setFixtureHorizon(hz as 1 | 3 | 5)}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition ${
                      fixtureHorizon === hz 
                        ? 'bg-emerald-600 text-white shadow' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {hz}GW
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Card 3: Lineup Optimizer & Overrides */}
        <div className={`bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xl ${activeSlide !== 2 ? 'hidden md:flex' : 'flex'}`}>
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-cyan-400" />
                Lineup Optimizer
              </span>
              <span className="text-[10px] text-slate-400">OpenFPL ML</span>
            </div>

            <button
              onClick={handleAutoOptimize}
              className="w-full py-2.5 px-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-white/15 text-slate-200 hover:text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98 mb-2"
            >
              <Wand2 className="w-4 h-4 text-amber-400" />
              ⚡ Auto-Optimize Starting 11 &amp; (C)
            </button>

            {optResult && (
              <p className="text-[11px] text-emerald-400 font-bold text-center py-0.5 animate-in fade-in">
                ✨ Set {optResult.formation} · {optResult.captainName} (C) · {optResult.totalProjectedPoints} xP
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button
              onClick={onOpenOverrides}
              className="w-full py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              Edit Budget &amp; Free Transfers Overrides
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
