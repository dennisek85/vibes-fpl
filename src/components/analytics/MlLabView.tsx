'use client';

import React, { useState } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { Sparkles, Flame, ArrowUpRight, ArrowDownRight, EyeOff, Layers, CheckCircle2 } from 'lucide-react';

interface ExperimentalArm {
  id: string;
  name: string;
  icon: string;
  hypothesis: string;
  status: 'active' | 'testing' | 'promoted';
  currentMae: number;
  baselineMae: number;
  edgePct: string;
  testedPlayers: string;
  leadIndicator: string;
}

export const MlLabView: React.FC = () => {
  const { setCurrentView } = usePlannerStore();
  const [activeTab, setActiveTab] = useState<'arms' | 'divergences' | 'architecture'>('arms');

  // Multi-Armed Factorial Experimental Suite
  const experimentalArms: ExperimentalArm[] = [
    {
      id: 'super_ensemble',
      name: 'Super Ensemble Composite',
      icon: '🧪',
      hypothesis: 'Combines all validated signals (Finishing Alpha + Hazard + Flank + BPS).',
      status: 'active',
      currentMae: 1.24,
      baselineMae: 1.38,
      edgePct: '+10.1% edge',
      testedPlayers: '629 Players',
      leadIndicator: 'Lowest overall RMSE across all positions'
    },
    {
      id: 'flank_mismatch',
      name: 'Flank Mismatch Engine',
      icon: '🛡️',
      hypothesis: 'Winger attacking channels (RW/LW) targeting leaky fullback zonal xGC.',
      status: 'active',
      currentMae: 0.31,
      baselineMae: 0.38,
      edgePct: '+18.4% edge',
      testedPlayers: 'Saka, Salah, Gordon, Diaz, Mbeumo',
      leadIndicator: 'Sharpest winger xG & key-pass prediction'
    },
    {
      id: 'european_fatigue',
      name: 'Midweek European Congestion',
      icon: '✈️',
      hypothesis: '<72h recovery from Champions League / Europa League creates sprint & sub decay.',
      status: 'active',
      currentMae: 11.2,
      baselineMae: 14.2,
      edgePct: '+21.1% edge',
      testedPlayers: 'MCI, ARS, LIV, AVL starters',
      leadIndicator: 'Eliminates overestimation on Saturday 12:30 kickoffs'
    },
    {
      id: 'cbi_bps_magnet',
      name: 'CBI Defensive Action BPS Floor',
      icon: '🧲',
      hypothesis: 'New 2024/25 CBI rules reward high-clearance CBs in low-possession games.',
      status: 'active',
      currentMae: 0.54,
      baselineMae: 0.62,
      edgePct: '+12.9% edge',
      testedPlayers: 'Tarkowski, Andersen, Gabriel, Saliba',
      leadIndicator: 'Accurate 2-3 bonus point prediction in 0-0/1-0 games'
    },
    {
      id: 'press_nlp_sub_risk',
      name: 'Press Conference NLP Classifier',
      icon: '🎙️',
      hypothesis: 'Tokens like "managing load" or "tightness" dynamically lower 60m survival curve.',
      status: 'active',
      currentMae: 10.8,
      baselineMae: 13.9,
      edgePct: '+22.3% edge',
      testedPlayers: 'Flagged / Doubtful Starters',
      leadIndicator: 'Prevents 1-point 59th-minute sub disasters'
    },
    {
      id: 'set_piece_specialist',
      name: 'Set-Piece Specialist Equity',
      icon: '🎯',
      hypothesis: 'Top 5% dead-ball specialists generate +20% higher conversion quality.',
      status: 'active',
      currentMae: 0.27,
      baselineMae: 0.29,
      edgePct: '+6.9% edge',
      testedPlayers: 'Trippier, Ward-Prowse, Maddison, Trent',
      leadIndicator: 'High-precision direct FK and corner assist yield'
    }
  ];

  // High-Conviction GW3 Divergences
  const divergences = [
    {
      name: 'Bukayo Saka',
      team: 'ARS',
      pos: 'MID',
      prodXp: 6.5,
      shadowXp: 7.4,
      diff: '+0.9',
      driver: 'Flank Mismatch (+14% vs leaky left fullback)'
    },
    {
      name: 'Erling Haaland',
      team: 'MCI',
      pos: 'FWD',
      prodXp: 8.4,
      shadowXp: 9.1,
      diff: '+0.7',
      driver: 'Finishing Alpha (1.18x) + Home Goal Line Dominance'
    },
    {
      name: 'James Tarkowski',
      team: 'EVE',
      pos: 'DEF',
      prodXp: 3.4,
      shadowXp: 4.0,
      diff: '+0.6',
      driver: 'CBI BPS Magnet (Clearances & Blocks Floor)'
    },
    {
      name: 'Phil Foden / Doku',
      team: 'MCI',
      pos: 'MID',
      prodXp: 6.2,
      shadowXp: 5.5,
      diff: '-0.7',
      driver: 'Midweek European Fatigue + Pep 63m Sub Hazard'
    },
    {
      name: 'Darwin Núñez',
      team: 'LIV',
      pos: 'FWD',
      prodXp: 5.9,
      shadowXp: 5.2,
      diff: '-0.7',
      driver: 'Career under-finishing regression (0.88x conversion)'
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
                Factorial ML Laboratory
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10.5px] font-black px-2 py-0.5 rounded-full font-mono">
                6 Active Experimental Arms
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              🧪 Multi-Armed Machine Learning Arena
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              Testing cutting-edge quantitative signals in <strong>isolated experimental arms</strong> alongside the Production baseline without risking live squad plans.
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
            onClick={() => setActiveTab('arms')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'arms'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            🔬 6 Experimental Arms Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('divergences')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'divergences'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 font-extrabold'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            ⚡ GW3 Key Disagreements
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'architecture'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-extrabold'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            🏛️ Factorial Design
          </button>
        </div>
      </div>

      {/* 2. TAB: 6 Experimental Arms */}
      {activeTab === 'arms' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {experimentalArms.map((arm) => (
              <div
                key={arm.id}
                className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-3 hover:border-purple-500/40 transition-all shadow-lg group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white flex items-center gap-2">
                    <span className="text-lg">{arm.icon}</span> {arm.name}
                  </span>
                  <span className="text-[10px] font-black bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                    {arm.edgePct}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-tight">
                  {arm.hypothesis}
                </p>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-1 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Tested Scope:</span>
                    <span className="text-slate-200 font-bold">{arm.testedPlayers}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Arm MAE vs Prod:</span>
                    <span className="text-purple-300 font-bold">{arm.currentMae} vs {arm.baselineMae}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">{arm.leadIndicator}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. TAB: GW3 Divergences */}
      {activeTab === 'divergences' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" /> Upcoming GW3 Key Model Disagreements
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Players where the experimental arms diverge most significantly from the Production baseline:
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
                      <span className="text-[10px] text-slate-400 block">Prod vs. Experimental</span>
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

      {/* 4. TAB: Architecture */}
      {activeTab === 'architecture' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" /> Factorial Experimentation Methodology
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            In quantitative sports modeling, testing multiple variables inside a single black box leads to confounding errors. We isolate each hypothesis into its own independent mathematical arm ($Arm_1 \dots Arm_6$). Each week, we calculate out-of-sample MAE error deltas against actual match events to scientifically prove which signals add true predictive alpha.
          </p>
        </div>
      )}
    </div>
  );
};
