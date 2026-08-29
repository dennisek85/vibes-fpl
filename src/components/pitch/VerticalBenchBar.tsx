import React from 'react';
import { SquadPick } from '@/types/fpl';
import { PlayerCard } from './PlayerCard';
import { usePlannerStore } from '@/store/usePlannerStore';

interface VerticalBenchProps {
  benchPicks: SquadPick[];
}

export const VerticalBenchBar: React.FC<VerticalBenchProps> = ({ benchPicks }) => {
  const { playerMap } = usePlannerStore();

  return (
    <div className="flex flex-col bg-slate-900/90 backdrop-blur-md p-3 sm:p-3.5 rounded-3xl border border-white/15 shadow-2xl h-[calc(95vh-75px)] min-h-[760px] justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          Substitutes
        </span>
        <span className="text-xs text-slate-400 font-bold">
          4 Bench
        </span>
      </div>

      <div className="flex flex-col justify-around flex-1 py-1 gap-2">
        {benchPicks.map((pick, idx) => {
          const player = playerMap.get(pick.element);
          const posLabel = idx === 0 ? 'GK' : `Bench ${idx}`;

          return (
            <div key={pick.element || idx} className="flex flex-col items-center">
              <span className="text-xs font-black text-slate-300 mb-0.5 uppercase tracking-wider">
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