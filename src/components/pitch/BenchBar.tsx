import React from "react";
import { SquadPick } from "@/types/fpl";
import { PlayerCard } from "./PlayerCard";

interface BenchBarProps {
  benchPicks: SquadPick[];
}

export const BenchBar: React.FC<BenchBarProps> = ({ benchPicks }) => {
  return (
    <div className="w-full max-w-5xl mx-auto mt-2 sm:mt-4 p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/15 shadow-2xl">
      <div className="flex items-center justify-between mb-1.5 px-2">
        <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          Substitutes Bench
        </span>
        <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
          Tap player to swap
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 sm:gap-4 md:gap-6 justify-items-center">
        {benchPicks.map((pick, idx) => {
          const posLabel = idx === 0 ? "GK" : `B${idx}`;
          return (
            <div
              key={pick.element || idx}
              className="flex flex-col items-center w-full"
            >
              <span className="text-[9px] sm:text-xs font-bold text-slate-400 mb-0.5 sm:mb-1 uppercase tracking-wide">
                <span className="sm:hidden">{posLabel}</span>
                <span className="hidden sm:inline">
                  {idx === 0 ? "GK" : `Bench ${idx}`}
                </span>
              </span>
              <PlayerCard pick={pick} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
