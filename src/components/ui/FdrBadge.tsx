import React from "react";
import { PlayerFixtureItem } from "@/types/fpl";
import { usePlannerStore } from "@/store/usePlannerStore";

interface FdrFixtureCellProps {
  fixture: PlayerFixtureItem;
  totalCount: number;
}

export const FdrFixtureCell: React.FC<FdrFixtureCellProps> = ({
  fixture,
  totalCount,
}) => {
  const { showAiPredictions } = usePlannerStore();
  const diff = fixture.difficulty || 3;
  const opp = fixture.opponentShortName || "TBD";
  const loc = fixture.isHome ? "(H)" : "(A)";

  let bgClass = "bg-slate-500 text-white";
  if (diff === 1 || diff === 2) {
    bgClass = "bg-emerald-600 text-white";
  } else if (diff === 3) {
    bgClass = "bg-slate-300 text-slate-900 font-black";
  } else if (diff === 4) {
    bgClass = "bg-[#e90052] text-white font-black";
  } else if (diff === 5) {
    bgClass = "bg-[#6a041d] text-rose-100 font-black";
  }

  // Adaptive font and spacing classes based on number of columns and screen size
  const heightClass =
    totalCount <= 1
      ? "py-1 sm:py-2"
      : totalCount <= 3
        ? "py-0.5 sm:py-1.5"
        : "py-0.5 sm:py-1";

  const oppText = totalCount === 5 ? `${opp}${loc}` : `${opp} ${loc}`;

  const oppFontClass =
    totalCount === 1
      ? "text-[10px] sm:text-[16px] md:text-[17px] lg:text-[18.5px] tracking-tight"
      : totalCount <= 3
        ? "text-[7.5px] sm:text-[12px] md:text-[13.5px] lg:text-[15.5px] tracking-tight"
        : "text-[6.5px] sm:text-[10px] md:text-[11px] lg:text-[12px] tracking-tighter";

  const xpFontClass =
    totalCount === 1
      ? "text-[9px] sm:text-[14.5px] md:text-[15.5px] lg:text-[17px]"
      : totalCount <= 3
        ? "text-[7px] sm:text-[11px] md:text-[12.5px] lg:text-[14.5px]"
        : "text-[6px] sm:text-[9px] md:text-[10px] lg:text-[11px] tracking-tighter";

  return (
    <div
      className={`flex-1 min-w-0 overflow-hidden flex flex-col items-center justify-center ${heightClass} ${bgClass} transition-all font-mono select-none px-0.5`}
      title={`Gameweek ${fixture.event}: vs ${opp} ${loc} (Difficulty: ${diff}${showAiPredictions && fixture.xP !== undefined ? ` · ${fixture.xP.toFixed(1)} xP` : ""})`}
    >
      <span
        className={`${oppFontClass} font-black leading-tight uppercase truncate max-w-full`}
      >
        {/* On ultra-compact screens show short name without (H)/(A) if cramped */}
        <span className="sm:hidden">{opp}</span>
        <span className="hidden sm:inline">{oppText}</span>
      </span>
      {showAiPredictions && fixture.xP !== undefined && (
        <span
          className={`${xpFontClass} opacity-95 font-extrabold leading-none mt-0.5 truncate max-w-full`}
        >
          <span className="sm:hidden">{fixture.xP.toFixed(1)}</span>
          <span className="hidden sm:inline">
            {totalCount === 5
              ? `${fixture.xP.toFixed(1)}`
              : `${fixture.xP.toFixed(1)} xP`}
          </span>
        </span>
      )}
    </div>
  );
};
