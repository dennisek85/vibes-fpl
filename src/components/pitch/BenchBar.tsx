import React from 'react';
import { SquadPick } from '@/types/fpl';
import { PlayerCard } from './PlayerCard';
import { usePlannerStore } from '@/store/usePlannerStore';

interface BenchBarProps {
  benchPicks: SquadPick[];
}

export const BenchBar: React.FC<BenchBarProps> = ({ benchPicks }) => {
  const { playerMap } = usePlannerStore();

  return (
    <div className="w-full max-w-5xl mx-auto mt-4 p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/15 shadow-2xl">
      <div className="flex items-center justify-between mb-2 px-3">
        <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          Substitutes Bench
        </span>
        <span className="text-xs text-slate-400 font-medium">
          Tap â‡„ Sub to swap onto pitch
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-4 md:gap-6 justify-items-center">
        {benchPicks.map((pick, idx) => {
          const posLabel = idx === 0 ? 'GK' : `Bench ${idx}`;
          return (
            <div key={pick.element || idx} className="flex flex-col items-center w-full">
              <span className="text-[10px] sm:text-xs font-bold text-slate-300 mb-1 uppercase tracking-wide">
                {posLabel}
              </span>
              <PlayerCard pick={pick} isBench />
            </div>
          );
        })}
      </div>
    </div>
  );
};