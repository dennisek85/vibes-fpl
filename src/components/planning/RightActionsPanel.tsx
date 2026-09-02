import React, { useState } from "react";
import { usePlannerStore } from "@/store/usePlannerStore";
import { SquadPick } from "@/types/fpl";
import { KitIcon } from "@/components/ui/KitIcon";
import { formatMoney } from "@/lib/fpl-rules";
import { OptimizationResult } from "@/utils/aiOptimizer";
import { UI_TEXT } from "@/lib/ui-text";
import { Wand2, Edit3, Trash2, AlertCircle, ShieldAlert } from "lucide-react";

interface RightActionsPanelProps {
  benchPicks: SquadPick[];
  onOpenOverrides: () => void;
}

export const RightActionsPanel: React.FC<RightActionsPanelProps> = ({
  benchPicks,
  onOpenOverrides,
}) => {
  const {
    selectedGameweek,
    playerMap,
    teamMap,
    optimizeSquadLineup,
    resetAllFutureGameweeks,
    openPlayerDetail,
    selectedSlotForSwap,
    selectSlotForSwap,
    isGameweekLocked,
  } = usePlannerStore();

  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const isLocked = isGameweekLocked(selectedGameweek);

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
      {/* 1. Lineup Optimizer */}
      <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 shadow-xl flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
            {UI_TEXT.optimizer.title}
          </span>
          <span className="text-[10px] text-slate-400">OpenFPL ML</span>
        </div>

        <button
          onClick={handleAutoOptimize}
          className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/15 text-slate-200 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
        >
          <Wand2 className="w-3.5 h-3.5 text-amber-400" />
          {UI_TEXT.optimizer.autoOptimize11AndC}
        </button>

        {optResult && (
          <div className="flex flex-col items-center gap-1 py-0.5 animate-in fade-in">
            <p className="text-[10.5px] text-emerald-400 font-bold text-center leading-tight flex items-center gap-1.5 flex-wrap justify-center">
              <span>✨ {optResult.formation} · {optResult.captainName} (C) · {optResult.totalProjectedPoints} xP</span>
              <span
                className={`px-1.5 py-0.2 rounded-md text-[9.5px] font-black border ${
                  optResult.pointsGain > 0
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                }`}
              >
                {optResult.pointsGain > 0
                  ? UI_TEXT.optimizer.gainBadge(optResult.pointsGain)
                  : UI_TEXT.optimizer.optimalBadge}
              </span>
            </p>
          </div>
        )}

        <button
          onClick={onOpenOverrides}
          className="w-full py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-[11px] font-bold transition flex items-center justify-center gap-1.5 mt-0.5"
        >
          <Edit3 className="w-3 h-3 text-emerald-400" />
          Edit Budget &amp; Free Transfers
        </button>
      </div>

      {/* 2. Compact Substitutes Bench List */}
      <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 shadow-xl flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 flex-shrink-0">
          <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
            Substitutes
          </span>
          <span className="text-[10px] text-slate-400 font-mono">4 Bench</span>
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5 flex-1">
          {benchPicks.map((pick) => {
            const player = playerMap.get(pick.element);
            if (!player) return null;
            const team = teamMap.get(player.team);
            const isSwapSelected = selectedSlotForSwap === pick.position;
            const isGK = player.element_type === 1;

            return (
              <div
                key={pick.position}
                onClick={() => {
                  if (!isLocked && selectedSlotForSwap !== null) {
                    selectSlotForSwap(pick.position);
                  } else {
                    openPlayerDetail(player.id);
                  }
                }}
                className={`p-1.5 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-2 cursor-pointer hover:border-emerald-500/50 transition-all ${
                  isSwapSelected
                    ? "ring-2 ring-amber-400 animate-pulse bg-amber-950/30"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <KitIcon
                    teamCode={team?.code}
                    teamShortName={team?.short_name}
                    isGoalkeeper={isGK}
                    className="w-7 h-7 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-black text-white truncate block leading-tight">
                      {player.web_name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {player.element_type === 1
                        ? "GK"
                        : `B${pick.position - 11}`}{" "}
                      · {formatMoney(player.now_cost, true)}
                    </span>
                  </div>
                </div>

                {!isLocked && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectSlotForSwap(pick.position);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                      isSwapSelected
                        ? "bg-amber-400 text-slate-950 border-amber-300 font-black"
                        : "bg-slate-900 border-white/10 text-slate-300 hover:text-white"
                    }`}
                  >
                    Sub
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Reset All Confirm / Button */}
        <div className="pt-2 mt-2 border-t border-white/10 flex-shrink-0">
          {showResetAllConfirm ? (
            <div className="bg-rose-950/80 border border-rose-500/40 p-2 rounded-xl flex flex-col gap-1.5 text-center animate-in fade-in">
              <span className="text-[10.5px] text-rose-200 font-bold flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                Reset all future GWs?
              </span>
              <div className="flex items-center justify-center gap-1.5">
                <button
                  onClick={handleResetAll}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black"
                >
                  Yes, Reset
                </button>
                <button
                  onClick={() => setShowResetAllConfirm(false)}
                  className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold"
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
