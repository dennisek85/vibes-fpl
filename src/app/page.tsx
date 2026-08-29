'use client';

import React, { useEffect, useState } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { FootballPitch } from '@/components/pitch/FootballPitch';
import { BenchBar } from '@/components/pitch/BenchBar';
import { VerticalBenchBar } from '@/components/pitch/VerticalBenchBar';
import { StrategyDock } from '@/components/planning/StrategyDock';
import { LeftStrategyPanel } from '@/components/planning/LeftStrategyPanel';
import { PlayerMarketDrawer } from '@/components/market/PlayerMarketDrawer';
import { TeamImportModal } from '@/components/ui/TeamImportModal';
import { OverridesModal } from '@/components/ui/OverridesModal';
import { SavePlanModal } from '@/components/ui/SavePlanModal';
import { PinAuthModal } from '@/components/ui/PinAuthModal';
import { AiScoutModal } from '@/components/modals/AiScoutModal';
import { PlayerMatrixView } from '@/components/matrix/PlayerMatrixView';
import { PlayerDetailModal } from '@/components/player/PlayerDetailModal';
import { logoutPin, isPinVerified } from '@/lib/auth';
import { formatMoney } from '@/lib/fpl-rules';
import { 
  Trophy, 
  Search, 
  Save, 
  ShoppingBag, 
  Lock, 
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  TableProperties,
  Sparkles,
  Zap,
  TrendingUp
} from 'lucide-react';

export default function PlannerPage() {
  const { 
    initFPLData, 
    teamSummary, 
    players, 
    playerMap,
    openTransferDrawer, 
    activePin, 
    isSaving, 
    selectedGameweek, 
    selectGameweek,
    gameweekPlans,
    isGameweekLocked,
    currentView,
    setCurrentView,
    getPlayerGameweekXp,
    showAiPredictions,
    toggleAiPredictions,
    fixtureHorizon,
    setFixtureHorizon
  } = usePlannerStore();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isOverridesModalOpen, setIsOverridesModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  useEffect(() => {
    initFPLData();
    setIsAuthenticated(isPinVerified());
  }, [initFPLData]);

  const handleLogout = () => {
    logoutPin();
    setIsAuthenticated(false);
    usePlannerStore.setState({ activePin: null });
  };

  const handleAuthSuccess = (isNewUser: boolean) => {
    setIsAuthenticated(true);
    if (isNewUser && !teamSummary) {
      setIsImportModalOpen(true);
    }
  };

  const currentPlan = gameweekPlans[selectedGameweek];
  const benchPicks = currentPlan?.squad
    ? currentPlan.squad.filter(p => p.position > 11).sort((a, b) => a.position - b.position)
    : [];

  const currentChip = currentPlan?.chip;
  const currentTransfers = currentPlan?.transfersIn?.length || 0;
  const isLocked = isGameweekLocked(selectedGameweek);
  const availableFT = currentPlan?.availableTransfers || 1;
  const bank = currentPlan?.calculatedBank || 0;
  const hits = currentPlan?.transferCost || 0;

  // Calculate Total Squad Projected Points (xP) for top telemetry
  let totalProjectedXp = 0;
  let squadFormSum = 0;
  if (currentPlan?.squad) {
    const isBenchBoost = currentChip === 'bboost';
    const isTripleCaptain = currentChip === '3xc';

    currentPlan.squad.forEach(pick => {
      const isStarting = pick.position <= 11;
      const pl = playerMap.get(pick.element);
      if (isStarting || isBenchBoost) {
        const xp = getPlayerGameweekXp(pick.element, selectedGameweek);
        let mult = 1;
        if (pick.is_captain) {
          mult = isTripleCaptain ? 3 : 2;
        }
        totalProjectedXp += xp * mult;
        if (pl) squadFormSum += parseFloat(pl.form) || 0;
      }
    });
  }
  totalProjectedXp = Math.round((totalProjectedXp - hits) * 10) / 10;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center">
      {!isAuthenticated && (
        <PinAuthModal onSuccess={handleAuthSuccess} />
      )}

      {/* Top Navigation Header with Centered Gameweek Stepper & View Switcher */}
      <header className="w-full bg-slate-950/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-40 px-3 sm:px-6 py-2 flex justify-center">
        <div className="w-[98vw] flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand & Team */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950/50">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  FPL Squad Planner
                </h1>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                  2026/27
                </span>
              </div>
              {teamSummary ? (
                <p className="text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-[280px]">
                  {teamSummary.name} · <span className="text-slate-300">{teamSummary.player_first_name} {teamSummary.player_last_name}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">Enter PIN or Import Team to start</p>
              )}
            </div>
          </div>

          {/* Center: Gameweek Arrow Stepper & View Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Gameweek Stepper */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 border border-white/15 px-2 sm:px-3 py-1 rounded-2xl shadow-lg">
              <button
                disabled={selectedGameweek <= 1}
                onClick={() => selectGameweek(selectedGameweek - 1)}
                className="p-1 sm:p-1.5 rounded-xl hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-slate-200 hover:text-white transition-all active:scale-90"
                title="Previous Gameweek"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <div className="flex items-center gap-1.5 px-2 sm:px-3 select-none">
                <span className="text-sm sm:text-base md:text-lg font-black text-white tracking-tight">
                  GW {selectedGameweek}
                </span>
                {currentTransfers > 0 && (
                  <span className="text-[10px] bg-emerald-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                    +{currentTransfers}
                  </span>
                )}
                {currentChip && currentChip !== 'none' && (
                  <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full uppercase">
                    {currentChip === 'wildcard' ? 'WC' : currentChip === 'freehit' ? 'FH' : currentChip === 'bboost' ? 'BB' : '3TC'}
                  </span>
                )}
              </div>

              <button
                disabled={selectedGameweek >= 38}
                onClick={() => selectGameweek(selectedGameweek + 1)}
                className="p-1 sm:p-1.5 rounded-xl hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-slate-200 hover:text-white transition-all active:scale-90"
                title="Next Gameweek"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* View Switcher Toggle Tabs */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-white/15 p-1 rounded-2xl shadow-lg">
              <button
                onClick={() => setCurrentView('pitch')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  currentView === 'pitch'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60 scale-102'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Visual Pitch Planner"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Pitch</span>
              </button>
              <button
                onClick={() => setCurrentView('matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  currentView === 'matrix'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60 scale-102'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Player Projections & Metrics Matrix"
              >
                <TableProperties className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Stats Matrix</span>
              </button>
            </div>
          </div>

          {/* Right: Actions & Sync */}
          <div className="flex items-center gap-2 shrink-0">
            {activePin && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300">
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PIN: <strong className="font-mono text-white">{activePin}</strong> (Synced)</span>
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Import Team</span>
            </button>

            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 transition-colors"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Plans</span>
            </button>

            {!isLocked && (
              <button
                onClick={() => openTransferDrawer()}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Transfers</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 border border-white/10 transition-colors ml-1"
              title="Lock / Switch PIN"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Visual Pitch View vs Stats Matrix View */}
      {currentView === 'pitch' ? (
        <div className="w-full max-w-[99vw] px-2 py-1.5 flex flex-col lg:flex-row items-stretch justify-center gap-2.5 lg:h-[calc(100vh-62px)] overflow-hidden animate-in fade-in duration-200">
          
          {/* Left Desktop Panel: Chips, AI Radar, Horizon, Optimizer & Overrides */}
          <LeftStrategyPanel onOpenOverrides={() => setIsOverridesModalOpen(true)} />

          {/* Center Command Center: Telemetry + Stadium Pitch */}
          <section className="flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full">
            {/* Top Telemetry Row */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
              {/* Free Transfers */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-2.5 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Free Transfers</span>
                  <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                    {Math.max(0, availableFT - currentTransfers)} / {availableFT}
                  </span>
                </div>
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs">🔄</div>
              </div>

              {/* Bank */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-2.5 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">In The Bank</span>
                  <span className="text-sm sm:text-base font-black text-white font-mono">{formatMoney(bank)}</span>
                </div>
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs">💰</div>
              </div>

              {/* Forecast xP */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-2.5 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {showAiPredictions ? 'GW Projected xP' : 'Projected Form'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-cyan-400 font-mono">
                    {showAiPredictions ? `${totalProjectedXp} pts` : `${squadFormSum.toFixed(1)} avg`}
                  </span>
                </div>
                <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 text-xs">📈</div>
              </div>

              {/* Active Strategy / Chips */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-2.5 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Strategy</span>
                  <span className="text-xs font-black text-slate-200 uppercase truncate block">
                    {currentChip && currentChip !== 'none' ? `${currentChip}` : 'No Chip Active'}
                  </span>
                </div>
                <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-400 text-xs">⚡</div>
              </div>
            </div>

            {/* Stadium Pitch */}
            <div className="w-full flex-1 min-h-0 flex flex-col items-center">
              <FootballPitch />
            </div>

            {/* Mobile Only: Substitutes Bench Bar */}
            <div className="w-full lg:hidden">
              <BenchBar benchPicks={benchPicks} />
            </div>

            {/* Mobile Only: Bottom Strategy Carousel Dock */}
            <div className="w-full lg:hidden">
              <StrategyDock onOpenOverrides={() => setIsOverridesModalOpen(true)} />
            </div>
          </section>

          {/* Right Desktop Panel: Full Vertical Substitutes Bench with Fixtures */}
          <VerticalBenchBar benchPicks={benchPicks} />
        </div>
      ) : (
        <div className="w-[98vw] py-2 flex flex-col items-center animate-in fade-in duration-200">
          <PlayerMatrixView />
        </div>
      )}

      <PlayerMarketDrawer />

      <TeamImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
      />

      <OverridesModal 
        isOpen={isOverridesModalOpen} 
        onClose={() => setIsOverridesModalOpen(false)} 
      />

      <SavePlanModal 
        isOpen={isSaveModalOpen} 
        onClose={() => setIsSaveModalOpen(false)} 
      />

      <AiScoutModal />

      <PlayerDetailModal />
    </main>
  );
}