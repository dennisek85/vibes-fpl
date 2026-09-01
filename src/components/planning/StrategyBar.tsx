import React from "react";
import { usePlannerStore } from "@/store/usePlannerStore";
import { formatMoney } from "@/lib/fpl-rules";
import { RotateCcw, Edit3, PoundSterling, ArrowRightLeft } from "lucide-react";

interface StrategyBarProps {
  onOpenOverrides: () => void;
}

export const StrategyBar: React.FC<StrategyBarProps> = ({
  onOpenOverrides,
}) => {
  const { selectedGameweek, gameweekPlans, resetCurrentGameweek } =
    usePlannerStore();

  const plan = gameweekPlans[selectedGameweek];
  if (!plan) return null;

  const transfersCount = plan.transfersIn.length;
  const availableFT = plan.availableTransfers;
  const hits = plan.transferCost;
  const bank = plan.calculatedBank;
  const isBankOverridden =
    plan.bankOverride !== null && plan.bankOverride !== undefined;
  const isFTOverridden =
    plan.freeTransfersOverride !== null &&
    plan.freeTransfersOverride !== undefined;

  return (
    <div className="w-full max-w-5xl mx-auto my-2.5 p-3 sm:p-4 bg-slate-900/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/15 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-slate-200">
      {/* Left: Financials & Transfers Info with Click-to-Edit overrides */}
      <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
        {/* Free Transfers Pill */}
        <div
          onClick={onOpenOverrides}
          className="flex items-center gap-2 bg-slate-950/90 px-3.5 py-2 rounded-2xl border border-white/15 cursor-pointer hover:border-emerald-400 transition-all hover:scale-102 group shadow-sm"
          title="Click to override Free Transfers count"
        >
          <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ArrowRightLeft className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-slate-400 leading-none">
              Free Transfers
            </span>
            <span className="text-sm sm:text-base font-black text-white leading-tight flex items-center gap-1.5 mt-0.5">
              {Math.max(0, availableFT - transfersCount)} / {availableFT}
              {isFTOverridden && (
                <span className="text-[10px] text-amber-400 font-normal">
                  (override)
                </span>
              )}
            </span>
          </div>
          <Edit3 className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
        </div>

        {/* Projected Bank Pill (British Pound Symbol) */}
        <div
          onClick={onOpenOverrides}
          className="flex items-center gap-2 bg-slate-950/90 px-3.5 py-2 rounded-2xl border border-white/15 cursor-pointer hover:border-emerald-400 transition-all hover:scale-102 group shadow-sm"
          title="Click to override Projected Bank balance"
        >
          <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <PoundSterling className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-slate-400 leading-none">
              Projected Bank
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-400 font-mono leading-tight flex items-center gap-1.5 mt-0.5">
              {formatMoney(bank, true)}
              {isBankOverridden && (
                <span className="text-[10px] text-amber-400 font-sans font-normal">
                  (override)
                </span>
              )}
            </span>
          </div>
          <Edit3 className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
        </div>

        {/* Point Hits if any */}
        {hits > 0 && (
          <div className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-500/50 text-rose-300 px-3.5 py-2 rounded-2xl shadow-sm">
            <span className="text-sm font-black">-{hits} pts</span>
            <span className="text-xs opacity-80">(Hits)</span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5">
        {transfersCount > 0 && (
          <button
            onClick={resetCurrentGameweek}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>Reset GW</span>
          </button>
        )}

        <button
          onClick={onOpenOverrides}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all active:scale-95"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit Budget / FTs</span>
        </button>
      </div>
    </div>
  );
};
