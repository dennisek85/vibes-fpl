import React, { useMemo } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { KitIcon } from '@/components/ui/KitIcon';
import { FdrFixtureCell } from '@/components/ui/FdrBadge';
import { formatMoney } from '@/lib/fpl-rules';
import { POSITION_MAP } from '@/lib/fpl-constants';
import { X, Search, AlertTriangle, ArrowDownUp, ShoppingBag } from 'lucide-react';

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
    setMarketTeamId,
    marketMinPrice,
    marketMaxPrice,
    marketAffordableOnly,
    setMarketAffordableOnly,
    marketSortBy,
    setMarketSort,
    getPlayerUpcomingFixtures,
    fixtureHorizon
  } = usePlannerStore();

  const currentPlan = gameweekPlans[selectedGameweek];
  const playerOut = selectedPlayerForTransfer ? playerMap.get(selectedPlayerForTransfer) : null;
  const currentBank = currentPlan ? currentPlan.calculatedBank : 0;
  const sellValue = playerOut ? playerOut.now_cost : 0;
  const maxAffordablePrice = currentBank + sellValue;

  const filteredPlayers = useMemo(() => {
    if (!players.length) return [];

    return players.filter(p => {
      if (marketPosition !== null && p.element_type !== marketPosition) return false;
      if (marketTeamId !== null && p.team !== marketTeamId) return false;
      if (p.now_cost < marketMinPrice || p.now_cost > marketMaxPrice) return false;
      if (marketAffordableOnly && p.now_cost > maxAffordablePrice) return false;

      if (marketSearch.trim()) {
        const query = marketSearch.toLowerCase();
        const team = teamMap.get(p.team);
        const nameMatch = p.web_name.toLowerCase().includes(query) || 
                          p.first_name.toLowerCase().includes(query) || 
                          p.second_name.toLowerCase().includes(query);
        const teamMatch = team?.name.toLowerCase().includes(query) || team?.short_name.toLowerCase().includes(query);
        if (!nameMatch && !teamMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      if (marketSortBy === 'now_cost') return b.now_cost - a.now_cost;
      if (marketSortBy === 'total_points') return b.total_points - a.total_points;
      if (marketSortBy === 'form') return parseFloat(b.form) - parseFloat(a.form);
      if (marketSortBy === 'selected_by_percent') return parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent);
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
    teamMap
  ]);

  if (!isMarketOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
      <div className="w-full sm:w-[500px] lg:w-[560px] h-full bg-slate-900 border-l border-white/15 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 bg-slate-950 border-b border-white/15 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              <span>Transfer Market</span>
              {playerOut && (
                <span className="text-xs font-semibold text-rose-400 bg-rose-950/70 px-2.5 py-0.5 rounded-full border border-rose-500/40">
                  Replacing {playerOut.web_name} ({formatMoney(playerOut.now_cost)})
                </span>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-medium">
              Available Budget: <span className="text-emerald-400 font-mono font-bold">{formatMoney(maxAffordablePrice)}</span> (Bank: {formatMoney(currentBank)})
            </p>
          </div>
          <button
            onClick={closeTransferDrawer}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3.5 bg-slate-900/95 border-b border-white/10 flex flex-col gap-3">
          {/* Position Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMarketPosition(null)}
              className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-colors ${
                marketPosition === null ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {([1, 2, 3, 4] as const).map(pos => (
              <button
                key={pos}
                onClick={() => setMarketPosition(pos)}
                className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-colors ${
                  marketPosition === pos ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {POSITION_MAP[pos].short}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by player or club name..."
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              className="w-full bg-slate-950 border border-white/15 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Sort & Quick Filters Row */}
          <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <ArrowDownUp className="w-4 h-4 text-slate-400" />
              <select
                value={marketSortBy}
                onChange={(e) => setMarketSort(e.target.value as any)}
                className="bg-slate-950 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
              >
                <option value="now_cost">Sort: Price</option>
                <option value="total_points">Sort: Total Points</option>
                <option value="form">Sort: Form</option>
                <option value="selected_by_percent">Sort: Ownership %</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={marketAffordableOnly}
                onChange={(e) => setMarketAffordableOnly(e.target.checked)}
                className="rounded text-emerald-500 focus:ring-0 bg-slate-950"
              />
              <span className="text-xs font-bold text-slate-300">Affordable only</span>
            </label>
          </div>
        </div>

        {/* Players List Table */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5 p-2 sm:p-3">
          {filteredPlayers.slice(0, 100).map((player) => {
            const team = teamMap.get(player.team);
            const fixtures = getPlayerUpcomingFixtures(player.id, fixtureHorizon);
            const isAffordable = player.now_cost <= maxAffordablePrice;
            const isGK = player.element_type === 1;

            return (
              <div
                key={player.id}
                className="p-2.5 sm:p-3 rounded-2xl hover:bg-slate-800/90 transition-colors flex items-center justify-between gap-3"
              >
                {/* Left: Kit & Details */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <KitIcon teamShortName={team?.short_name} isGoalkeeper={isGK} className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs sm:text-sm text-white truncate">
                        {player.web_name}
                      </span>
                      {player.status !== 'a' && (
                        <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 rounded flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          {player.chance_of_playing_next_round !== null ? `${player.chance_of_playing_next_round}%` : '!'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                      <span className="font-bold text-slate-300">{team?.short_name}</span>
                      <span>·</span>
                      <span>{POSITION_MAP[player.element_type].short}</span>
                      <span>·</span>
                      <span>Pts: {player.total_points}</span>
                      <span>·</span>
                      <span>Form: {player.form}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Upcoming Fixtures in clean cells + Price + Buy Button */}
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <div className="hidden sm:flex rounded-lg overflow-hidden border border-slate-700 divide-x divide-slate-700 shadow-sm min-w-[90px]">
                    {fixtures.map((fix, idx) => (
                      <FdrFixtureCell key={`${fix.event}-${idx}`} fixture={fix} totalCount={fixtureHorizon} />
                    ))}
                  </div>

                  <div className="text-right font-mono text-xs sm:text-sm font-black text-emerald-400 min-w-[45px]">
                    {formatMoney(player.now_cost)}
                  </div>

                  <button
                    onClick={() => executeTransfer(player)}
                    disabled={!isAffordable}
                    className={`px-3.5 py-1.5 rounded-xl font-black text-xs shadow-md transition-all ${
                      isAffordable
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                    }`}
                  >
                    Buy
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
  );
};