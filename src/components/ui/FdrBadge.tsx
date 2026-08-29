import React from 'react';
import { PlayerFixtureItem } from '@/types/fpl';
import { usePlannerStore } from '@/store/usePlannerStore';

interface FdrFixtureCellProps {
  fixture: PlayerFixtureItem;
  totalCount: number;
}

export const FdrFixtureCell: React.FC<FdrFixtureCellProps> = ({ fixture, totalCount }) => {
  const { showAiPredictions } = usePlannerStore();
  const diff = fixture.difficulty || 3;
  const opp = fixture.opponentShortName || 'TBD';
  const loc = fixture.isHome ? '(H)' : '(A)';

  let bgClass = 'bg-slate-500 text-white';
  if (diff === 1 || diff === 2) {
    bgClass = 'bg-emerald-600 text-white';
  } else if (diff === 3) {
    bgClass = 'bg-slate-400 text-slate-950 font-black';
  } else if (diff === 4) {
    bgClass = 'bg-rose-600 text-white';
  } else if (diff === 5) {
    bgClass = 'bg-red-950 text-rose-200 border-t border-rose-500/40';
  }

  const heightClass = totalCount <= 1 ? 'py-1.5' : totalCount <= 3 ? 'py-1' : 'py-0.5';

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center ${heightClass} ${bgClass} transition-all font-mono select-none px-0.5`}
      title={`Gameweek ${fixture.event}: vs ${opp} ${loc} (Difficulty: ${diff}${showAiPredictions && fixture.xP ? ` · ${fixture.xP} xP` : ''})`}
    >
      <span className="text-[11.5px] sm:text-[12.5px] md:text-[14px] font-black tracking-tight leading-tight uppercase truncate max-w-full">
        {opp} {loc}
      </span>
      {showAiPredictions && fixture.xP !== undefined && (
        <span className="text-[10px] sm:text-[12px] md:text-[13px] opacity-95 font-extrabold leading-none mt-0.5">
          {fixture.xP.toFixed(1)} xP
        </span>
      )}
    </div>
  );
};