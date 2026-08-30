import React, { useState, useRef, useEffect } from 'react';
import { SquadPick } from '@/types/fpl';
import { usePlannerStore } from '@/store/usePlannerStore';
import { KitIcon } from '@/components/ui/KitIcon';
import { FdrFixtureCell } from '@/components/ui/FdrBadge';
import { formatMoney } from '@/lib/fpl-rules';
import { X, Crown, ArrowLeftRight, AlertTriangle, Trophy } from 'lucide-react';

interface PlayerCardProps {
  pick: SquadPick;
  isBench?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ pick, isBench = false }) => {
  const { 
    playerMap, 
    teamMap, 
    selectedSlotForSwap, 
    selectSlotForSwap, 
    setCaptain, 
    setViceCaptain, 
    openTransferDrawer,
    selectedPlayerForTransfer,
    getPlayerUpcomingFixtures,
    getPlayerGameweekActualPoints,
    fixtureHorizon,
    cardTheme,
    selectedGameweek,
    isGameweekLocked,
    openPlayerDetail
  } = usePlannerStore();

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showRoleMenu) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('touchstart', handleOutsideClick);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showRoleMenu]);

  const player = playerMap.get(pick.element);
  if (!player) return null;

  const team = teamMap.get(player.team);
  const isSwapSelected = selectedSlotForSwap === pick.position;
  const isTransferSelected = selectedPlayerForTransfer === player.id;
  const isLocked = isGameweekLocked(selectedGameweek);
  const fixtures = getPlayerUpcomingFixtures(player.id, fixtureHorizon);
  const isGK = player.element_type === 1;
  const isDark = cardTheme === 'dark';

  const isDoubtfulOrInjured = player.status !== 'a';

  // Get actual official score if this is a locked/completed gameweek
  const rawActualPoints = getPlayerGameweekActualPoints(player.id, selectedGameweek);
  const actualPoints = rawActualPoints !== null ? rawActualPoints : 0;
  const mult = pick.multiplier > 0 ? pick.multiplier : 1;
  const finalScore = actualPoints * mult;

  return (
    <div className="relative flex flex-col items-center select-none group">
      {/* Main Card Container */}
      <div
        onClick={() => {
          if (!isLocked && selectedSlotForSwap !== null) {
            selectSlotForSwap(pick.position);
          }
        }}
        className={`relative w-[68px] min-w-[58px] max-w-[78px] sm:w-[134px] sm:min-w-0 sm:max-w-none md:w-[160px] lg:w-[185px] xl:w-[210px] 2xl:w-[225px] rounded-xl sm:rounded-3xl shadow-xl overflow-hidden transition-all duration-200 ${
          isDark 
            ? 'bg-slate-900/90 backdrop-blur-md border border-white/20 text-white shadow-2xl shadow-slate-950/80' 
            : 'bg-white text-slate-900 border border-slate-200/90'
        } ${
          isLocked ? 'cursor-default' : 'cursor-pointer'
        } ${
          isTransferSelected
            ? 'ring-2 sm:ring-4 ring-emerald-500 scale-102 shadow-2xl'
            : isSwapSelected
            ? 'ring-2 sm:ring-4 ring-amber-400 animate-pulse scale-102 shadow-2xl'
            : ''
        }`}
      >
        {/* Top-Left Corner: Captain / Vice Captain Badge */}
        <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-20">
          {pick.is_captain && (
            <div
              className="bg-black text-amber-300 font-black text-[9px] sm:text-xs md:text-sm w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center border sm:border-2 border-amber-300 shadow"
              title="Captain"
            >
              C
            </div>
          )}
          {pick.is_vice_captain && !pick.is_captain && (
            <div
              className="bg-black text-white font-black text-[9px] sm:text-xs md:text-sm w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center border sm:border-2 border-slate-300 shadow"
              title="Vice Captain"
            >
              V
            </div>
          )}
          {!isLocked && isDoubtfulOrInjured && !pick.is_captain && !pick.is_vice_captain && (
            <span 
              className="bg-amber-500 text-slate-950 text-[7.5px] sm:text-[10px] font-black px-1 sm:px-1.5 py-0.2 rounded-full flex items-center shadow"
              title={player.news || 'Status alert'}
            >
              <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5" />
              {player.chance_of_playing_next_round !== null ? `${player.chance_of_playing_next_round}%` : '!'}
            </span>
          )}
        </div>

        {/* Top-Right Corner: Circular Dark '✕' Sell Button (Only for unlocked future gameweeks) */}
        {!isLocked && (
          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 z-20">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openTransferDrawer(player.id);
              }}
              className="bg-slate-950 hover:bg-rose-600 text-white rounded-full w-4 h-4 sm:w-6 sm:h-6 lg:w-6.5 lg:h-6.5 flex items-center justify-center shadow border border-white/20 transition-all hover:scale-110 active:scale-95"
              title={`Sell / Transfer ${player.web_name}`}
            >
              <X className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-white" />
            </button>
          </div>
        )}

        {/* 1. Top Section: Centered Kit */}
        <div className={`pt-1.5 sm:pt-2.5 pb-0.5 sm:pb-1 px-1 sm:px-2 flex items-center justify-center min-h-[50px] sm:min-h-[90px] md:min-h-[105px] lg:min-h-[120px] xl:min-h-[130px] transition-colors ${
          isDark 
            ? 'bg-slate-950/70' 
            : 'bg-gradient-to-b from-slate-50 to-white'
        }`}>
          <div 
            onClick={(e) => {
              if (!isLocked) {
                e.stopPropagation();
                openTransferDrawer(player.id);
              }
            }}
            className={isLocked ? 'cursor-default' : 'cursor-pointer hover:scale-105 transition-transform'}
            title={!isLocked ? `Click jersey to transfer / replace ${player.web_name}` : undefined}
          >
            <KitIcon 
              teamCode={team?.code} 
              teamShortName={team?.short_name} 
              isGoalkeeper={isGK} 
              className="w-9 h-9 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 xl:w-26 xl:h-26" 
            />
          </div>
        </div>

        {/* 2. Middle Section: Player Surname + Price (Stacked on mobile for full name width, side-by-side on desktop) */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            openPlayerDetail(player.id);
          }}
          className={`px-1 sm:px-3 py-0.5 sm:py-1.5 flex flex-col sm:flex-row items-center sm:items-baseline justify-center sm:justify-between gap-0 sm:gap-1 cursor-pointer transition-colors group/name text-center sm:text-left ${
            isDark 
              ? 'bg-slate-900 hover:bg-slate-800' 
              : 'bg-white hover:bg-slate-100'
          }`}
          title={`Click to view ${player.web_name} full match statistics & fixtures`}
        >
          <span className={`w-full sm:w-auto font-black text-[10.5px] sm:text-sm md:text-[15px] lg:text-[16.5px] xl:text-[18px] truncate leading-tight tracking-tight transition-colors ${
            isDark 
              ? 'text-white group-hover/name:text-emerald-400' 
              : 'text-slate-900 group-hover/name:text-emerald-700'
          }`}>
            {player.web_name}
          </span>
          <span className={`font-bold text-[9px] sm:text-xs md:text-[13px] lg:text-[14.5px] xl:text-[15.5px] leading-tight shrink-0 font-mono ${
            isDark ? 'text-emerald-400' : 'text-slate-600'
          }`}>
            {formatMoney(player.now_cost, true)}
          </span>
        </div>

        {/* 3. Thin Divider Line */}
        <div className={`w-full h-[1px] ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

        {/* 4. Bottom Section: If Locked -> Show Official Points Bar! If Future -> Show Upcoming Fixture Cells */}
        {isLocked ? (
          <div className={`py-1 sm:py-2 px-1 sm:px-3 text-center flex items-center justify-center gap-1 sm:gap-1.5 font-mono ${
            pick.is_captain 
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-black shadow-inner' 
              : finalScore >= 6 
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black' 
              : 'bg-slate-900 text-slate-200 font-bold'
          }`}>
            <Trophy className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 ${pick.is_captain ? 'text-slate-950' : 'text-amber-400'}`} />
            <span className="text-xs sm:text-base tracking-tight font-black">
              {finalScore} <span className="text-[9px] sm:text-[11px] font-sans uppercase font-bold">pts</span>
            </span>
            {pick.multiplier > 1 && (
              <span className="text-[8px] sm:text-[10px] bg-black/20 px-0.5 sm:px-1 rounded font-sans font-bold hidden xs:inline">
                ({actualPoints}×{pick.multiplier})
              </span>
            )}
          </div>
        ) : (
          <div className={`flex w-full overflow-hidden divide-x ${isDark ? 'divide-slate-950' : 'divide-slate-300'}`}>
            {fixtures.map((fix, idx) => (
              <FdrFixtureCell key={`${fix.event}-${idx}`} fixture={fix} totalCount={fixtureHorizon} />
            ))}
            {fixtures.length === 0 && (
              <div className="py-1 sm:py-2 text-center text-[8px] sm:text-xs text-slate-400 w-full bg-slate-100 font-medium">
                No Fixt.
              </div>
            )}
          </div>
        )}

        {/* Desktop-Only Sub/Role Trigger Bar (Hidden on compact mobile screens to keep cards sleek) */}
        {!isLocked && (
          <div className={`hidden sm:flex items-center justify-between px-3 py-1 text-[11px] transition-colors ${
            isDark 
              ? 'bg-slate-950 text-slate-400 border-t border-white/10' 
              : 'bg-slate-50 text-slate-500 border-t border-slate-200'
          }`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                selectSlotForSwap(pick.position);
              }}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                isSwapSelected 
                  ? 'bg-amber-400 text-slate-950 font-black shadow' 
                  : isDark 
                  ? 'hover:text-white font-bold' 
                  : 'hover:text-slate-900 font-bold'
              }`}
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>Sub</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowRoleMenu(!showRoleMenu);
              }}
              className="hover:text-amber-400 px-1.5 py-0.5 rounded font-bold transition-colors"
            >
              <Crown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Role Popover (Only for unlocked future gameweeks) */}
      {!isLocked && showRoleMenu && (
        <div 
          ref={roleMenuRef}
          className="absolute top-16 z-50 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 min-w-[150px] text-xs text-white animate-in fade-in zoom-in-95"
        >
          <button
            className="px-3 py-2 hover:bg-amber-500/20 text-left rounded-xl flex items-center gap-2 text-amber-300 font-bold"
            onClick={() => {
              setCaptain(player.id);
              setShowRoleMenu(false);
            }}
          >
            <Crown className="w-4 h-4 text-amber-400" /> Make Captain
          </button>
          <button
            className="px-3 py-2 hover:bg-slate-700 text-left rounded-xl flex items-center gap-2 text-slate-200 font-semibold"
            onClick={() => {
              setViceCaptain(player.id);
              setShowRoleMenu(false);
            }}
          >
            <Crown className="w-4 h-4 opacity-70" /> Make Vice-C
          </button>
          <button
            className="px-3 py-2 hover:bg-rose-500/20 text-left rounded-xl flex items-center gap-2 text-rose-400 font-semibold border-t border-slate-800 mt-0.5"
            onClick={() => {
              openTransferDrawer(player.id);
              setShowRoleMenu(false);
            }}
          >
            <X className="w-4 h-4" /> Transfer Out
          </button>
        </div>
      )}
    </div>
  );
};