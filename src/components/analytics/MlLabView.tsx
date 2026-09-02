"use client";

import React, { useState, useMemo, useEffect } from "react";
import { usePlannerStore } from "@/store/usePlannerStore";
import { UI_TEXT } from "@/lib/ui-text";
import {
  evaluateExperimentalArms,
  calculateUpcomingDivergences,
} from "@/utils/aiExperimentalEngine";
import {
  Sparkles,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  EyeOff,
  Layers,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  FileText,
  RotateCcw,
  Sliders,
  Check,
} from "lucide-react";

export const MlLabView: React.FC = () => {
  const {
    setCurrentView,
    players,
    events,
    teams,
    liveEventPoints,
    selectedGameweek,
    getPlayerGameweekXp,
    auditReports,
    approveAuditCalibration,
    revertCalibrationToBaseline,
    showAiPredictions,
  } = usePlannerStore();
  const [activeTab, setActiveTab] = useState<
    "arms" | "divergences" | "postMortem" | "architecture"
  >("arms");
  const labText = UI_TEXT.mlLab;

  useEffect(() => {
    if (!showAiPredictions) {
      setCurrentView("pitch");
    }
  }, [showAiPredictions, setCurrentView]);

  // 1. Multi-Armed Factorial Experimental Suite (Dynamic Out-of-Sample Shootout)
  const experimentalArms = useMemo(() => {
    return evaluateExperimentalArms(
      players,
      events,
      liveEventPoints,
      getPlayerGameweekXp
    );
  }, [players, events, liveEventPoints, getPlayerGameweekXp]);

  // 2. High-Conviction Model Disagreements for Selected Gameweek (Dynamic prodXp vs shadowXp)
  const divergences = useMemo(() => {
    return calculateUpcomingDivergences(
      players,
      selectedGameweek,
      getPlayerGameweekXp,
      teams
    );
  }, [players, selectedGameweek, getPlayerGameweekXp, teams]);

  const exitLab = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("vibes_lab_mode");
    }
    setCurrentView("pitch");
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
                {labText.bannerTag}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10.5px] font-black px-2 py-0.5 rounded-full font-mono">
                {labText.activeArmsBadge(experimentalArms.length)}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              🧪 {labText.title}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              {labText.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exitLab}
              className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/15 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Lock and hide ML Lab"
            >
              <EyeOff className="w-3.5 h-3.5" /> {labText.exitLab}
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-5 border-t border-white/10 pt-4">
          <button
            onClick={() => setActiveTab("arms")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === "arms"
                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {labText.tabs.arms}
          </button>
          <button
            onClick={() => setActiveTab("divergences")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === "divergences"
                ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 font-extrabold"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {labText.tabs.divergences}
          </button>
          <button
            onClick={() => setActiveTab("postMortem")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === "postMortem"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 font-extrabold"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {labText.tabs.postMortem}
          </button>
          <button
            onClick={() => setActiveTab("architecture")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === "architecture"
                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-extrabold"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {labText.tabs.architecture}
          </button>
        </div>
      </div>

      {/* 2. TAB: Experimental Arms */}
      {activeTab === "arms" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {experimentalArms.map((arm) => (
              <div
                key={arm.id}
                className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-3 hover:border-purple-500/40 transition-all shadow-lg group"
                title={`${arm.name}: ${arm.hypothesis}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white flex items-center gap-2">
                    <span className="text-lg">{arm.icon}</span> {arm.name}
                  </span>
                  {(() => {
                    const edgeVal = parseFloat(arm.edgePct.replace("% edge", "").trim());
                    const isPositive = edgeVal >= 2.0;
                    const isNeutral = edgeVal >= 0 && edgeVal < 2.0;
                    const badgeClass = isPositive
                      ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/40"
                      : isNeutral
                      ? "bg-amber-950/90 text-amber-300 border-amber-500/40"
                      : "bg-rose-950/90 text-rose-300 border-rose-500/40";
                    return (
                      <span
                        className={`text-[13.5px] font-black border px-3 py-0.5 rounded-full font-mono tracking-tight shadow-sm shrink-0 cursor-help ${badgeClass}`}
                        title={labText.tooltips.edge}
                      >
                        {arm.edgePct}
                      </span>
                    );
                  })()}
                </div>

                <div
                  className="flex items-start gap-1.5 cursor-help"
                  title={labText.tooltips.hypothesis}
                >
                  <HelpCircle className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-300 leading-tight">
                    {arm.hypothesis}
                  </p>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-1 font-mono text-xs">
                  <div
                    className="flex justify-between text-slate-400 cursor-help"
                    title={labText.tooltips.testedScope}
                  >
                    <span>{labText.armsSection.testedScope}</span>
                    <span className="text-slate-200 font-bold">
                      {arm.testedPlayers}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>Sample Power</span>
                    <span className="text-purple-300/80 font-mono">Calibrating (GW1-2)</span>
                  </div>
                  <div
                    className="flex justify-between text-slate-400 cursor-help"
                    title={labText.tooltips.mae}
                  >
                    <span>{labText.armsSection.armMaeVsProd}</span>
                    <span className="text-purple-300 font-bold">
                      {arm.currentMae} {arm.unit} vs {arm.baselineMae} {arm.unit}
                    </span>
                  </div>
                </div>

                <div
                  className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono cursor-help"
                  title={labText.tooltips.leadIndicator}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">{arm.leadIndicator}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. TAB: GW3 Divergences */}
      {activeTab === "divergences" && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />{" "}
              {labText.divergencesSection.title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {labText.divergencesSection.subtitle}
            </p>
          </div>

          <div className="divide-y divide-white/10">
            {divergences.map((p) => {
              const isPositive = p.diff.startsWith("+");
              return (
                <div
                  key={p.name}
                  className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                  title={`${p.name} (${p.team}): ${p.driver}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-black text-xs flex items-center justify-center border border-purple-500/30 font-mono">
                      {p.team}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {p.name}{" "}
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({p.pos})
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">{p.driver}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div
                      className="text-right font-mono cursor-help"
                      title={labText.tooltips.divergence}
                    >
                      <span className="text-[10px] text-slate-400 block">
                        {labText.divergencesSection.prodVsExp}
                      </span>
                      <span className="text-xs text-slate-300 font-bold">
                        {p.prodXp} xP
                      </span>
                      <span className="text-slate-500 mx-1">→</span>
                      <span className="text-xs text-purple-300 font-black">
                        {p.shadowXp} xP
                      </span>
                    </div>

                    <div
                      className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono flex items-center gap-0.5 ${
                        isPositive
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                          : "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                      }`}
                      title={`${p.diff} xP divergence from baseline projection`}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {p.diff} xP
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. TAB: Post-Mortem Audits & Auto-Calibration */}
      {activeTab === "postMortem" && (
        <div className="space-y-6">
          <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  {labText.postMortemSection.title}
                </h2>
                <p className="text-xs text-slate-300 max-w-3xl mt-0.5">
                  {labText.postMortemSection.subtitle}
                </p>
              </div>
              <button
                onClick={() => revertCalibrationToBaseline()}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                {labText.postMortemSection.revertButton}
              </button>
            </div>
          </div>

          {/* List of Reports: Latest always on top */}
          {auditReports.length === 0 ? (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-8 text-center text-slate-400 text-xs font-mono">
              {labText.postMortemSection.noReportsNotice}
            </div>
          ) : (
            auditReports.map((report) => {
              const isApplied = report.status === "applied";
              return (
                <div
                  key={report.id}
                  className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 transition-all hover:border-amber-500/40"
                >
                  {/* Report Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white">
                          📄 Gameweek {report.gw} Post-Mortem Audit
                        </span>
                        <span
                          className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono border ${
                            isApplied
                              ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/50"
                              : "bg-amber-950/90 text-amber-300 border-amber-500/50"
                          }`}
                        >
                          {isApplied
                            ? labText.postMortemSection.appliedBadge
                            : labText.postMortemSection.stagedBadge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Settled Slate: {report.matchCount} Matches · Finalized on {report.finalizedAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => approveAuditCalibration(report.gw)}
                        disabled={isApplied}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-lg ${
                          isApplied
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default"
                            : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 cursor-pointer"
                        }`}
                      >
                        {isApplied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            {labText.postMortemSection.appliedBadge}
                          </>
                        ) : (
                          <>
                            <Sliders className="w-3.5 h-3.5" />
                            {labText.postMortemSection.approveButton}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Accuracy Scorecard */}
                  <div className="space-y-2">
                    <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      {labText.postMortemSection.accuracyScorecard}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                      <div className="bg-slate-950/70 p-3 rounded-2xl border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-400 uppercase">{labText.postMortemSection.overallMaeLabel}</span>
                        <div className="text-base font-black text-white">{report.accuracy.overallMae} pts</div>
                      </div>
                      <div className="bg-slate-950/70 p-3 rounded-2xl border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-400 uppercase">{labText.postMortemSection.correlationLabel}</span>
                        <div className="text-base font-black text-cyan-300">r = {report.accuracy.correlation}</div>
                      </div>
                      <div className="bg-slate-950/70 p-3 rounded-2xl border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-400 uppercase">{labText.postMortemSection.minutesMaeLabel}</span>
                        <div className="text-base font-black text-purple-300">{report.accuracy.minutesMae} min</div>
                      </div>
                      <div className="bg-slate-950/70 p-3 rounded-2xl border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-400 uppercase">Positional MAEs</span>
                        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mt-1">
                          <span>GK {report.accuracy.gkpMae}</span>
                          <span>·</span>
                          <span>DF {report.accuracy.defMae}</span>
                          <span>·</span>
                          <span>MD {report.accuracy.midMae}</span>
                          <span>·</span>
                          <span>FW {report.accuracy.fwdMae}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Outliers Spotlight */}
                  <div className="space-y-2">
                    <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">
                      {labText.postMortemSection.outliersTitle}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Overperformers */}
                      <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-emerald-500/20 space-y-2">
                        <div className="text-xs font-black text-emerald-400 font-mono flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          {labText.postMortemSection.overperformedTitle}
                        </div>
                        <div className="space-y-1.5">
                          {report.outliers.overperformed.map((o) => (
                            <div key={o.playerId} className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-xl">
                              <span className="font-bold text-white">
                                {o.playerName} <span className="text-[10px] text-slate-400 font-mono">({o.teamShort} · {o.position})</span>
                              </span>
                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-slate-400">{o.predictedXp} xP → {o.actualPoints} pts</span>
                                <span className="text-emerald-400 font-black">+{o.residual} pts</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Underperformers */}
                      <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-rose-500/20 space-y-2">
                        <div className="text-xs font-black text-rose-400 font-mono flex items-center gap-1">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          {labText.postMortemSection.underperformedTitle}
                        </div>
                        <div className="space-y-1.5">
                          {report.outliers.underperformed.map((o) => (
                            <div key={o.playerId} className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-xl">
                              <span className="font-bold text-white">
                                {o.playerName} <span className="text-[10px] text-slate-400 font-mono">({o.teamShort} · {o.position})</span>
                              </span>
                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-slate-400">{o.predictedXp} xP → {o.actualPoints} pts</span>
                                <span className="text-rose-400 font-black">{o.residual} pts</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Guardrailed Multi-Formula Calibrations */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-amber-400" />
                        {labText.postMortemSection.calibrationsTitle}
                      </div>
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {labText.postMortemSection.guardrailPassed}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {report.calibrations.map((cal) => (
                        <div key={cal.id} className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 space-y-1.5 font-mono text-xs">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-white text-[11px] leading-tight">{cal.modelName}</span>
                            <span className="text-[10.5px] font-black text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                              {cal.driftPct}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{cal.parameterName}</div>
                          <div className="flex justify-between items-center text-[11px] pt-0.5 border-t border-white/5">
                            <span className="text-slate-500">Proposed Shift:</span>
                            <span className="font-black text-slate-200">
                              {cal.baselineValue}{cal.unit} → <span className="text-amber-300 font-bold">{cal.proposedValue}{cal.unit}</span>
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[9.5px] text-slate-500">
                            <span>Safe Envelope:</span>
                            <span>[{cal.safeMin}, {cal.safeMax}] {cal.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. TAB: Architecture */}
      {activeTab === "architecture" && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />{" "}
            {labText.architectureSection.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {labText.architectureSection.description}
          </p>
        </div>
      )}
    </div>
  );
};
