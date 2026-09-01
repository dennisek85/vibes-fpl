import React, { useMemo, useState } from "react";
import { usePlannerStore } from "@/store/usePlannerStore";
import { KitIcon } from "@/components/ui/KitIcon";
import { FdrFixtureCell } from "@/components/ui/FdrBadge";
import { formatMoney } from "@/lib/fpl-rules";
import { POSITION_MAP } from "@/lib/fpl-constants";
import { FPLPlayer } from "@/types/fpl";
import {
  X,
  Search,
  AlertTriangle,
  ArrowDownUp,
  ShoppingBag,
  Sparkles,
  Zap,
  ArrowLeftRight,
  UserCheck,
  RotateCcw,
} from "lucide-react";

export const PlayerMarketDrawer: React.FC = () => {
  const {
    isMarketOpen,
    closeTransferDrawer,
    selectedPlayerForTransfer,
    playerMap,
    teamMap,
    players,
    selectedGameweek,
    gameweekPlans,
    executeTransfer,
    marketSearch,
    setMarketSearch,
    marketPosition,
    setMarketPosition,
    marketTeamId,
    marketMinPrice,
    marketMaxPrice,
    marketAffordableOnly,
    setMarketAffordableOnly,
    marketSortBy,
    setMarketSort,
    getPlayerUpcomingFixtures,
    getPlayerGameweekXp,
    fixtureHorizon,
    showAiPredictions,
  } = usePlannerStore();

  const [pendingTargetPlayer, setPendingTargetPlayer] =
    useState<FPLPlayer | null>(null);

  const currentPlan = gameweekPlans[selectedGameweek];
  const playerOut = selectedPlayerForTransfer
    ? playerMap.get(selectedPlayerForTransfer)
    : null;
  const currentBank = currentPlan ? currentPlan.calculatedBank : 0;

  const squadPicks = useMemo(
    () => currentPlan?.squad || [],
    [currentPlan?.squad],
  );
  const squadIds = useMemo(
    () => new Set(squadPicks.map((p) => p.element)),
    [squadPicks],
  );

  const sellValue = playerOut ? playerOut.now_cost : 0;
  const maxAffordablePrice = playerOut
    ? currentBank + sellValue
    : currentBank + 155;

  // Count players per club in current squad
  const clubCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    squadPicks.forEach((p) => {
      const pl = playerMap.get(p.element);
      if (pl) {
        counts[pl.team] = (counts[pl.team] || 0) + 1;
      }
    });
    return counts;
  }, [squadPicks, playerMap]);

  // Matching squad players when choosing who to replace for a target player
  const matchingSquadPlayers = useMemo(() => {
    if (!pendingTargetPlayer || !currentPlan) return [];
    return squadPicks
      .map((pick) => {
        const pl = playerMap.get(pick.element);
        if (!pl || pl.element_type !== pendingTargetPlayer.element_type)
          return null;

        const sellingPrice = pl.now_cost;
        const netBankTenths =
          currentBank + sellingPrice - pendingTargetPlayer.now_cost;
        const isAffordable = netBankTenths >= 0;
        const netBank = netBankTenths / 10.0;

        // Club check
        const targetTeam = pendingTargetPlayer.team;
        const currentClubCount = clubCounts[targetTeam] || 0;
        const wouldExceedClub = pl.team !== targetTeam && currentClubCount >= 3;

        return {
          pick,
          player: pl,
          sellingPrice,
          isAffordable: isAffordable && !wouldExceedClub,
          wouldExceedClub,
          netBank,
        };
      })
      .filter(Boolean) as {
      pick: any;
      player: FPLPlayer;
      sellingPrice: number;
      isAffordable: boolean;
      wouldExceedClub: boolean;
      netBank: number;
    }[];
  }, [
    pendingTargetPlayer,
    currentPlan,
    squadPicks,
    playerMap,
    currentBank,
    clubCounts,
  ]);

  // Calculate Top 6 Smart Replacements (or Top 6 Transfers of the Week)
  const topRecommendations = useMemo(() => {
    if (!players.length) return [];

    if (playerOut) {
      // 1. Replacements for a specific selected player
      const candidates = players.filter((p) => {
        if (p.id === playerOut.id) return false;
        if (p.element_type !== playerOut.element_type) return false;
        if (squadIds.has(p.id)) return false;
        if (p.now_cost > maxAffordablePrice) return false;

        const currentClubCount = clubCounts[p.team] || 0;
        const allowedMax = p.team === playerOut.team ? 3 : 2;
        if (currentClubCount > allowedMax) return false;

        return true;
      });

      return candidates
        .map((p) => {
          const xp1In = getPlayerGameweekXp(p.id, selectedGameweek);
          const xp1Out = getPlayerGameweekXp(playerOut.id, selectedGameweek);
          const gain1 = xp1In - xp1Out;

          let xp3In = 0;
          let xp3Out = 0;
          for (
            let gw = selectedGameweek;
            gw <= Math.min(38, selectedGameweek + 2);
            gw++
          ) {
            xp3In += getPlayerGameweekXp(p.id, gw);
            xp3Out += getPlayerGameweekXp(playerOut.id, gw);
          }
          const gain3 = xp3In - xp3Out;
          const remainingBank = (maxAffordablePrice - p.now_cost) / 10.0;

          return {
            player: p,
            xp1: xp1In,
            gain1,
            xp3: xp3In,
            gain3,
            remainingBank,
            score: showAiPredictions ? gain3 : parseFloat(p.form) || 0,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
    } else {
      // 2. Top 6 Overall Transfers of the Week (No player preselected)
      const candidates = players.filter((p) => {
        if (squadIds.has(p.id)) return false;
        const currentClubCount = clubCounts[p.team] || 0;
        if (currentClubCount >= 3) return false;
        return true;
      });

      return candidates
        .map((p) => {
          let xp3 = 0;
          for (
            let gw = selectedGameweek;
            gw <= Math.min(38, selectedGameweek + 2);
            gw++
          ) {
            xp3 += getPlayerGameweekXp(p.id, gw);
          }
          const xp1 = getPlayerGameweekXp(p.id, selectedGameweek);
          const formNum = parseFloat(p.form) || 0;

          return {
            player: p,
            xp1,
            gain1: 0,
            xp3,
            gain3: 0,
            remainingBank: 0,
            score: showAiPredictions ? xp3 : formNum,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
    }
  }, [
    playerOut,
    players,
    squadIds,
    maxAffordablePrice,
    clubCounts,
    selectedGameweek,
    getPlayerGameweekXp,
    showAiPredictions,
  ]);

  const filteredPlayers = useMemo(() => {
    if (!players.length) return [];

    return players
      .filter((p) => {
        if (marketPosition !== null && p.element_type !== marketPosition)
          return false;
        if (marketTeamId !== null && p.team !== marketTeamId) return false;
        if (p.now_cost < marketMinPrice || p.now_cost > marketMaxPrice)
          return false;
        if (
          playerOut &&
          marketAffordableOnly &&
          p.now_cost > maxAffordablePrice
        )
          return false;

        if (marketSearch.trim()) {
          const query = marketSearch.toLowerCase();
          const team = teamMap.get(p.team);
          const nameMatch =
            p.web_name.toLowerCase().includes(query) ||
            p.first_name.toLowerCase().includes(query) ||
            p.second_name.toLowerCase().includes(query);
          const teamMatch =
            team?.name.toLowerCase().includes(query) ||
            team?.short_name.toLowerCase().includes(query);
          if (!nameMatch && !teamMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (marketSortBy === "now_cost") return b.now_cost - a.now_cost;
        if (marketSortBy === "total_points")
          return b.total_points - a.total_points;
        if (marketSortBy === "form")
          return parseFloat(b.form) - parseFloat(a.form);
        if (marketSortBy === "selected_by_percent")
          return (
            parseFloat(b.selected_by_percent) -
            parseFloat(a.selected_by_percent)
          );
        return 0;
      });
  }, [
    players,
    marketPosition,
    marketTeamId,
    marketMinPrice,
    marketMaxPrice,
    marketAffordableOnly,
    marketSearch,
    marketSortBy,
    maxAffordablePrice,
    playerOut,
    teamMap,
  ]);

  // Escape key listener to close drawer or dismiss pending replacement picker
  React.useEffect(() => {
    if (!isMarketOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pendingTargetPlayer) {
          setPendingTargetPlayer(null);
        } else {
          closeTransferDrawer();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMarketOpen, pendingTargetPlayer, closeTransferDrawer]);

  // Action Handler: when clicking Buy / Swap In
  const handleInitiateTransfer = (targetPlayer: FPLPlayer) => {
    if (playerOut) {
      executeTransfer(targetPlayer, selectedPlayerForTransfer);
      closeTransferDrawer();
    } else {
      // Open the interactive squad replacement picker
      setPendingTargetPlayer(targetPlayer);
    }
  };

  const handleConfirmSwap = (
    squadPlayerId: number,
    targetPlayer: FPLPlayer,
  ) => {
    executeTransfer(targetPlayer, squadPlayerId);
    setPendingTargetPlayer(null);
    closeTransferDrawer();
  };

  if (!isMarketOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md transition-opacity cursor-pointer"
      onClick={() => {
        setPendingTargetPlayer(null);
        closeTransferDrawer();
      }}
    >
      {/* Spacious Flyout Panel */}
      <div
        className="relative w-full max-w-7xl h-full bg-slate-900 border-l border-white/15 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header Banner */}
        <div className="px-6 py-4 sm:py-5 bg-slate-950 border-b border-white/15 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2.5">
                <ShoppingBag className="w-6 h-6 text-emerald-400" />
                <span>Transfer Market</span>
              </h2>

              {/* Target to Sell Squad Dropdown & Reset */}
              <div className="flex items-center gap-2 bg-slate-900 border border-white/15 px-3 py-1.5 rounded-xl shadow-inner">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-400">
                  Target to Sell:
                </span>
                <select
                  value={selectedPlayerForTransfer || ""}
                  onChange={(e) => {
                    const val = e.target.value
                      ? parseInt(e.target.value, 10)
                      : null;
                    const selectedPl = val ? playerMap.get(val) : null;
                    usePlannerStore.setState({
                      selectedPlayerForTransfer: val,
                      marketPosition: selectedPl
                        ? selectedPl.element_type
                        : null,
                    });
                  }}
                  className="bg-transparent text-xs sm:text-sm font-black text-white focus:outline-none cursor-pointer pr-1"
                >
                  <option value="" className="bg-slate-950 text-slate-400">
                    ⚡ (General Scouting - Top of the Week)
                  </option>
                  <optgroup
                    label="🧤 Goalkeepers"
                    className="bg-slate-950 text-slate-200"
                  >
                    {squadPicks
                      .filter(
                        (p) => playerMap.get(p.element)?.element_type === 1,
                      )
                      .map((p) => {
                        const pl = playerMap.get(p.element);
                        return pl ? (
                          <option key={pl.id} value={pl.id}>
                            {pl.web_name} ({formatMoney(pl.now_cost)})
                          </option>
                        ) : null;
                      })}
                  </optgroup>
                  <optgroup
                    label="🛡️ Defenders"
                    className="bg-slate-950 text-slate-200"
                  >
                    {squadPicks
                      .filter(
                        (p) => playerMap.get(p.element)?.element_type === 2,
                      )
                      .map((p) => {
                        const pl = playerMap.get(p.element);
                        return pl ? (
                          <option key={pl.id} value={pl.id}>
                            {pl.web_name} ({formatMoney(pl.now_cost)})
                          </option>
                        ) : null;
                      })}
                  </optgroup>
                  <optgroup
                    label="🎯 Midfielders"
                    className="bg-slate-950 text-slate-200"
                  >
                    {squadPicks
                      .filter(
                        (p) => playerMap.get(p.element)?.element_type === 3,
                      )
                      .map((p) => {
                        const pl = playerMap.get(p.element);
                        return pl ? (
                          <option key={pl.id} value={pl.id}>
                            {pl.web_name} ({formatMoney(pl.now_cost)})
                          </option>
                        ) : null;
                      })}
                  </optgroup>
                  <optgroup
                    label="⚡ Forwards"
                    className="bg-slate-950 text-slate-200"
                  >
                    {squadPicks
                      .filter(
                        (p) => playerMap.get(p.element)?.element_type === 4,
                      )
                      .map((p) => {
                        const pl = playerMap.get(p.element);
                        return pl ? (
                          <option key={pl.id} value={pl.id}>
                            {pl.web_name} ({formatMoney(pl.now_cost)})
                          </option>
                        ) : null;
                      })}
                  </optgroup>
                </select>

                {playerOut && (
                  <button
                    onClick={() =>
                      usePlannerStore.setState({
                        selectedPlayerForTransfer: null,
                        marketPosition: null,
                      })
                    }
                    className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 transition-colors ml-1"
                    title="Clear selection and return to General Scouting"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs sm:text-base text-slate-400 mt-1.5 font-medium flex items-center gap-3 flex-wrap">
              {playerOut ? (
                <span>
                  Max Budget:{" "}
                  <strong className="text-emerald-400 font-mono text-base sm:text-lg font-bold">
                    {formatMoney(maxAffordablePrice)}
                  </strong>
                </span>
              ) : (
                <span>
                  Available Bank:{" "}
                  <strong className="text-emerald-400 font-mono text-base sm:text-lg font-bold">
                    {formatMoney(currentBank)}
                  </strong>
                </span>
              )}
              <span className="text-slate-600">|</span>
              <span>
                Current Bank:{" "}
                <strong className="text-slate-200 font-mono text-base font-bold">
                  {formatMoney(currentBank)}
                </strong>
              </span>
              {currentPlan && (
                <>
                  <span className="text-slate-600">|</span>
                  <span>
                    Free Transfers:{" "}
                    <strong className="text-amber-400 font-mono text-base font-bold">
                      {currentPlan.availableTransfers}
                    </strong>
                  </span>
                </>
              )}
            </p>
          </div>

          <button
            onClick={() => {
              setPendingTargetPlayer(null);
              closeTransferDrawer();
            }}
            className="p-2.5 sm:p-3 rounded-2xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0"
            title="Close transfer market"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 2. Main Content Area (Dual Column on Desktop / Tablet) */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/10">
          {/* LEFT PANEL: Top 6 Recommendations / Transfers of the Week */}
          <div className="lg:w-[46%] xl:w-[44%] flex flex-col bg-slate-950/60 overflow-hidden flex-shrink-0">
            {/* Left Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  {playerOut
                    ? `Top 6 Replacements for ${playerOut.web_name}`
                    : "Top 6 Transfers of the Week"}
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/70 px-2.5 py-1 rounded-full border border-emerald-500/30">
                {playerOut
                  ? showAiPredictions
                    ? "Ranked by 3-GW xP"
                    : "Ranked by Form"
                  : showAiPredictions
                    ? "Top Projected 3-GW xP"
                    : "Top In-Form Players"}
              </span>
            </div>

            {/* Scrollable Top 6 List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {topRecommendations.map((rec) => {
                const p = rec.player;
                const team = teamMap.get(p.team);
                const fixtures = getPlayerUpcomingFixtures(p.id, 3);
                const isGK = p.element_type === 1;
                const posStr = POSITION_MAP[p.element_type].short;

                return (
                  <div
                    key={p.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-white/10 hover:border-emerald-500/50 hover:bg-slate-900/90 transition-all flex flex-col justify-between shadow-lg group"
                  >
                    {/* Top Info Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <KitIcon
                          teamCode={team?.code}
                          teamShortName={team?.short_name}
                          isGoalkeeper={isGK}
                          className="w-12 h-12 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-base sm:text-lg text-white truncate">
                              {p.web_name}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-white/10">
                              {team?.short_name} · {posStr}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-slate-400 flex items-center gap-2 mt-1 font-medium">
                            <span className="font-mono font-black text-emerald-400 text-sm sm:text-base">
                              {formatMoney(p.now_cost)}
                            </span>
                            {playerOut && (
                              <>
                                <span>·</span>
                                <span>
                                  Bank after:{" "}
                                  <strong className="text-slate-200">
                                    £{rec.remainingBank.toFixed(1)}m
                                  </strong>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Gain / Projected xP Badge */}
                      <div className="text-right flex-shrink-0">
                        {showAiPredictions ? (
                          playerOut ? (
                            <>
                              <span className="text-xs sm:text-sm text-emerald-400 block font-black uppercase font-mono">
                                {rec.xp3.toFixed(1)} xP
                              </span>
                              <span
                                className={`text-[11px] block font-bold font-mono ${
                                  rec.gain3 > 0
                                    ? "text-emerald-400"
                                    : rec.gain3 === 0
                                      ? "text-slate-400"
                                      : "text-amber-400/90"
                                }`}
                              >
                                {rec.gain3 > 0
                                  ? `+${rec.gain3.toFixed(1)}`
                                  : rec.gain3.toFixed(1)}{" "}
                                vs {playerOut.web_name}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs sm:text-sm text-emerald-400 block font-black uppercase font-mono">
                                {rec.xp3.toFixed(1)} xP
                              </span>
                              <span className="text-xs text-slate-400 block font-semibold">
                                Next 3 GWs
                              </span>
                            </>
                          )
                        ) : (
                          <>
                            <span className="text-xs sm:text-sm text-amber-300 block font-black uppercase">
                              Form: {p.form}
                            </span>
                            <span className="text-xs text-slate-400 block font-semibold">
                              {p.total_points} Pts
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Row: Upcoming Fixtures + Large Swap In Button */}
                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-white/10">
                      <div className="flex rounded-xl overflow-hidden border border-slate-700 divide-x divide-slate-700 shadow-md">
                        {fixtures.map((fix, fIdx) => (
                          <FdrFixtureCell
                            key={`${fix.event}-${fIdx}`}
                            fixture={fix}
                            totalCount={3}
                          />
                        ))}
                      </div>

                      <button
                        onClick={() => handleInitiateTransfer(p)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-lg flex items-center gap-1.5 active:scale-95 transition-all"
                      >
                        <Zap className="w-4 h-4" />
                        <span>{playerOut ? "Swap In" : "Transfer In"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {topRecommendations.length === 0 && (
                <div className="text-center py-16 text-slate-400 text-sm">
                  No legal recommendations available at this time.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Searchable Market Table */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
            {/* Filter Controls Bar */}
            <div className="p-4 sm:p-5 bg-slate-950/95 border-b border-white/10 flex flex-col gap-3.5 flex-shrink-0">
              {/* Position Tabs & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Position Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setMarketPosition(null)}
                    className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs sm:text-sm font-black rounded-lg transition-colors ${
                      marketPosition === null
                        ? "bg-emerald-600 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All
                  </button>
                  {([1, 2, 3, 4] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setMarketPosition(pos)}
                      className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs sm:text-sm font-black rounded-lg transition-colors ${
                        marketPosition === pos
                          ? "bg-emerald-600 text-white shadow-md"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {POSITION_MAP[pos].short}
                    </button>
                  ))}
                </div>

                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search all players or clubs..."
                    value={marketSearch}
                    onChange={(e) => setMarketSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Sort & Affordable Toggle */}
              <div className="flex items-center justify-between gap-3 text-xs sm:text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="w-4 h-4 text-slate-400" />
                  <select
                    value={marketSortBy}
                    onChange={(e) => setMarketSort(e.target.value as any)}
                    className="bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-white focus:outline-none"
                  >
                    <option value="now_cost">Sort: Price (Highest)</option>
                    <option value="total_points">Sort: Total Points</option>
                    <option value="form">Sort: Form (Hot Streak)</option>
                    <option value="selected_by_percent">
                      Sort: Ownership %
                    </option>
                  </select>
                </div>

                {playerOut && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={marketAffordableOnly}
                      onChange={(e) =>
                        setMarketAffordableOnly(e.target.checked)
                      }
                      className="rounded text-emerald-500 focus:ring-0 bg-slate-900 w-4 h-4"
                    />
                    <span className="text-xs sm:text-sm font-bold text-slate-300">
                      Affordable Only
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Players List Table */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 p-3 sm:p-4">
              <div className="px-2 py-1 text-xs font-black uppercase text-slate-400 tracking-wider mb-2">
                All Available Players ({filteredPlayers.length})
              </div>

              {filteredPlayers.slice(0, 100).map((player) => {
                const team = teamMap.get(player.team);
                const fixtures = getPlayerUpcomingFixtures(
                  player.id,
                  fixtureHorizon,
                );
                const isGK = player.element_type === 1;

                return (
                  <div
                    key={player.id}
                    className="p-3 sm:p-3.5 rounded-2xl hover:bg-slate-800/90 transition-colors flex items-center justify-between gap-4"
                  >
                    {/* Left: Kit & Details */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <KitIcon
                        teamCode={team?.code}
                        teamShortName={team?.short_name}
                        isGoalkeeper={isGK}
                        className="w-11 h-11 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm sm:text-base text-white truncate">
                            {player.web_name}
                          </span>
                          {player.status !== "a" && (
                            <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              {player.chance_of_playing_next_round !== null
                                ? `${player.chance_of_playing_next_round}%`
                                : "!"}
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm text-slate-400 flex items-center gap-2 mt-0.5 font-medium">
                          <span className="font-bold text-slate-300">
                            {team?.short_name}
                          </span>
                          <span>·</span>
                          <span>{POSITION_MAP[player.element_type].short}</span>
                          <span>·</span>
                          <span>
                            Pts:{" "}
                            <strong className="text-slate-200">
                              {player.total_points}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            Form:{" "}
                            <strong className="text-slate-200">
                              {player.form}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Upcoming Fixtures + Price + Buy Button */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                      <div className="hidden sm:flex rounded-xl overflow-hidden border border-slate-700 divide-x divide-slate-700 shadow-sm min-w-[100px]">
                        {fixtures.map((fix, idx) => (
                          <FdrFixtureCell
                            key={`${fix.event}-${idx}`}
                            fixture={fix}
                            totalCount={fixtureHorizon}
                          />
                        ))}
                      </div>

                      <div className="text-right font-mono text-sm sm:text-base font-black text-emerald-400 min-w-[55px]">
                        {formatMoney(player.now_cost)}
                      </div>

                      <button
                        onClick={() => handleInitiateTransfer(player)}
                        className="px-4 py-2 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{playerOut ? "Swap In" : "Transfer In"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredPlayers.length === 0 && (
                <div className="text-center py-16 text-slate-400 text-sm">
                  No players found matching your filters.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Replacement Selection Modal / Overlay (When picking who to sell in General Mode) */}
        {pendingTargetPlayer && (
          <div
            className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
            onClick={() => setPendingTargetPlayer(null)}
          >
            <div
              className="w-full max-w-2xl bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl shadow-emerald-950/80 flex flex-col gap-5 text-slate-100 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                      <ArrowLeftRight className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      Select Player to Replace
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                    Choose which{" "}
                    <strong className="text-emerald-300">
                      {POSITION_MAP[pendingTargetPlayer.element_type].name}
                    </strong>{" "}
                    in your squad to sell for{" "}
                    <strong className="text-white">
                      {pendingTargetPlayer.web_name}
                    </strong>{" "}
                    ({formatMoney(pendingTargetPlayer.now_cost)})
                  </p>
                </div>

                <button
                  onClick={() => setPendingTargetPlayer(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Squad Players List */}
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {matchingSquadPlayers.map(
                  ({
                    player,
                    sellingPrice,
                    isAffordable,
                    wouldExceedClub,
                    netBank,
                  }) => {
                    const team = teamMap.get(player.team);
                    const isGK = player.element_type === 1;

                    return (
                      <div
                        key={player.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                          isAffordable
                            ? "bg-slate-950/80 border-white/10 hover:border-emerald-500/50 hover:bg-slate-950"
                            : "bg-slate-950/40 border-rose-500/20 opacity-70"
                        }`}
                      >
                        {/* Left: Squad Player Details */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <KitIcon
                            teamCode={team?.code}
                            teamShortName={team?.short_name}
                            isGoalkeeper={isGK}
                            className="w-12 h-12 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-base sm:text-lg text-white truncate">
                                {player.web_name}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-white/10">
                                {team?.short_name}
                              </span>
                            </div>
                            <div className="text-xs sm:text-sm text-slate-400 flex items-center gap-2 mt-1 font-medium">
                              <span>
                                Sell Value:{" "}
                                <strong className="font-mono text-slate-200">
                                  {formatMoney(sellingPrice)}
                                </strong>
                              </span>
                              <span>·</span>
                              <span>
                                {isAffordable ? (
                                  <strong className="text-emerald-400">
                                    Bank after: £{netBank.toFixed(1)}m
                                  </strong>
                                ) : wouldExceedClub ? (
                                  <strong className="text-rose-400">
                                    Exceeds 3 players from{" "}
                                    {
                                      teamMap.get(pendingTargetPlayer.team)
                                        ?.short_name
                                    }
                                  </strong>
                                ) : (
                                  <strong className="text-rose-400">
                                    Requires £{Math.abs(netBank).toFixed(1)}m
                                    more
                                  </strong>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Swap Action */}
                        <button
                          onClick={() =>
                            handleConfirmSwap(player.id, pendingTargetPlayer)
                          }
                          disabled={!isAffordable}
                          className={`px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-lg flex items-center gap-1.5 transition-all ${
                            isAffordable
                              ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95"
                              : "bg-slate-800 text-slate-500 cursor-not-allowed"
                          }`}
                        >
                          <Zap className="w-4 h-4" />
                          <span>Swap Out</span>
                        </button>
                      </div>
                    );
                  },
                )}

                {matchingSquadPlayers.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No matching{" "}
                    {POSITION_MAP[pendingTargetPlayer.element_type].name} found
                    in your squad.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-slate-400">
                <button
                  onClick={() => setPendingTargetPlayer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors"
                >
                  Cancel
                </button>
                <span>Press Escape to cancel</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
