"use client";

import React from "react";
import { usePlannerStore } from "@/store/usePlannerStore";
import {
  Search,
  X,
  ChevronDown,
  TrendingUp,
  Flame,
  Zap,
  Snowflake,
  Star,
} from "lucide-react";

const POSITIONS = [
  { id: null, label: "All" },
  { id: 1, label: "GKP" },
  { id: 2, label: "DEF" },
  { id: 3, label: "MID" },
  { id: 4, label: "FWD" },
];

export const MatrixFilterBar: React.FC = () => {
  const {
    teams,
    matrixSearch,
    setMatrixSearch,
    matrixPosition,
    setMatrixPosition,
    matrixTeamId,
    setMatrixTeamId,
    matrixMinPrice,
    matrixMaxPrice,
    setMatrixPriceRange,
    matrixHorizon,
    setMatrixHorizon,
    matrixPer90,
    setMatrixPer90,
    matrixViewTab,
    setMatrixViewTab,
    matrixPriceFilter,
    setMatrixPriceFilter,
    selectedGameweek,
    showAiPredictions,
  } = usePlannerStore();

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(
      155,
      Math.max(matrixMinPrice + 5, Math.round(parseFloat(e.target.value) * 10)),
    );
    setMatrixPriceRange(matrixMinPrice, val);
  };

  const resetFilters = () => {
    setMatrixSearch("");
    setMatrixPosition(null);
    setMatrixTeamId(null);
    setMatrixPriceRange(35, 155);
    setMatrixPriceFilter("all");
  };

  const hasActiveFilters =
    matrixSearch ||
    matrixPosition !== null ||
    matrixTeamId !== null ||
    matrixMinPrice > 35 ||
    matrixMaxPrice < 155 ||
    matrixPriceFilter !== "all";

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-md rounded-3xl border border-white/15 p-4 sm:p-5 shadow-2xl flex flex-col gap-4">
      {/* 1. Topmost Switcher: Stats Matrix vs Price Change Radar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 font-black shadow-md">
            {matrixViewTab === "price_radar" ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              "📊"
            )}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              {matrixViewTab === "price_radar"
                ? "Price Change & Transfer Velocity Radar"
                : "Player Stats & Performance Matrix"}
            </h2>
            <p className="text-[11px] text-slate-400">
              {matrixViewTab === "price_radar"
                ? "Live FPL market momentum & overnight price rise/fall predictions"
                : "Deep underlying metrics, form, and expected points forecasts"}
            </p>
          </div>
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-white/10">
          <button
            onClick={() => setMatrixViewTab("stats")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
              matrixViewTab === "stats"
                ? "bg-slate-800 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📊 Stats &amp; xP
          </button>
          <button
            onClick={() => setMatrixViewTab("price_radar")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
              matrixViewTab === "price_radar"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/60"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🔥 Price Radar
            <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[9px] font-black tracking-wider">
              LIVE
            </span>
          </button>
        </div>
      </div>

      {/* 2. Middle Row: Filters based on active view */}
      {matrixViewTab === "price_radar" ? (
        /* Price Radar Category Pills */
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMatrixPriceFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
              matrixPriceFilter === "all"
                ? "bg-slate-800 text-white shadow-md"
                : "text-slate-400 hover:text-white bg-slate-950 border border-white/5"
            }`}
          >
            All Players
          </button>
          <button
            onClick={() => setMatrixPriceFilter("rising")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
              matrixPriceFilter === "rising"
                ? "bg-emerald-950 border border-emerald-500/60 text-emerald-300 shadow-md"
                : "text-emerald-400 hover:text-emerald-300 bg-slate-950 border border-white/5"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-emerald-400" />
            <span>Rising Tonight (100%+)</span>
          </button>
          <button
            onClick={() => setMatrixPriceFilter("approaching")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
              matrixPriceFilter === "approaching"
                ? "bg-amber-950 border border-amber-500/60 text-amber-300 shadow-md"
                : "text-amber-400 hover:text-amber-300 bg-slate-950 border border-white/5"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Approaching (80-99%)</span>
          </button>
          <button
            onClick={() => setMatrixPriceFilter("falling")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
              matrixPriceFilter === "falling"
                ? "bg-rose-950 border border-rose-500/60 text-rose-300 shadow-md"
                : "text-rose-400 hover:text-rose-300 bg-slate-950 border border-white/5"
            }`}
          >
            <Snowflake className="w-3.5 h-3.5 text-rose-400" />
            <span>Falling Tonight (-100%+)</span>
          </button>
          <button
            onClick={() => setMatrixPriceFilter("squad")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
              matrixPriceFilter === "squad"
                ? "bg-cyan-950 border border-cyan-500/60 text-cyan-300 shadow-md"
                : "text-cyan-400 hover:text-cyan-300 bg-slate-950 border border-white/5"
            }`}
          >
            <Star className="w-3.5 h-3.5 text-cyan-400" />
            <span>My Squad</span>
          </button>
        </div>
      ) : (
        /* Stats Matrix Horizon & Per 90 Controls */
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Position Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-white/10">
            {POSITIONS.map((pos) => (
              <button
                key={pos.label}
                onClick={() => setMatrixPosition(pos.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  matrixPosition === pos.id
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/60 scale-102"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>

          {/* Gameweek Horizon Tabs (Only shown when AI Predictions are active) */}
          {showAiPredictions && (
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-white/10">
              <span className="text-xs font-bold text-slate-400 px-2 hidden sm:inline">
                Projections:
              </span>
              {([1, 3, 5] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setMatrixHorizon(h)}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    matrixHorizon === h
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {h === 1 ? `GW ${selectedGameweek}` : `Next ${h} GWs`}
                </button>
              ))}
            </div>
          )}

          {/* Per-90 vs Total Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setMatrixPer90(false)}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                !matrixPer90
                  ? "bg-slate-800 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Totals
            </button>
            <button
              onClick={() => setMatrixPer90(true)}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                matrixPer90
                  ? "bg-slate-800 text-emerald-300 shadow font-mono"
                  : "text-slate-400 hover:text-white font-mono"
              }`}
            >
              Per 90
            </button>
          </div>
        </div>
      )}

      {/* 3. Bottom Row: Search, Price Slider, Team Dropdown, Clear */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={matrixSearch}
            onChange={(e) => setMatrixSearch(e.target.value)}
            placeholder="Search by player or club..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-950 border border-white/10 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {matrixSearch && (
            <button
              onClick={() => setMatrixSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Club Selector */}
        <div className="relative">
          <select
            value={matrixTeamId || ""}
            onChange={(e) =>
              setMatrixTeamId(
                e.target.value ? parseInt(e.target.value, 10) : null,
              )
            }
            className="appearance-none pl-3.5 pr-8 py-2 rounded-2xl bg-slate-950 border border-white/10 text-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">All 20 Clubs</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Price Range Controls */}
        <div className="flex items-center gap-2.5 bg-slate-950 px-3.5 py-1.5 rounded-2xl border border-white/10">
          <span className="text-xs font-bold text-slate-400">Price:</span>
          <div className="flex items-center gap-1 font-mono text-xs font-black text-emerald-400">
            <span>£{(matrixMinPrice / 10).toFixed(1)}m</span>
            <span className="text-slate-600">-</span>
            <span>£{(matrixMaxPrice / 10).toFixed(1)}m</span>
          </div>

          <input
            type="range"
            min="35"
            max="155"
            step="1"
            value={matrixMaxPrice}
            onChange={handleMaxPriceChange}
            className="w-24 sm:w-32 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            title={`Max Price: £${(matrixMaxPrice / 10).toFixed(1)}m`}
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 bg-rose-950/60 px-3 py-2 rounded-2xl border border-rose-500/30 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
