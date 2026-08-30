import React, { useState, useRef, useEffect } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { PlayerCard } from './PlayerCard';
import { SquadPick } from '@/types/fpl';
import { CheckCircle2, Wand2, Loader2 } from 'lucide-react';

export const FootballPitch: React.FC = () => {
  const { 
    selectedGameweek, 
    gameweekPlans, 
    playerMap, 
    showAiPredictions, 
    toggleAiPredictions,
    optimizeSquadLineup,
    isGameweekLocked,
    isLoading
  } = usePlannerStore();
  const isLocked = isGameweekLocked(selectedGameweek);
  const currentPlan = gameweekPlans[selectedGameweek];

  const [isPressing, setIsPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const [showUnlockToast, setShowUnlockToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = () => {
    setIsPressing(true);
    setPressProgress(0);

    const startTime = Date.now();
    const duration = 1200; // 1.2 seconds hold

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));
      setPressProgress(progress);
    }, 20);

    pressTimerRef.current = setTimeout(() => {
      toggleAiPredictions();
      const newState = !showAiPredictions;
      setToastMessage(newState ? '✨ AI Projections Lab Activated!' : '🔒 AI Predictions Hidden');
      setShowUnlockToast(true);
      setTimeout(() => setShowUnlockToast(false), 3000);
      cancelLongPress();
    }, duration);
  };

  const cancelLongPress = () => {
    setIsPressing(false);
    setPressProgress(0);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  useEffect(() => {
    return () => cancelLongPress();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-slate-900/50 rounded-3xl border border-white/10 text-slate-400 w-full h-[calc(94vh-80px)]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-semibold text-slate-300">Loading your squad & plan...</p>
      </div>
    );
  }

  if (!currentPlan || !currentPlan.squad || currentPlan.squad.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-slate-900/50 rounded-3xl border border-white/10 text-slate-400 w-full h-[calc(94vh-80px)]">
        <p className="text-lg font-semibold">No team loaded for Gameweek {selectedGameweek}</p>
      </div>
    );
  }

  const startingPicks = (currentPlan?.squad || []).filter(p => p.position <= 11);

  const gks: SquadPick[] = [];
  const defs: SquadPick[] = [];
  const mids: SquadPick[] = [];
  const fwds: SquadPick[] = [];

  for (const pick of startingPicks) {
    const player = playerMap.get(pick.element);
    if (!player) continue;
    if (player.element_type === 1) gks.push(pick);
    else if (player.element_type === 2) defs.push(pick);
    else if (player.element_type === 3) mids.push(pick);
    else if (player.element_type === 4) fwds.push(pick);
  }

  const formationString = `${defs.length}-${mids.length}-${fwds.length}`;

  return (
    <div className="w-full flex-1 h-full flex flex-col items-center min-h-0">
      {/* Football Pitch Graphic Container */}
      <div className="relative w-full h-full flex-1 rounded-3xl overflow-hidden shadow-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-[#0c2e17] via-[#0f4422] to-[#071f0f] flex flex-col justify-around py-2 sm:py-3 px-2 sm:px-6">
        {/* Grass Pattern Stripes */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.06)_0px,rgba(0,0,0,0.06)_60px,transparent_60px,transparent_120px)] pointer-events-none" />

        {/* Pitch Lines (Tactical markings) */}
        <div className="absolute inset-3 sm:inset-5 border-2 border-white/35 rounded-2xl pointer-events-none">
          {/* Halfway Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/35 -translate-y-1/2" />
          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 w-36 sm:w-48 md:w-64 h-36 sm:h-48 md:h-64 border-2 border-white/35 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-white/50 rounded-full -translate-x-1/2 -translate-y-1/2" />
          {/* Top Penalty Area */}
          <div className="absolute top-0 left-1/2 w-72 sm:w-96 md:w-[480px] h-24 sm:h-32 border-b-2 border-x-2 border-white/35 rounded-b-2xl -translate-x-1/2" />
          {/* Top Goal Area */}
          <div className="absolute top-0 left-1/2 w-32 sm:w-48 h-10 sm:h-14 border-b-2 border-x-2 border-white/35 -translate-x-1/2" />
          {/* Bottom Penalty Area */}
          <div className="absolute bottom-0 left-1/2 w-72 sm:w-96 md:w-[480px] h-24 sm:h-32 border-t-2 border-x-2 border-white/35 rounded-t-2xl -translate-x-1/2" />
        </div>

        {/* Secret Football Easter Egg Trigger */}
        <div className="absolute top-16 left-32 sm:left-48 md:left-52 z-30 select-none">
          <div
            onMouseDown={startLongPress}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onTouchStart={startLongPress}
            onTouchEnd={cancelLongPress}
            className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center cursor-pointer transition-transform duration-200 ${
              isPressing ? 'scale-110' : 'hover:scale-105'
            }`}
            title="Secret: Hold down on the football to toggle AI Projections Mode"
          >
            {/* SVG Circular Progress Ring while long-pressing */}
            {isPressing && (
              <svg className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90 pointer-events-none z-10">
                <circle
                  cx="50%"
                  cy="50%"
                  r="44%"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray="100"
                  strokeDashoffset={100 - pressProgress}
                  strokeLinecap="round"
                  className="transition-all duration-75"
                />
              </svg>
            )}

            {/* Glowing Aura when AI Mode is Active */}
            {showAiPredictions && (
              <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-sm animate-pulse pointer-events-none" />
            )}

            {/* Football Graphic (Natural Pitch Ball) */}
            <div className={`w-full h-full rounded-full bg-white shadow-md border flex items-center justify-center overflow-hidden drop-shadow-md transition-all ${
              showAiPredictions ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-slate-300/80'
            }`}>
              <svg viewBox="0 0 100 100" className="w-full h-full p-0.5">
                {/* Center Pentagon */}
                <polygon points="50,30 65,42 60,60 40,60 35,42" fill={showAiPredictions ? '#065f46' : '#1e293b'} />
                {/* Connecting Lines & Outer Pentagons */}
                <line x1="50" y1="30" x2="50" y2="10" stroke={showAiPredictions ? '#065f46' : '#1e293b'} strokeWidth="4" />
                <line x1="65" y1="42" x2="85" y2="35" stroke={showAiPredictions ? '#065f46' : '#1e293b'} strokeWidth="4" />
                <line x1="60" y1="60" x2="75" y2="80" stroke={showAiPredictions ? '#065f46' : '#1e293b'} strokeWidth="4" />
                <line x1="40" y1="60" x2="25" y2="80" stroke={showAiPredictions ? '#065f46' : '#1e293b'} strokeWidth="4" />
                <line x1="35" y1="42" x2="15" y2="35" stroke={showAiPredictions ? '#065f46' : '#1e293b'} strokeWidth="4" />
                <polygon points="50,10 38,0 62,0" fill={showAiPredictions ? '#065f46' : '#1e293b'} />
                <polygon points="85,35 100,28 95,50" fill={showAiPredictions ? '#065f46' : '#1e293b'} />
                <polygon points="75,80 88,95 65,100" fill={showAiPredictions ? '#065f46' : '#1e293b'} />
                <polygon points="25,80 12,95 35,100" fill={showAiPredictions ? '#065f46' : '#1e293b'} />
                <polygon points="15,35 0,28 5,50" fill={showAiPredictions ? '#065f46' : '#1e293b'} />
              </svg>
            </div>
          </div>
        </div>

        {/* Unlocking Popup Toast */}
        {showUnlockToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/50 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-white text-xs sm:text-sm font-black animate-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* In-Pitch Top Right Bar: Quick AI Optimize (Only when AI mode is unlocked) + Formation Badge */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {!isLocked && showAiPredictions && (
            <button
              onClick={() => {
                const res = optimizeSquadLineup(selectedGameweek);
                if (res) {
                  setToastMessage(`✨ Optimized ${res.formation} · ${res.captainName} (C) · ${res.totalProjectedPoints} xP`);
                  setShowUnlockToast(true);
                  setTimeout(() => setShowUnlockToast(false), 4000);
                }
              }}
              className="bg-slate-950/80 hover:bg-emerald-600 text-emerald-300 hover:text-white font-black px-3 py-1.5 rounded-full border border-emerald-500/40 text-xs backdrop-blur-md shadow-lg transition-all flex items-center gap-1.5 active:scale-95 group animate-in fade-in"
              title="Auto-optimize starting XI and captain for highest expected points"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
              <span>AI Optimize</span>
            </button>
          )}

          <span className="bg-slate-950/75 text-emerald-300 font-black px-3 py-1.5 rounded-full border border-emerald-500/40 text-xs backdrop-blur-md shadow-lg pointer-events-none">
            {formationString}
          </span>
        </div>

        {/* 1. Goalkeeper Row */}
        <div className="relative z-10 w-full flex justify-center items-center py-1">
          {gks.map(pick => (
            <PlayerCard key={pick.position} pick={pick} />
          ))}
        </div>

        {/* 2. Defenders Row */}
        <div className="relative z-10 w-full flex justify-around items-center py-1">
          {defs.map(pick => (
            <PlayerCard key={pick.position} pick={pick} />
          ))}
        </div>

        {/* 3. Midfielders Row */}
        <div className="relative z-10 w-full flex justify-around items-center py-1">
          {mids.map(pick => (
            <PlayerCard key={pick.position} pick={pick} />
          ))}
        </div>

        {/* 4. Forwards Row */}
        <div className="relative z-10 w-full flex justify-around items-center py-1">
          {fwds.map(pick => (
            <PlayerCard key={pick.position} pick={pick} />
          ))}
        </div>
      </div>
    </div>
  );
};