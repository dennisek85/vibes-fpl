import React from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { ChipType } from '@/types/fpl';
import { Sparkles, Zap, Shield, Flame, Eye } from 'lucide-react';

const CHIPS: Array<{ id: ChipType; label: string; icon: any; color: string }> = [
  { id: 'wildcard', label: 'Wildcard', icon: Sparkles, color: 'hover:border-purple-400 text-purple-300' },
  { id: 'freehit', label: 'Free Hit', icon: Zap, color: 'hover:border-amber-400 text-amber-300' },
  { id: 'bboost', label: 'Bench Boost', icon: Shield, color: 'hover:border-blue-400 text-blue-300' },
  { id: '3xc', label: 'Triple Captain', icon: Flame, color: 'hover:border-rose-400 text-rose-300' },
];

export const GameweekTimeline: React.FC = () => {
  const { 
    startGameweek, 
    selectedGameweek, 
    selectGameweek, 
    gameweekPlans, 
    setChip,
    fixtureHorizon,
    setFixtureHorizon
  } = usePlannerStore();

  const activePlan = gameweekPlans[selectedGameweek];
  const activeChip = activePlan?.chip || 'none';

  const gws: number[] = [];
  for (let g = startGameweek; g <= Math.min(38, startGameweek + 5); g++) {
    gws.push(g);
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-3 my-2 sm:my-3">
      {/* Gameweek Horizontal Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
        <div className="flex items-center gap-2 min-w-max">
          {gws.map(gw => {
            const plan = gameweekPlans[gw];
            const isSelected = gw === selectedGameweek;
            const transfersCount = plan?.transfersIn?.length || 0;
            const chip = plan?.chip;

            return (
              <button
                key={gw}
                onClick={() => selectGameweek(gw)}
                className={`relative flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl transition-all font-black text-xs sm:text-sm min-w-[84px] sm:min-w-[98px] border ${
                  isSelected
                    ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-400 shadow-xl shadow-emerald-950/60 scale-105'
                    : 'bg-slate-900/85 text-slate-300 border-white/10 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>GW {gw}</span>
                <div className="flex items-center gap-1 mt-0.5">
                  {transfersCount > 0 && (
                    <span className="text-[10px] bg-emerald-400 text-slate-950 px-1.5 py-0.2 rounded-full font-black">
                      +{transfersCount}
                    </span>
                  )}
                  {chip && chip !== 'none' && (
                    <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full uppercase font-black">
                      {chip === 'wildcard' ? 'WC' : chip === 'freehit' ? 'FH' : chip === 'bboost' ? 'BB' : '3TC'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Fixture Horizon Selector: Next 1, Next 3, Next 5 opponents */}
        <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-2xl border border-white/15 shadow-inner">
          <div className="flex items-center gap-1 px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Fixtures:</span>
          </div>
          {([1, 3, 5] as const).map(count => (
            <button
              key={count}
              onClick={() => setFixtureHorizon(count)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                fixtureHorizon === count
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {count} {count === 1 ? 'GW' : 'GWs'}
            </button>
          ))}
        </div>
      </div>

      {/* Chip Strategy Bar for Selected Gameweek */}
      <div className="flex items-center justify-between bg-slate-950/80 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-white/10 text-xs text-slate-300">
        <span className="text-xs sm:text-sm font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          GW {selectedGameweek} Chips:
        </span>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {CHIPS.map(chip => {
            const Icon = chip.icon;
            const isActive = activeChip === chip.id;

            return (
              <button
                key={chip.id}
                onClick={() => setChip(isActive ? 'none' : chip.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm border transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md scale-105 font-black'
                    : `bg-slate-900/90 border-white/10 ${chip.color} hover:bg-slate-800`
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};