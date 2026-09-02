"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { usePlannerStore } from "@/store/usePlannerStore";
import { FootballPitch } from "@/components/pitch/FootballPitch";
import { BenchBar } from "@/components/pitch/BenchBar";
import { VerticalBenchBar } from "@/components/pitch/VerticalBenchBar";
import { StrategyDock } from "@/components/planning/StrategyDock";
import { LeftStrategyPanel } from "@/components/planning/LeftStrategyPanel";
import { PlayerMarketDrawer } from "@/components/market/PlayerMarketDrawer";
import { TeamImportModal } from "@/components/ui/TeamImportModal";
import { OverridesModal } from "@/components/ui/OverridesModal";
import { SavePlanModal } from "@/components/ui/SavePlanModal";
import { PinAuthModal } from "@/components/ui/PinAuthModal";
import { AiScoutModal } from "@/components/modals/AiScoutModal";
import { MobileMenuDrawer } from "@/components/modals/MobileMenuDrawer";
import { PlayerMatrixView } from "@/components/matrix/PlayerMatrixView";
import { LineupRiskRadar } from "@/components/planning/LineupRiskRadar";
import { AiPerformanceView } from "@/components/analytics/AiPerformanceView";
import { MlLabView } from "@/components/analytics/MlLabView";
import { PlayerDetailModal } from "@/components/player/PlayerDetailModal";
import { logoutPin, isPinVerified } from "@/lib/auth";
import { formatMoney } from "@/lib/fpl-rules";
import { useSquadTelemetry } from "@/hooks/useSquadTelemetry";
import { UI_TEXT } from "@/lib/ui-text";
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
  ChevronDown,
  Check,
  LayoutGrid,
  TableProperties,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Menu,
} from "lucide-react";

export default function PlannerPage() {
  const {
    initFPLData,
    teamSummary,
    selectedGameweek,
    selectGameweek,
    isGameweekLocked,
    gameweekPlans,
    showAiPredictions,
    currentView,
    setCurrentView,
    openTransferDrawer,
    activePin,
    isSaving,
    events,
    fetchLivePointsForGameweek,
    auditReports,
    lastSeenAuditGw,
  } = usePlannerStore();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isOverridesModalOpen, setIsOverridesModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLabUnlocked, setIsLabUnlocked] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isViewMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        viewMenuRef.current &&
        !viewMenuRef.current.contains(e.target as Node)
      ) {
        setIsViewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isViewMenuOpen]);

  useEffect(() => {
    initFPLData();
    setIsAuthenticated(isPinVerified());

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const isLabParam =
        urlParams.get("lab") === "1" ||
        urlParams.get("lab") === "true" ||
        urlParams.get("ml") === "true";
      const isStored = localStorage.getItem("vibes_lab_mode") === "true";

      if (isLabParam) {
        localStorage.setItem("vibes_lab_mode", "true");
        setIsLabUnlocked(true);
        setCurrentView("lab");
      } else if (isStored) {
        setIsLabUnlocked(true);
      }
    }
  }, [initFPLData, setCurrentView]);

  // Smart in-view live match poller (every 60s when viewing an ongoing gameweek)
  useEffect(() => {
    const currentEvent = events.find((e) => e.is_current);
    const isViewingOngoingGw =
      currentEvent &&
      selectedGameweek === currentEvent.id &&
      !currentEvent.finished;
    if (!isViewingOngoingGw) return;

    const interval = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        fetchLivePointsForGameweek(selectedGameweek, true);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [selectedGameweek, events, fetchLivePointsForGameweek]);

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
    ? currentPlan.squad
        .filter((p) => p.position > 11)
        .sort((a, b) => a.position - b.position)
    : [];
  const isLocked = isGameweekLocked(selectedGameweek);

  const {
    totalProjectedXp,
    gameweekActualPoints,
    squadFormSum,
    bank,
    availableFT,
    currentTransfers,
    currentChip,
    squadRating,
  } = useSquadTelemetry();

  const hasUnreadAudit = useMemo(() => {
    return (
      Boolean(auditReports && auditReports.length > 0) &&
      auditReports[0].gw > lastSeenAuditGw
    );
  }, [auditReports, lastSeenAuditGw]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center">
      {!isAuthenticated && <PinAuthModal onSuccess={handleAuthSuccess} />}

      {/* Top Navigation Header with Centered Gameweek Stepper & View Switcher */}
      <header className="w-full bg-slate-950/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-50 px-2 sm:px-4 py-1.5 flex justify-center overflow-visible">
        <div className="w-full max-w-[99vw] flex items-center justify-between gap-1 sm:gap-3 overflow-visible">
          {/* Left: Brand & View Switcher Hamburger */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950/50 shrink-0">
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>

            {/* Brand Title */}
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-white tracking-tight leading-tight">
                  <span className="hidden sm:inline">FPL Squad </span>Planner
                </h1>
                <span className="hidden sm:inline text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1 py-0.2 rounded border border-emerald-500/30">
                  {UI_TEXT.app.season}
                </span>
              </div>
              {teamSummary ? (
                <p className="hidden sm:block text-[10.5px] text-slate-400 truncate max-w-[130px] sm:max-w-[200px] leading-tight">
                  {teamSummary.name}
                </p>
              ) : (
                <p className="hidden sm:block text-[10.5px] text-slate-400 leading-tight">
                  {UI_TEXT.app.enterPinOrImport}
                </p>
              )}
            </div>

            {/* View Switcher Hamburger Menu next to Page Name */}
            <div className="relative" ref={viewMenuRef}>
              <button
                onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                className={`relative p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-black transition-all flex items-center gap-1.5 ${
                  isViewMenuOpen
                    ? "bg-slate-800 text-white border-white/25 shadow-lg"
                    : "bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-white/10 hover:border-white/20"
                }`}
                title="Switch Workspace View"
              >
                <Menu className="w-4 h-4 text-emerald-400" />
                <span className="hidden md:inline font-bold text-[11.5px] capitalize">
                  {currentView === "pitch"
                    ? UI_TEXT.app.views.pitch
                    : currentView === "matrix"
                      ? UI_TEXT.app.views.matrix
                      : currentView === "rotation"
                        ? UI_TEXT.app.views.rotation
                        : currentView === "analytics"
                          ? UI_TEXT.app.views.analytics
                          : "ML Lab"}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform ${
                    isViewMenuOpen ? "rotate-180" : ""
                  }`}
                />
                {hasUnreadAudit && (
                  <span
                    className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
                    title="New unread Post-Mortem audit report"
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-slate-950"></span>
                  </span>
                )}
              </button>

              {/* Dropdown Menu Popover */}
              {isViewMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[90] bg-transparent"
                    onClick={() => setIsViewMenuOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono border-b border-white/10">
                    Switch Workspace View
                  </div>

                  <button
                    onClick={() => {
                      setCurrentView("pitch");
                      setIsViewMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      currentView === "pitch"
                        ? "bg-emerald-600 text-white shadow-md"
                        : "text-slate-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-emerald-400" />
                      <span>{UI_TEXT.app.views.pitch}</span>
                    </div>
                    {currentView === "pitch" && (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setCurrentView("matrix");
                      setIsViewMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      currentView === "matrix"
                        ? "bg-emerald-600 text-white shadow-md"
                        : "text-slate-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TableProperties className="w-4 h-4 text-emerald-400" />
                      <span>{UI_TEXT.app.views.matrix}</span>
                    </div>
                    {currentView === "matrix" && (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setCurrentView("rotation");
                      setIsViewMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      currentView === "rotation"
                        ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
                        : "text-slate-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>{UI_TEXT.app.views.rotation}</span>
                    </div>
                    {currentView === "rotation" && (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setCurrentView("analytics");
                      setIsViewMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      currentView === "analytics"
                        ? "bg-emerald-600 text-white shadow-md"
                        : "text-slate-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>{UI_TEXT.app.views.analytics}</span>
                    </div>
                    {currentView === "analytics" && (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {isLabUnlocked && showAiPredictions && (
                    <button
                      onClick={() => {
                        setCurrentView("lab");
                        setIsViewMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-black transition-all ${
                        currentView === "lab"
                          ? "bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/30"
                          : "text-purple-300 hover:text-white hover:bg-purple-950/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span>ML Lab</span>
                        {hasUnreadAudit && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                        )}
                      </div>
                      {currentView === "lab" && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

          {/* Center: Gameweek Arrow Stepper ONLY (Strictly Centered) */}
          <div className="flex-1 flex items-center justify-center">
            <div
              className={`flex items-center bg-slate-900/90 border border-white/10 rounded-2xl p-0.5 sm:p-1 shadow-inner transition-all ${
                currentView !== "pitch"
                  ? "opacity-35 pointer-events-none select-none"
                  : ""
              }`}
            >
              <button
                disabled={currentView !== "pitch" || selectedGameweek <= 1}
                onClick={() => selectGameweek(selectedGameweek - 1)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title={
                  currentView !== "pitch"
                    ? UI_TEXT.gameweekStepper.matrixDisabledTooltip
                    : UI_TEXT.gameweekStepper.prevTooltip
                }
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-2 sm:px-3 text-center min-w-[70px] sm:min-w-[90px]">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider font-mono">
                    {UI_TEXT.gameweekStepper.gwLabel(selectedGameweek)}
                  </span>
                  {isLocked && <Lock className="w-3 h-3 text-amber-400" />}
                </div>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono block leading-none">
                  {currentView === "matrix"
                    ? UI_TEXT.gameweekStepper.global
                    : currentView === "analytics"
                      ? "All-Time"
                      : isLocked
                        ? UI_TEXT.gameweekStepper.completed
                        : UI_TEXT.gameweekStepper.planned}
                </span>
              </div>

              <button
                disabled={currentView !== "pitch" || selectedGameweek >= 38}
                onClick={() => selectGameweek(selectedGameweek + 1)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title={
                  currentView !== "pitch"
                    ? UI_TEXT.gameweekStepper.matrixDisabledTooltip
                    : UI_TEXT.gameweekStepper.nextTooltip
                }
              >
                <ChevronRight className="w-4 h-4" />
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
                    <span>
                      PIN:{" "}
                      <strong className="font-mono text-white">
                        {activePin}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="hidden sm:flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 transition-colors"
              title="Import FPL Team"
            >
              <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span>Import</span>
            </button>

            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="hidden sm:flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 transition-colors"
              title="Saved Plans"
            >
              <Save className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
              <span>Plans</span>
            </button>

            {!isLocked && (
              <button
                onClick={() => openTransferDrawer()}
                className="flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Transfers</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="hidden sm:flex p-1 sm:p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 border border-white/10 transition-colors"
              title="Lock / Switch PIN"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>

            {/* Mobile Menu Drawer Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1 sm:p-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-black flex items-center justify-center gap-1 transition-all active:scale-95"
              title="Open Strategy & Tools Menu"
            >
              <Menu className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] font-black hidden xs:inline">
                Menu
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Visual Pitch View vs Stats Matrix View */}
      {currentView === "pitch" ? (
        <div className="w-full max-w-full lg:max-w-[99vw] px-1 sm:px-2 py-1.5 flex flex-col lg:flex-row items-stretch justify-center gap-2.5 lg:h-[calc(100vh-62px)] lg:overflow-hidden animate-in fade-in duration-200">
          {/* Left Desktop Panel: Chips, AI Radar, Horizon, Optimizer & Overrides */}
          <LeftStrategyPanel
            onOpenOverrides={() => setIsOverridesModalOpen(true)}
          />

          {/* Center Column: Telemetry Header, Stadium Pitch & Mobile Bench */}
          <section className="flex-1 flex flex-col items-center justify-between gap-1.5 min-w-0 max-w-full lg:h-full lg:overflow-hidden">
            {/* 1. Mobile-Only Compact Telemetry Strip */}
            <div className="w-full flex sm:hidden items-center justify-between px-3 py-1.5 bg-slate-900/90 border border-white/10 rounded-2xl text-[11px] font-mono shadow-md">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-bold font-sans">FT:</span>
                <strong className="text-emerald-400">
                  {Math.max(0, availableFT - currentTransfers)}/{availableFT}
                </strong>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-bold font-sans">
                  Bank:
                </span>
                <strong className="text-emerald-300">
                  {formatMoney(bank)}
                </strong>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-bold font-sans">xP:</span>
                <strong className="text-cyan-300">
                  {showAiPredictions
                    ? `${totalProjectedXp}`
                    : `${squadFormSum.toFixed(1)}`}
                </strong>
                {gameweekActualPoints !== null && (
                  <span className="text-[10px] text-emerald-400 font-bold">
                    ({gameweekActualPoints} pts)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 font-sans">
                <span className="text-slate-400 font-bold">Chip:</span>
                <strong className="text-purple-300 uppercase text-[10px]">
                  {currentChip !== "none" ? currentChip : "None"}
                </strong>
              </div>
            </div>

            {/* 2. Desktop-Only 4 Large Telemetry Cards */}
            <div className="hidden sm:grid w-full grid-cols-4 gap-2 flex-shrink-0">
              {/* Free Transfers */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[11px] sm:text-xs xl:text-sm font-bold text-slate-400 uppercase tracking-wider block">
                    {UI_TEXT.telemetry.freeTransfers}
                  </span>
                  <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-emerald-400 font-mono">
                    {Math.max(0, availableFT - currentTransfers)} /{" "}
                    {availableFT}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm sm:text-base">
                  🔄
                </div>
              </div>

              {/* Bank */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[11px] sm:text-xs xl:text-sm font-bold text-slate-400 uppercase tracking-wider block">
                    {UI_TEXT.telemetry.inTheBank}
                  </span>
                  <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-white font-mono">
                    {formatMoney(bank)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm sm:text-base">
                  💰
                </div>
              </div>

              {/* Forecast xP & Gameweek Points Card */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-lg">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] sm:text-xs xl:text-sm font-bold text-slate-400 uppercase tracking-wider block">
                      {showAiPredictions
                        ? UI_TEXT.telemetry.gwProjectedXp
                        : UI_TEXT.telemetry.projectedForm}
                    </span>
                    {showAiPredictions && squadRating && (
                      <span className="text-[10px] xl:text-[11px] font-black text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded-md border border-emerald-500/40 font-mono">
                        {UI_TEXT.telemetry.ratingBadge(
                          squadRating.overallPercentage,
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-cyan-400 font-mono">
                      {showAiPredictions
                        ? `${totalProjectedXp} ${UI_TEXT.common.pointsShort}`
                        : `${squadFormSum.toFixed(1)} ${UI_TEXT.common.avg}`}
                    </span>
                    {isLocked && gameweekActualPoints !== null ? (
                      <span className="text-[10.5px] xl:text-[11.5px] font-bold text-emerald-400 font-mono">
                        {UI_TEXT.telemetry.actualScoreBadge(
                          gameweekActualPoints,
                        )}
                      </span>
                    ) : showAiPredictions && squadRating ? (
                      <span className="text-[10px] text-slate-400 font-mono hidden 2xl:inline">
                        {UI_TEXT.telemetry.detailedRating(
                          squadRating.defensePercentage,
                          squadRating.midfieldPercentage,
                          squadRating.forwardPercentage,
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 text-sm sm:text-base">
                  📈
                </div>
              </div>

              {/* Active Strategy / Chips */}
              <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[11px] sm:text-xs xl:text-sm font-bold text-slate-400 uppercase tracking-wider block">
                    {UI_TEXT.telemetry.strategy}
                  </span>
                  <span className="text-xs sm:text-sm lg:text-base font-black text-slate-200 uppercase truncate block">
                    {currentChip && currentChip !== "none"
                      ? `${currentChip}`
                      : UI_TEXT.telemetry.noChipActive}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 text-sm sm:text-base">
                  ⚡
                </div>
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
              <StrategyDock
                onOpenOverrides={() => setIsOverridesModalOpen(true)}
              />
            </div>
          </section>

          {/* Right Desktop Panel: Vertical Substitutes Bench */}
          <aside className="hidden lg:flex flex-col w-48 xl:w-56 2xl:w-64 flex-shrink-0 lg:h-full lg:overflow-hidden select-none">
            <VerticalBenchBar benchPicks={benchPicks} />
          </aside>
        </div>
      ) : currentView === "matrix" ? (
        /* Player Projections & Metrics Matrix View */
        <div className="w-full max-w-[99vw] flex justify-center px-2 sm:px-4 py-2 animate-in fade-in duration-200">
          <PlayerMatrixView />
        </div>
      ) : currentView === "rotation" ? (
        /* Pre-Deadline Lineup & Rotation Risk Radar View */
        <div className="w-full max-w-[99vw] flex justify-center px-2 sm:px-4 py-3 animate-in fade-in duration-200">
          <LineupRiskRadar />
        </div>
      ) : currentView === "lab" ? (
        /* Private Quantitative ML Lab & A/B Shootout View */
        <div className="w-full max-w-[99vw] flex justify-center px-2 sm:px-4 py-3 animate-in fade-in duration-200">
          <MlLabView />
        </div>
      ) : (
        /* AI Performance & Backtesting View */
        <div className="w-full max-w-[99vw] flex justify-center px-2 sm:px-4 py-3 animate-in fade-in duration-200">
          <AiPerformanceView />
        </div>
      )}

      {/* Global Drawers & Modals */}
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
      <MobileMenuDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenImport={() => {
          setIsMobileMenuOpen(false);
          setIsImportModalOpen(true);
        }}
        onOpenSave={() => {
          setIsMobileMenuOpen(false);
          setIsSaveModalOpen(true);
        }}
        onOpenOverrides={() => {
          setIsMobileMenuOpen(false);
          setIsOverridesModalOpen(true);
        }}
        onLogout={() => {
          setIsMobileMenuOpen(false);
          handleLogout();
        }}
      />
    </main>
  );
}
