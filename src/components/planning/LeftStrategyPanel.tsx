import React, { useState, useMemo } from 'react';
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
  AlertCircle,
  Gauge
} from 'lucide-react';
import { calculateSquadRating } from '@/utils/aiSquadRating';

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
    autoOrderBenchLineup,
    openScoutModal,
    players,
    playerMap,
    getPlayerGameweekXp
  } = usePlannerStore();

  const [optResult, setOptResult] = useState<any | null>(null);
  const [benchOrderedMsg, setBenchOrderedMsg] = useState(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);

  const isLocked = isGameweekLocked(selectedGameweek);
  const activePlan = gameweekPlans[selectedGameweek];
  const activeChip = activePlan?.chip || 'none';

  const squadRating = useMemo(() => {
    if (!showAiPredictions || !activePlan?.squad) return null;
    const currentVal = activePlan.squad.reduce((s, p) => s + (playerMap.get(p.element)?.now_cost || 0), 0);
    const budget = currentVal + (activePlan.calculatedBank || 0);

    return calculateSquadRating(
      activePlan.squad,
      players,
      playerMap,
      selectedGameweek,
      getPlayerGameweekXp,
      fixtureHorizon,
      budget
    );
  }, [showAiPredictions, activePlan?.squad, activePlan?.calculatedBank, players, playerMap, selectedGameweek, getPlayerGameweekXp, fixtureHorizon]);

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
    <aside className="hidden lg:flex flex-col gap-2.5 w-64 xl:w-76 2xl:w-84 flex-shrink-0 select-none">
      {/* 1. Chips Strategy Card */}
      <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
            <span className="text-sm xl:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Chips Strategy
            </span>
            <span className="text-xs text-emerald-400 font-mono font-black">
              {activeChip !== 'none' ? `${activeChip.toUpperCase()}` : 'None'}
            </span>
          </div>

          {!isLocked && (
            <div className="grid grid-cols-4 gap-1.5 mb-2.5">
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
                    className={`py-2 rounded-xl border text-xs sm:text-sm font-black transition-all flex flex-col items-center justify-center ${
                      isCurrent
                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-md scale-102'
                        : isUsed || isPlannedElsewhere
                        ? 'bg-slate-950/40 border-white/5 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-950/80 border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-white'
                    }`}
                    title={chip.desc}
                  >
                    <span>{chip.label}</span>
                    <span className="text-[9.5px] font-bold opacity-75">
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
          className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          Reset GW {selectedGameweek}
        </button>
      </div>

      {/* 2. AI Transfer Scout Radar & Horizon */}
      <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 shadow-xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="text-sm xl:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            AI Radar &amp; Scout
          </span>
          <button
            onClick={toggleAiPredictions}
            className="text-xs bg-slate-950 px-2.5 py-1 rounded-xl border border-white/10 text-slate-300 hover:text-white transition flex items-center gap-1.5"
          >
            {showAiPredictions ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
            <span className={showAiPredictions ? 'text-emerald-400 font-black' : 'text-slate-500 font-bold'}>
              {showAiPredictions ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* AI-Only: Squad Power Rating (0-100% vs Dream XI) */}
        {showAiPredictions && squadRating && (
          <div className="p-2.5 rounded-2xl bg-slate-950/90 border border-white/10 flex flex-col gap-2 shadow-inner animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                Team Rating
              </span>
              <span className={`text-base font-black font-mono px-2 py-0.5 rounded-lg border ${
                squadRating.overallPercentage >= 85 
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' 
                  : squadRating.overallPercentage >= 75 
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40' 
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
              }`}>
                {squadRating.overallPercentage}%
              </span>
            </div>

            {/* Clean Sub-percentages */}
            <div className="grid grid-cols-4 gap-1 text-center font-mono">
              <div className="bg-slate-900/90 py-1 px-0.5 rounded-lg border border-white/5">
                <span className="text-[9px] font-bold text-slate-400 uppercase block font-sans">DEF</span>
                <span className="text-xs font-black text-slate-200">{squadRating.defensePercentage}%</span>
              </div>
              <div className="bg-slate-900/90 py-1 px-0.5 rounded-lg border border-white/5">
                <span className="text-[9px] font-bold text-slate-400 uppercase block font-sans">MID</span>
                <span className="text-xs font-black text-slate-200">{squadRating.midfieldPercentage}%</span>
              </div>
              <div className="bg-slate-900/90 py-1 px-0.5 rounded-lg border border-white/5">
                <span className="text-[9px] font-bold text-slate-400 uppercase block font-sans">FWD</span>
                <span className="text-xs font-black text-slate-200">{squadRating.forwardPercentage}%</span>
              </div>
              <div className="bg-slate-900/90 py-1 px-0.5 rounded-lg border border-white/5">
                <span className="text-[9px] font-bold text-slate-400 uppercase block font-sans">CAP</span>
                <span className="text-xs font-black text-amber-300">{squadRating.captainPercentage}%</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => openScoutModal()}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 hover:brightness-110 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition active:scale-98"
        >
          <Lightbulb className="w-4 h-4 text-amber-300" />
          Open AI Transfer Radar
        </button>

        {/* AI-Only: Strongest Team Solver Button */}
        {showAiPredictions && (
          <button
            onClick={() => openScoutModal(undefined, undefined, undefined, 'optimal_squad')}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-700 hover:brightness-110 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-950/80 transition active:scale-98 border border-emerald-400/40 animate-in fade-in"
            title="Compute the mathematically strongest 15-man squad within your exact budget"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>🔮 Strongest Team Solver</span>
          </button>
        )}

        {/* Fixture Horizon */}
        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Horizon:
          </span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10">
            {[1, 3, 5].map((hz) => (
              <button
                key={hz}
                onClick={() => setFixtureHorizon(hz as 1 | 3 | 5)}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
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
      <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 shadow-xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="text-sm xl:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-cyan-400" />
            Lineup Optimizer
          </span>
          <span className="text-xs text-slate-400 font-mono">OpenFPL ML</span>
        </div>

        <button
          onClick={handleAutoOptimize}
          className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/15 text-slate-200 hover:text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98"
        >
          <Wand2 className="w-4 h-4 text-amber-400" />
          ⚡ Auto-Optimize Lineup
        </button>

        {showAiPredictions && (
          <button
            onClick={() => {
              const res = autoOrderBenchLineup();
              if (res) {
                setBenchOrderedMsg(true);
                setTimeout(() => setBenchOrderedMsg(false), 3000);
              }
            }}
            className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-cyan-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
            title="Automatically sort bench slots (12-15) so the highest-scoring sub comes on first"
          >
            <span>🔄 Smart Auto-Order Bench</span>
          </button>
        )}

        {benchOrderedMsg && (
          <p className="text-[11px] text-cyan-300 font-bold text-center animate-in fade-in">
            ✓ Bench ordered by highest expected points!
          </p>
        )}

        {optResult && (
          <p className="text-xs text-emerald-400 font-black text-center py-0.5 animate-in fade-in leading-tight">
            ✨ {optResult.formation} · {optResult.captainName} (C) · {optResult.totalProjectedPoints} xP
          </p>
        )}

        <button
          onClick={onOpenOverrides}
          className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
        >
          <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
          Edit Budget &amp; Free Transfers
        </button>

        {/* Reset All Confirm */}
        <div className="pt-1.5 border-t border-white/10">
          {showResetAllConfirm ? (
            <div className="bg-rose-950/80 border border-rose-500/40 p-2.5 rounded-xl flex flex-col gap-2 text-center animate-in fade-in">
              <span className="text-xs text-rose-200 font-bold flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                Reset all future GWs?
              </span>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleResetAll}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black"
                >
                  Yes, Reset
                </button>
                <button
                  onClick={() => setShowResetAllConfirm(false)}
                  className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowResetAllConfirm(true)}
              className="w-full py-1 text-xs text-slate-500 hover:text-rose-400 transition flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" />
              Reset All Future GWs
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

