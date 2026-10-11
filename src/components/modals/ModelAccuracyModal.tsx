"use client";

import React, { useMemo } from "react";
import { usePlannerStore } from "@/store/usePlannerStore";
import { UI_TEXT } from "@/lib/ui-text";
import { calculateSeasonAccuracySummary } from "@/utils/aiCalibrationEngine";
import {
  X,
  Target,
  Trophy,
  Layers,
  ShieldCheck,
} from "lucide-react";

export const ModelAccuracyModal: React.FC = () => {
  const { isAccuracyModalOpen, closeAccuracyModal, auditReports } = usePlannerStore();
  const text = UI_TEXT.accuracyModal;
  const postMortemText = UI_TEXT.mlLab.postMortemSection;

  const seasonAccuracy = useMemo(() => {
    return calculateSeasonAccuracySummary(auditReports || []);
  }, [auditReports]);

  if (!isAccuracyModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900/95 border border-purple-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-purple-950/80 via-slate-900 to-cyan-950/80 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
                <Target className="w-4 h-4 text-purple-400" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {text.title}
              </h2>
              <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {seasonAccuracy.totalFinishedGws} GWs Audited
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">{text.subtitle}</p>
          </div>

          <button
            onClick={closeAccuracyModal}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/10"
            title={text.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* 1. Hero KPI Cards */}
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              {text.seasonHeader}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
              {/* Captain Return Rate */}
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-white/10 space-y-1.5 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                    {postMortemText.captainBenchmarkLabel}
                  </div>
                  <div className="text-2xl font-black text-white mt-1">
                    {seasonAccuracy.captainSuccessRatePct}%
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {seasonAccuracy.captainReturnedCount}/{seasonAccuracy.captainPicksCount} GWs returned
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{postMortemText.captainStandardBadge}</span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      seasonAccuracy.captainSuccessRatePct >= 60
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {seasonAccuracy.captainSuccessRatePct >= 60
                      ? postMortemText.beatingBenchmarkBadge
                      : postMortemText.onParBenchmarkBadge}
                  </span>
                </div>
              </div>

              {/* High-Conviction Return Hit Rate */}
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-white/10 space-y-1.5 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                    {postMortemText.highConvictionLabel}
                  </div>
                  <div className="text-2xl font-black text-cyan-300 mt-1">
                    {seasonAccuracy.highConvictionHitRatePct}%
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {seasonAccuracy.highConvictionReturnedCount}/{seasonAccuracy.highConvictionPicksCount} picks returned
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{postMortemText.highConvictionStandardBadge}</span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      seasonAccuracy.highConvictionHitRatePct >= 50
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {seasonAccuracy.highConvictionHitRatePct >= 50
                      ? postMortemText.beatingBenchmarkBadge
                      : postMortemText.onParBenchmarkBadge}
                  </span>
                </div>
              </div>

              {/* Net Alpha vs FPL GW Average */}
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-white/10 space-y-1.5 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                    {postMortemText.alphaLabel}
                  </div>
                  <div
                    className={`text-2xl font-black mt-1 ${
                      seasonAccuracy.cumulativeAlphaPoints >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {seasonAccuracy.cumulativeAlphaPoints >= 0 ? "+" : ""}
                    {seasonAccuracy.cumulativeAlphaPoints} pts
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {seasonAccuracy.averageAlphaPerGw >= 0 ? "+" : ""}
                    {seasonAccuracy.averageAlphaPerGw} pts/GW delta
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{postMortemText.alphaStandardBadge}</span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      seasonAccuracy.averageAlphaPerGw >= 6.0
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {seasonAccuracy.averageAlphaPerGw >= 6.0
                      ? postMortemText.beatingBenchmarkBadge
                      : postMortemText.onParBenchmarkBadge}
                  </span>
                </div>
              </div>

              {/* Starting Starters MAE */}
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-white/10 space-y-1.5 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                    {postMortemText.startersMaeLabel}
                  </div>
                  <div className="text-2xl font-black text-purple-300 mt-1">
                    {seasonAccuracy.seasonStartersMae} pts
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ρ = {seasonAccuracy.seasonSpearmanRho} rank correlation
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{postMortemText.startersMaeStandardBadge}</span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      seasonAccuracy.seasonStartersMae <= 2.5
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {seasonAccuracy.seasonStartersMae <= 2.5
                      ? postMortemText.beatingBenchmarkBadge
                      : postMortemText.onParBenchmarkBadge}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Gameweek Settlement Timeline */}
          <div className="space-y-3">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              {text.timelineHeader}
            </div>

            <div className="space-y-3 font-mono">
              {auditReports.map((report) => {
                const b = report.benchmark;
                if (!b) return null;
                return (
                  <div
                    key={report.id}
                    className="bg-slate-950/80 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-purple-500/40"
                  >
                    {/* Left: GW & Captain */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-black px-2.5 py-0.5 rounded-lg">
                          GW{report.gw}
                        </span>
                        <span className="text-xs font-bold text-white">
                          (C) {b.captain.playerName} ({b.captain.teamShort})
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            b.captain.returned
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          }`}
                        >
                          {b.captain.returned ? postMortemText.captainReturnedBadge : postMortemText.captainBlankedBadge}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Projected: {b.captain.predictedXp} xP → Realized:{" "}
                        <strong className="text-white">{b.captain.actualPoints} pts</strong>
                      </div>
                    </div>

                    {/* Middle: High Conviction Hit Rate */}
                    <div className="text-xs space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase block">{text.colHighConviction}</span>
                      <div className="font-bold text-cyan-300">{b.highConviction.hitRatePct}% Hit Rate</div>
                      <div className="text-[11px] text-slate-400">
                        {b.highConviction.returnedCount}/{b.highConviction.totalCount} returned ≥5 pts
                      </div>
                    </div>

                    {/* Right: AI XI vs FPL Avg */}
                    <div className="flex items-center justify-between md:justify-end gap-3 text-xs">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase block">{text.colAiXi}</span>
                        <div className="font-black text-white">{b.alphaComparison.aiOptimalXiPoints} pts</div>
                        <div className="text-[10.5px] text-slate-400">
                          Avg: {b.alphaComparison.officialAveragePoints} pts
                        </div>
                      </div>
                      <div
                        className={`text-xs font-black px-2.5 py-1 rounded-xl border ${
                          b.alphaComparison.alphaDelta >= 0
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        }`}
                      >
                        {b.alphaComparison.alphaDelta >= 0 ? "+" : ""}
                        {b.alphaComparison.alphaDelta} pts
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Reliability & Calibration Tiers (from latest completed report) */}
          {auditReports.length > 0 && auditReports[0].benchmark && (
            <div className="space-y-3 bg-purple-950/20 border border-purple-500/30 rounded-2xl p-4 sm:p-5">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  {text.calibrationHeader}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">{text.calibrationDesc}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                {auditReports[0].benchmark.calibrationBins.map((bin) => (
                  <div key={bin.binLabel} className="bg-slate-950/80 p-3 rounded-xl border border-white/10 space-y-1">
                    <div className="text-[11px] font-bold text-slate-300">{bin.binLabel}</div>
                    <div className="text-sm font-black text-white">
                      {bin.meanPredictedXp} xP → <span className="text-cyan-300">{bin.meanActualPoints} pts</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Sample: {bin.playerCount} players</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
