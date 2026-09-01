'use client';

import React, { useState } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { Sparkles, Flame, ArrowUpRight, ArrowDownRight, EyeOff } from 'lucide-react';

interface ComponentComparison {
  name: string;
  icon: string;
  prodMetric: string;
  shadowMetric: string;
  prodValue: number;
  shadowValue: number;
  unit: string;
  description: string;
  winner: 'shadow' | 'prod' | 'tie';
  deltaPct: string;
}

export const MlLabView: React.FC = () => {
  const { setCurrentView } = usePlannerStore();
  const [activeTab, setActiveTab] = useState<'shootout' | 'divergences' | 'architecture'>('shootout');

  // Simulated live / frozen A/B shootout benchmark metrics
  const components: ComponentComparison[] = [
    {
      name: 'Expected Goals (xG)',
      icon: '⚽',
      prodMetric: 'Positional Mean xG',
      shadowMetric: 'Finishing Skill Alpha (npxG)',
      prodValue: 0.38,
      shadowValue: 0.31,
      unit: 'MAE',
      description: 'Son (+22%), Haaland (+18%) vs Darwin (-12%) career conversion multipliers.',
      winner: 'shadow',
      deltaPct: '+18.4% sharper'
    },
    {
      name: 'Expected Assists (xA)',
      icon: '🎯',
      prodMetric: 'Empirical xA Rate',
      shadowMetric: 'Key-Pass Volume Conversion',
      prodValue: 0.29,
      shadowValue: 0.28,
      unit: 'MAE',
      description: 'Open-play shot assists scaled with set-piece corner hierarchy.',
      winner: 'shadow',
      deltaPct: '+3.4% sharper'
    },
    {
      name: 'Clean Sheets (xCS)',
      icon: '🛡️',
      prodMetric: 'Standard Poisson Exp',
      shadowMetric: 'Dixon-Coles Low-Score Adj',
      prodValue: 0.42,
      shadowValue: 0.36,
      unit: 'Brier',
      description: 'Corrects 0-0 and 1-0 scoreline correlation for elite defences (ARS, MCI).',
      winner: 'shadow',
      deltaPct: '+14.2% sharper'
    },
    {
      name: 'Match Minutes (xMins)',
      icon: '⏱️',
      prodMetric: '60-Min Step Function',
      shadowMetric: 'Manager Sub Hazard Curves',
      prodValue: 14.2,
      shadowValue: 11.5,
      unit: 'Mins MAE',
      description: 'Pep/Arteta early sub hazard (63 min) vs Sean Dyche 90-min starters.',
      winner: 'shadow',
      deltaPct: '+19.0% sharper'
    },
    {
      name: 'Bonus Points (xBPS)',
      icon: '🌟',
      prodMetric: 'Static Tier BPS',
      shadowMetric: 'Dynamic Action BPS Regression',
      prodValue: 0.62,
      shadowValue: 0.58,
      unit: 'MAE',
      description: 'Defensive recoveries & tackles converted to 1-3 bonus point expectations.',
      winner: 'shadow',
      deltaPct: '+6.5% sharper'
    },
    {
      name: 'Master Expected Points (xP)',
      icon: '🏆',
      prodMetric: 'Bayesian Base Model',
      shadowMetric: 'A/B Ensemble Composite',
      prodValue: 1.38,
      shadowValue: 1.26,
      unit: 'Total MAE',
      description: 'Overall out-of-sample prediction error across all Premier League players.',
      winner: 'shadow',
      deltaPct: '+8.7% overall edge'
    }
  ];

  // High-Conviction Divergences for upcoming GW3
  const divergences = [
    {
      name: 'Son Heung-min',
      team: 'TOT',
      pos: 'MID',
      prodXp: 6.8,
      shadowXp: 7.6,
      diff: '+0.8',
      driver: 'Finishing Alpha (1.22x career conversion vs xG)'
    },
    {
      name: 'Erling Haaland',
      team: 'MCI',
      pos: 'FWD',
      prodXp: 8.4,
      shadowXp: 9.1,
      diff: '+0.7',
      driver: 'Finishing Alpha (1.18x) + Home Match Dominance'
    },
    {
      name: 'Gabriel Magalhães',
      team: 'ARS',
      pos: 'DEF',
      prodXp: 4.9,
      shadowXp: 5.3,
      diff: '+0.4',
      driver: 'Dixon-Coles CS boost (+6%) + Set-piece header equity'
    },
    {
      name: 'Darwin Núñez',
      team: 'LIV',
      pos: 'FWD',
      prodXp: 5.9,
      shadowXp: 5.2,
      diff: '-0.7',
      driver: 'Career under-finishing regression (0.88x conversion)'
    },
    {
      name: 'Phil Foden / Doku',
      team: 'MCI',
      pos: 'MID',
      prodXp: 6.2,
      shadowXp: 5.6,
      diff: '-0.6',
      driver: 'Guardiola winger sub hazard (63 min survival risk)'
    }
  ];

  const exitLab = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vibes_lab_mode');
    }
    setCurrentView('pitch');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-4 space-y-5 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/90 via-slate-900/90 to-cyan-950/90 border border-purple-500/40 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10.5px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-purple-400" />
                Private Experimental Sandbox
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10.5px] font-black px-2 py-0.5 rounded-full font-mono">
                GW3 Snapshot Frozen
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              🧪 Quantitative ML Lab & A/B Shootout
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              Benchmarking our <strong>Production Model</strong> against the <strong>Experimental Shadow Model</strong> (Finishing Skill Alpha, Manager Hazard Curves & Dixon-Coles CS) out-of-sample.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exitLab}
              className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/15 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Lock and hide ML Lab"
            >
              <EyeOff className="w-3.5 h-3.5" /> Exit Lab Mode
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-5 border-t border-white/10 pt-4">
          <button
            onClick={() => setActiveTab('shootout')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'shootout'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            🏆 6-Component Shootout
          </button>
          <button
            onClick={() => setActiveTab('divergences')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'divergences'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 font-extrabold'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            ⚡ GW3 Divergences
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'architecture'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-extrabold'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            🏛️ Model Architecture
          </button>
        </div>
      </div>

      {/* 2. TAB: 6-Component Shootout */}
      {activeTab === 'shootout' && (
        <div className="space-y-4">
          {/* Top Scoreboard Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-900/85 backdrop-blur-md border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Experimental Scorecard</p>
                <p className="text-2xl font-black text-purple-300 font-mono mt-0.5">Shadow 6 — 0 Prod</p>
              </div>
              <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl text-xl">🧪</div>
            </div>

            <div className="bg-slate-900/85 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overall xP Accuracy Edge</p>
                <p className="text-2xl font-black text-cyan-300 font-mono mt-0.5">+8.7% Lower MAE</p>
              </div>
              <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl text-xl">📈</div>
            </div>

            <div className="bg-slate-900/85 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Top Performing Component</p>
                <p className="text-xl font-black text-emerald-300 font-mono mt-0.5">Manager Sub Hazards</p>
              </div>
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl text-xl">⏱️</div>
            </div>
          </div>

          {/* 6 Components Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {components.map((comp) => (
              <div
                key={comp.name}
                className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-3 hover:border-purple-500/40 transition-all shadow-lg group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white flex items-center gap-2">
                    <span>{comp.icon}</span> {comp.name}
                  </span>
                  <span className="text-[10px] font-black bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                    {comp.deltaPct}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">Production</span>
                    <span className="text-base font-black text-slate-200 font-mono">
                      {comp.prodValue} <span className="text-[10px] text-slate-400">{comp.unit}</span>
                    </span>
                    <span className="text-[9px] text-slate-500 block truncate">{comp.prodMetric}</span>
                  </div>
                  <div className="border-l border-white/10 pl-2">
                    <span className="text-[10px] text-purple-300 font-semibold block">Shadow Model</span>
                    <span className="text-base font-black text-purple-300 font-mono">
                      {comp.shadowValue} <span className="text-[10px] text-purple-400/80">{comp.unit}</span>
                    </span>
                    <span className="text-[9px] text-purple-400/70 block truncate">{comp.shadowMetric}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-tight">
                  {comp.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. TAB: GW3 High-Conviction Divergences */}
      {activeTab === 'divergences' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" /> Upcoming GW3 Key Model Disagreements
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              These are the players where the <strong>Experimental Shadow Model</strong> diverges most significantly from the <strong>Production Model</strong> for this weekend:
            </p>
          </div>

          <div className="divide-y divide-white/10">
            {divergences.map((p) => {
              const isPositive = p.diff.startsWith('+');
              return (
                <div key={p.name} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-black text-xs flex items-center justify-center border border-purple-500/30 font-mono">
                      {p.team}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {p.name} <span className="text-[10px] text-slate-400 font-mono">({p.pos})</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">{p.driver}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-400 block">Prod vs. Shadow</span>
                      <span className="text-xs text-slate-300 font-bold">{p.prodXp} xP</span>
                      <span className="text-slate-500 mx-1">→</span>
                      <span className="text-xs text-purple-300 font-black">{p.shadowXp} xP</span>
                    </div>

                    <div className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono flex items-center gap-0.5 ${
                      isPositive ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                    }`}>
                      {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {p.diff} xP
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. TAB: Architecture Deep Dive */}
      {activeTab === 'architecture' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
              🎯
            </div>
            <h4 className="text-sm font-black text-white">1. Finishing Skill Alpha</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standard models assume all players convert 0.30 xG equally. Shadow model applies Bayesian-shrunk conversion multipliers from 8+ seasons (Son 1.22x, Haaland 1.18x vs Darwin 0.88x).
            </p>
          </div>

          <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
              ⏱️
            </div>
            <h4 className="text-sm font-black text-white">2. Manager Sub Hazards</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Models substitution timing hazard curves by manager. Pep/Arteta wingers face sub hazards at minute 63, risking 5-point clean sheet & 60-minute threshold drops.
            </p>
          </div>

          <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
              🛡️
            </div>
            <h4 className="text-sm font-black text-white">3. Dixon-Coles Correlation</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Replaces independent Poisson clean sheet probabilities with low-score inflated bivariate matrices (0-0, 1-0 correlation) to boost elite defensive valuations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
