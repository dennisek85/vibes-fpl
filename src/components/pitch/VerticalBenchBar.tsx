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
    <aside className="hidden lg:flex flex-col bg-slate-900/85 backdrop-blur-xl p-3 rounded-3xl border border-white/15 shadow-xl w-48 sm:w-56 xl:w-60 flex-shrink-0 justify-between select-none">
      <div className="flex items-center justify-between pb-1.5 border-b border-white/10 flex-shrink-0">
        <span className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          Substitutes
        </span>
        <span className="text-[10px] text-slate-400 font-mono font-bold">
          4 Bench
        </span>
      </div>

      <div className="flex flex-col justify-around flex-1 py-1 gap-2">
        {benchPicks.map((pick, idx) => {
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
    </aside>
  );
};