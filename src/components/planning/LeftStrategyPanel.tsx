import React, { useState } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { ChipType } from '@/types/fpl';
import { 
  Zap, 
  Sparkles, 
  Lightbulb, 
  Eye, 
  EyeOff, 
  RotateCcw,
  Layers,
  Wand2,
  Edit3,
  Trash2,
  AlertCircle
} from 'lucide-react';

const CHIPS: Array<{ id: ChipType; label: string; color: string; desc: string }> = [
  { id: 'wildcard', label: 'WC', color: 'text-purple-300 border-purple-500/30', desc: 'Wildcard' },
  { id: 'freehit', label: 'FH', color: 'text-amber-300 border-amber-500/30', desc: 'Free Hit' },
  { id: 'bboost', label: 'BB', color: 'text-blue-300 border-blue-500/30', desc: 'Bench Boost' },
  { id: '3xc', label: '3TC', color: 'text-rose-300 border-rose-500/30', desc: 'Triple Captain' },
];

interface LeftStrategyPanelProps {
  onOpenOverrides: () => void;
}

export const LeftStrategyPanel: React.FC<LeftStrategyPanelProps> = ({ onOpenOverrides }) => {
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
    openScoutModal
  } = usePlannerStore();

  const [optResult, setOptResult] = useState<any | null>(null);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);

  const isLocked = isGameweekLocked(selectedGameweek);
  const activePlan = gameweekPlans[selectedGameweek];
  const activeChip = activePlan?.chip || 'none';

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

  const handleResetAll = () => {
    resetAllFutureGameweeks();
    setShowResetAllConfirm(false);
  };

  return (
    <aside className="hidden lg:flex flex-col gap-2.5 w-60 xl:w-68 flex-shrink-0 select-none">
      {/* 1. Chips Strategy Card */}
      <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10">
            <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Chips Strategy
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">
              {activeChip !== 'none' ? `${activeChip.toUpperCase()}` : 'None'}
            </span>
          </div>

          {!isLocked && (
            <div className="grid grid-cols-4 gap-1 mb-2">
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
                    className={`py-1.5 rounded-xl border text-xs font-black transition-all flex flex-col items-center justify-center ${
                      isCurrent
                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-md scale-102'
                        : isUsed || isPlannedElsewhere
                        ? 'bg-slate-950/40 border-white/5 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-950/80 border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-white'
                    }`}
                    title={chip.desc}
                  >
                    <span>{chip.label}</span>
                    <span className="text-[8.5px] font-normal opacity-70">
                      {isUsed ? 'Used' : isPlannedElsewhere ? `GW${plannedGw}` : chip.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            if (confirm(`Reset Gameweek ${selectedGameweek} plan to default?`)) {
              resetCurrentGameweek();
            }
          }}
          className="w-full py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-white text-[11px] font-bold transition flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3 h-3 text-amber-400" />
          Reset GW {selectedGameweek}
        </button>
      </div>

      {/* 2. AI Transfer Scout Radar & Horizon */}
      <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 shadow-xl flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            AI Radar &amp; Scout
          </span>
          <button
            onClick={toggleAiPredictions}
            className="text-[10px] bg-slate-950 px-2 py-0.5 rounded-lg border border-white/10 text-slate-300 hover:text-white transition flex items-center gap-1"
          >
            {showAiPredictions ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3 text-slate-500" />}
            <span className={showAiPredictions ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {showAiPredictions ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        <button
          onClick={() => openScoutModal()}
          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/60 transition active:scale-98"
        >
          <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
          Open AI Transfer Radar
        </button>

        {/* Fixture Horizon */}
        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" />
            Horizon:
          </span>
          <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-xl border border-white/10">
            {[1, 3, 5].map((hz) => (
              <button
                key={hz}
                onClick={() => setFixtureHorizon(hz as 1 | 3 | 5)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition ${
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

      {/* 3. Lineup Optimizer & Overrides */}
      <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 shadow-xl flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
            Lineup &amp; Overrides
          </span>
          <span className="text-[10px] text-slate-400">OpenFPL ML</span>
        </div>

        <button
          onClick={handleAutoOptimize}
          className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/15 text-slate-200 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
        >
          <Wand2 className="w-3.5 h-3.5 text-amber-400" />
          ⚡ Auto-Optimize Lineup
        </button>

        {optResult && (
          <p className="text-[10px] text-emerald-400 font-bold text-center py-0.5 animate-in fade-in leading-tight">
            ✨ {optResult.formation} · {optResult.captainName} (C) · {optResult.totalProjectedPoints} xP
          </p>
        )}

        <button
          onClick={onOpenOverrides}
          className="w-full py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-[11px] font-bold transition flex items-center justify-center gap-1.5"
        >
          <Edit3 className="w-3 h-3 text-emerald-400" />
          Edit Budget &amp; Free Transfers
        </button>

        {/* Reset All Confirm */}
        <div className="pt-1 border-t border-white/10">
          {showResetAllConfirm ? (
            <div className="bg-rose-950/80 border border-rose-500/40 p-2 rounded-xl flex flex-col gap-1.5 text-center animate-in fade-in">
              <span className="text-[10px] text-rose-200 font-bold flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                Reset all future GWs?
              </span>
              <div className="flex items-center justify-center gap-1.5">
                <button
                  onClick={handleResetAll}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black"
                >
                  Yes, Reset
                </button>
                <button
                  onClick={() => setShowResetAllConfirm(false)}
                  className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowResetAllConfirm(true)}
              className="w-full py-1 text-[10px] text-slate-500 hover:text-rose-400 transition flex items-center justify-center gap-1"
            >
              <Trash2 className="w-2.5 h-2.5" />
              Reset All Future GWs
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

