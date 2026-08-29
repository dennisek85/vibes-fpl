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
import { calculateSquadRating } from '@/utils/aiSquadRating';
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
  TrendingUp,
  Gauge
} from 'lucide-react';

export default function PlannerPage() {
  const { 
    initFPLData, 
    teamSummary, 
    isLoading, 
    error,
    selectedGameweek,
    selectGameweek,
    isGameweekLocked,
    gameweekPlans,
    players,
    playerMap,
    currentView,
    setCurrentView,
    getPlayerGameweekXp,
    showAiPredictions,
    toggleAiPredictions,
    openTransferDrawer, 
    activePin, 
    isSaving, 
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
      const xp = getPlayerGameweekXp(pick.element, selectedGameweek);

      if (isStarting) {
        let mult = 1;
        if (pick.is_captain) {
          mult = isTripleCaptain ? 3 : 2;
        }
        totalProjectedXp += xp * mult;
        if (pl) squadFormSum += parseFloat(pl.form) || 0;
      } else if (isBenchBoost) {
        // Full bench boost: all 4 subs count 100%
        totalProjectedXp += xp;
      } else {
        // Auto-sub expected value (contingency if starter rests)
        const subWeight = pick.position === 12 ? 0.03 : pick.position === 13 ? 0.12 : pick.position === 14 ? 0.06 : 0.02;
        totalProjectedXp += xp * subWeight;
      }
    });
  }
  totalProjectedXp = Math.round((totalProjectedXp - hits) * 10) / 10;

  const squadRating = React.useMemo(() => {
    if (!showAiPredictions || !currentPlan?.squad || currentPlan.squad.length === 0) return null;
    const currentVal = currentPlan.squad.reduce((s, p) => s + (playerMap.get(p.element)?.now_cost || 0), 0);
    const totalBudg = currentVal + (currentPlan.calculatedBank || 0);

    return calculateSquadRating(
      currentPlan.squad,
      players,
      playerMap,
      selectedGameweek,
      getPlayerGameweekXp,
      fixtureHorizon,
      totalBudg
    );
  }, [showAiPredictions, currentPlan?.squad, currentPlan?.calculatedBank, players, playerMap, selectedGameweek, getPlayerGameweekXp, fixtureHorizon]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center">
      {!isAuthenticated && (
        <PinAuthModal onSuccess={handleAuthSuccess} />
      )}

      {/* Top Navigation Header with Centered Gameweek Stepper & View Switcher */}
      <header className="w-full bg-slate-950/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-40 px-2 sm:px-4 py-1.5 flex justify-center overflow-x-hidden">
        <div className="w-full max-w-[99vw] flex items-center justify-between gap-1 sm:gap-3">
          {/* Left: Brand & Team */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950/50">
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-white tracking-tight leading-tight">
                  <span className="hidden sm:inline">FPL Squad </span>Planner
                </h1>
                <span className="hidden sm:inline text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1 py-0.2 rounded border border-emerald-500/30">
                  26/27
                </span>
              </div>
              {teamSummary ? (
                <p className="hidden sm:block text-[10.5px] text-slate-400 truncate max-w-[130px] sm:max-w-[240px] leading-tight">
                  {teamSummary.name} · <span className="text-slate-300">{teamSummary.player_first_name} {teamSummary.player_last_name}</span>
                </p>
              ) : (
                <p className="hidden sm:block text-[10.5px] text-slate-400 leading-tight">Enter PIN or Import Team</p>
              )}
            </div>
          </div>

          {/* Center: Gameweek Arrow Stepper & View Switcher */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Gameweek Stepper */}
            <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-900/90 border border-white/15 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-xl sm:rounded-2xl shadow-lg">
              <button
                disabled={selectedGameweek <= 1}
                onClick={() => selectGameweek(selectedGameweek - 1)}
                className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-slate-200 hover:text-white transition-all active:scale-90"
                title="Previous Gameweek"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <div className="flex items-center gap-1 px-1 sm:px-2 select-none">
                <span className="text-xs sm:text-sm md:text-base font-black text-white tracking-tight">
                  GW {selectedGameweek}
                </span>
                {currentTransfers > 0 && (
                  <span className="text-[9px] bg-emerald-400 text-slate-950 font-black px-1 py-0.2 rounded-full">
                    +{currentTransfers}
                  </span>
                )}
                {currentChip && currentChip !== 'none' && (
                  <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1 py-0.2 rounded-full uppercase">
                    {currentChip === 'wildcard' ? 'WC' : currentChip === 'freehit' ? 'FH' : currentChip === 'bboost' ? 'BB' : '3TC'}
                  </span>
                )}
              </div>

              <button
                disabled={selectedGameweek >= 38}
                onClick={() => selectGameweek(selectedGameweek + 1)}
                className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-slate-200 hover:text-white transition-all active:scale-90"
                title="Next Gameweek"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* View Switcher Toggle Tabs */}
            <div className="flex items-center gap-0.5 bg-slate-900/90 border border-white/15 p-0.5 rounded-xl sm:rounded-2xl shadow-lg">
              <button
                onClick={() => setCurrentView('pitch')}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all ${
                  currentView === 'pitch'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Visual Pitch Planner"
              >
                <LayoutGrid className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden md:inline">Pitch</span>
              </button>
              <button
                onClick={() => setCurrentView('matrix')}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all ${
                  currentView === 'matrix'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Player Projections & Metrics Matrix"
              >
                <TableProperties className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden md:inline">Stats Matrix</span>
              </button>
            </div>
          </div>

          {/* Right: Actions & Sync */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {activePin && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300">
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PIN: <strong className="font-mono text-white">{activePin}</strong></span>
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 transition-colors"
              title="Import FPL Team"
            >
              <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Import</span>
            </button>

            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 transition-colors"
              title="Saved Plans"
            >
              <Save className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Plans</span>
            </button>

            {!isLocked && (
              <button
                onClick={() => openTransferDrawer()}
                className="flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95"
              >
                <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden xs:inline">Transfers</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="p-1 sm:p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 border border-white/10 transition-colors"
              title="Lock / Switch PIN"
            >
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Visual Pitch View vs Stats Matrix View */}
      {currentView === 'pitch' ? (
        <div className="w-full max-w-full lg:max-w-[99vw] px-1 sm:px-2 py-1.5 flex flex-col lg:flex-row items-stretch justify-center gap-2.5 lg:h-[calc(100vh-62px)] lg:overflow-hidden animate-in fade-in duration-200">
          {/* Left Desktop Panel: Chips, AI Radar, Horizon, Optimizer & Overrides */}
          <LeftStrategyPanel onOpenOverrides={() => setIsOverridesModalOpen(true)} />

          {/* Center Command Center: Telemetry + Stadium Pitch */}
          <section className="flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full">
            {/* Top Telemetry Row */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
              {/* Free Transfers */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[11px] sm:text-xs xl:text-sm font-bold text-slate-400 uppercase tracking-wider block">Free Transfers</span>
                  <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-emerald-400 font-mono">
                    {Math.max(0, availableFT - currentTransfers)} / {availableFT}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm sm:text-base">🔄</div>
              </div>

              {/* Bank */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[11px] sm:text-xs xl:text-sm font-bold text-slate-400 uppercase tracking-wider block">In The Bank</span>
                  <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-white font-mono">{formatMoney(bank)}</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm sm:text-base">💰</div>
              </div>

              {/* Forecast xP & Rating */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-lg">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] sm:text-xs xl:text-sm font-bold text-slate-400 uppercase tracking-wider block">
                      {showAiPredictions ? 'GW Projected xP' : 'Projected Form'}
                    </span>
                    {showAiPredictions && squadRating && (
                      <span className="text-[10px] xl:text-[11px] font-black text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded-md border border-emerald-500/40 font-mono">
                        {squadRating.overallPercentage}% Rating
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-cyan-400 font-mono">
                      {showAiPredictions ? `${totalProjectedXp} pts` : `${squadFormSum.toFixed(1)} avg`}
                    </span>
                    {showAiPredictions && squadRating && (
                      <span className="text-[10px] text-slate-400 font-mono hidden 2xl:inline">
                        (D:{squadRating.defensePercentage}% M:{squadRating.midfieldPercentage}% F:{squadRating.forwardPercentage}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 text-sm sm:text-base">📈</div>
              </div>

              {/* Active Strategy / Chips */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[11px] sm:text-xs xl:text-sm font-bold text-slate-400 uppercase tracking-wider block">Strategy</span>
                  <span className="text-xs sm:text-sm lg:text-base font-black text-slate-200 uppercase truncate block">
                    {currentChip && currentChip !== 'none' ? `${currentChip}` : 'No Chip Active'}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 text-sm sm:text-base">⚡</div>
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