'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { KitIcon } from '@/components/ui/KitIcon';
import { 
  X, 
  Sparkles, 
  TrendingUp, 
  Shield, 
  Calendar, 
  History, 
  ShoppingBag, 
  Loader2, 
  Award, 
  Zap, 
  Percent, 
  AlertCircle
} from 'lucide-react';

export const PlayerDetailModal: React.FC = () => {
  const { 
    selectedPlayerForDetail, 
    closePlayerDetail, 
    playerMap, 
    teamMap, 
    selectedGameweek, 
    getPlayerUpcomingFixtures,
    getPlayerGameweekXp,
    openTransferDrawer,
    isGameweekLocked
  } = usePlannerStore();

  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    history: any[];
    fixtures: any[];
    history_past: any[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'season' | 'past' | 'fixtures'>('season');
  const [imgError, setImgError] = useState(false);

  const player = selectedPlayerForDetail ? playerMap.get(selectedPlayerForDetail) : null;
  const team = player ? teamMap.get(player.team) : null;

  useEffect(() => {
    if (!selectedPlayerForDetail) {
      setSummaryData(null);
      setImgError(false);
      return;
    }

    setLoading(true);
    fetch(`/api/fpl/element-summary/${selectedPlayerForDetail}`)
      .then(res => res.json())
      .then(data => {
        setSummaryData(data);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Failed to load element summary:', err);
        setLoading(false);
      });
  }, [selectedPlayerForDetail]);

  // Compute Totals and Per-90 for This Season (Hook declared unconditionally)
  const seasonTotals = useMemo(() => {
    if (!summaryData?.history || summaryData.history.length === 0) return null;
    const history = summaryData.history;

    const tot = history.reduce((acc, m) => ({
      minutes: acc.minutes + (m.minutes || 0),
      starts: acc.starts + (m.starts || 0),
      points: acc.points + (m.total_points || 0),
      goals: acc.goals + (m.goals_scored || 0),
      assists: acc.assists + (m.assists || 0),
      xG: acc.xG + parseFloat(m.expected_goals || '0'),
      xA: acc.xA + parseFloat(m.expected_assists || '0'),
      xGI: acc.xGI + parseFloat(m.expected_goal_involvements || '0'),
      clean_sheets: acc.clean_sheets + (m.clean_sheets || 0),
      goals_conceded: acc.goals_conceded + (m.goals_conceded || 0),
      xGC: acc.xGC + parseFloat(m.expected_goals_conceded || '0'),
      tackles: acc.tackles + (m.tackles || 0),
      cbi: acc.cbi + (m.clearances_blocks_interceptions || 0),
      recoveries: acc.recoveries + (m.recoveries || 0),
      dc: acc.dc + (m.defensive_contribution || 0),
      yellow_cards: acc.yellow_cards + (m.yellow_cards || 0),
      red_cards: acc.red_cards + (m.red_cards || 0),
      saves: acc.saves + (m.saves || 0),
      bonus: acc.bonus + (m.bonus || 0),
      bps: acc.bps + (m.bps || 0),
    }), {
      minutes: 0, starts: 0, points: 0, goals: 0, assists: 0, xG: 0, xA: 0, xGI: 0,
      clean_sheets: 0, goals_conceded: 0, xGC: 0, tackles: 0, cbi: 0, recoveries: 0,
      dc: 0, yellow_cards: 0, red_cards: 0, saves: 0, bonus: 0, bps: 0
    });

    const nineties = tot.minutes > 0 ? tot.minutes / 90 : 1;
    return {
      totals: tot,
      per90: {
        xG: (tot.xG / nineties).toFixed(2),
        xA: (tot.xA / nineties).toFixed(2),
        xGI: (tot.xGI / nineties).toFixed(2),
        xGC: (tot.xGC / nineties).toFixed(2),
        tackles: (tot.tackles / nineties).toFixed(1),
        cbi: (tot.cbi / nineties).toFixed(1),
        recoveries: (tot.recoveries / nineties).toFixed(1),
      }
    };
  }, [summaryData]);

  if (!selectedPlayerForDetail || !player) return null;

  const posName = player.element_type === 1 ? 'Goalkeeper' :
                  player.element_type === 2 ? 'Defender' :
                  player.element_type === 3 ? 'Midfielder' : 'Forward';

  // Photo URL from official Premier League CDN
  const photoCode = player.photo ? player.photo.replace('.jpg', '.png') : null;
  const photoUrl = photoCode ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${photoCode}` : null;

  const upcomingNext5 = getPlayerUpcomingFixtures(player.id, 5);

  const handleOpenTransfer = () => {
    const pId = player.id;
    closePlayerDetail();
    openTransferDrawer(pId);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={closePlayerDetail}
    >
      <div 
        className="relative w-full max-w-6xl xl:max-w-7xl my-auto max-h-[94vh] flex flex-col bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl shadow-purple-950/70 overflow-hidden text-slate-200 select-none"
        onClick={e => e.stopPropagation()}
      >
        {/* 1. Header Banner */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-r from-[#38003c] via-[#500057] to-[#00ff85]/30 flex items-center justify-between overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Left: Cutout Photo + Name Info */}
          <div className="flex items-center gap-5 sm:gap-7 relative z-10">
            <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xl">
              {photoUrl && !imgError ? (
                <img 
                  src={photoUrl} 
                  alt={player.web_name} 
                  className="w-full h-full object-cover object-top scale-110"
                  onError={() => setImgError(true)}
                />
              ) : (
                <KitIcon 
                  teamCode={player.team_code} 
                  teamShortName={team?.short_name} 
                  isGoalkeeper={player.element_type === 1}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
                />
              )}
            </div>

            <div className="flex flex-col">
              <span className="text-xs sm:text-base font-black text-emerald-300 uppercase tracking-widest">
                {posName}
              </span>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                {player.first_name} {player.second_name}
              </h2>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-sm sm:text-lg font-bold text-slate-200">
                  {team?.name || 'Premier League'}
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-emerald-400 bg-slate-950/80 px-3 py-1 rounded-full border border-emerald-500/30 shadow">
                  £{(player.now_cost / 10).toFixed(1)}m
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 relative z-10">
            <button
              onClick={handleOpenTransfer}
              className="hidden sm:flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm sm:text-base shadow-xl transition-all active:scale-95"
            >
              <ShoppingBag className="w-5 h-5" />
              Transfer / Replace
            </button>
            <button
              onClick={closePlayerDetail}
              className="p-2.5 rounded-2xl bg-slate-950/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 2. Key Performance Stat Pills */}
        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-white/10 border-b border-white/10 bg-slate-950/90 text-center py-4 sm:py-5">
          <div className="px-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Form</span>
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-white font-mono mt-0.5 block">{player.form || '0.0'}</span>
          </div>
          <div className="px-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Pts / Match</span>
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-white font-mono mt-0.5 block">
              {player.total_points && player.starts ? (player.total_points / Math.max(1, player.starts)).toFixed(1) : (player.form || '0.0')}
            </span>
          </div>
          <div className="px-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Pts</span>
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-emerald-400 font-mono mt-0.5 block">{player.total_points || 0}</span>
          </div>
          <div className="px-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Bonus</span>
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-amber-400 font-mono mt-0.5 block">{player.bps || 0}</span>
          </div>
          <div className="px-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">ICT Index</span>
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-teal-300 font-mono mt-0.5 block">{player.threat ? (parseFloat(player.threat) / 10).toFixed(1) : '0.0'}</span>
          </div>
          <div className="px-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">TSB %</span>
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-purple-300 font-mono mt-0.5 block">{player.selected_by_percent || '0'}%</span>
          </div>
        </div>

        {/* 3. Middle Section: Recent Form & Next 5 Fixtures */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-slate-900/60 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Recent Matches */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              Recent Form Matches
            </span>
            <div className="w-full flex items-center gap-2">
              {summaryData?.history && summaryData.history.length > 0 ? (
                summaryData.history.slice(-5).map(m => {
                  const oppTeam = teamMap.get(m.opponent_team);
                  return (
                    <div 
                      key={m.fixture}
                      className="flex-1 min-w-0 bg-slate-950 rounded-2xl p-2 sm:p-2.5 border border-white/15 text-center flex flex-col items-center shadow-lg hover:border-emerald-500/30 transition-colors"
                    >
                      <span className="text-[11px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wide">GW{m.round}</span>
                      <span className="text-xs sm:text-sm md:text-base font-black text-white mt-0.5 truncate max-w-full leading-tight">
                        {oppTeam?.short_name || 'TBD'} ({m.was_home ? 'H' : 'A'})
                      </span>
                      <span className="text-[11px] sm:text-xs font-mono font-black text-emerald-300 mt-2 bg-emerald-950/90 px-2 py-0.5 rounded-xl border border-emerald-500/40 shadow-sm truncate max-w-full">
                        {m.total_points} pts
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-slate-500 py-3">No completed matches yet this season</div>
              )}
            </div>
          </div>

          {/* Upcoming Next 5 Fixtures (Grid of 5 items so all 5 fit perfectly without scrollbar) */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Upcoming 5 Fixtures & Projected xP
            </span>
            <div className="w-full grid grid-cols-5 gap-1.5 sm:gap-2">
              {upcomingNext5.map(f => {
                const diff = f.difficulty || 3;
                const diffColor = diff === 1 || diff === 2 ? 'bg-emerald-600 text-white' :
                                  diff === 3 ? 'bg-slate-300 text-slate-900 font-black' :
                                  diff === 4 ? 'bg-[#e90052] text-white font-black' : 'bg-[#6a041d] text-rose-100 font-black';
                const xpVal = f.xP !== undefined ? f.xP : getPlayerGameweekXp(player.id, f.event);

                return (
                  <div 
                    key={f.event}
                    className="w-full min-w-0 bg-slate-950 rounded-2xl p-2 sm:p-2.5 border border-white/15 text-center flex flex-col items-center shadow-lg hover:border-purple-500/30 transition-colors"
                  >
                    <span className="text-[11px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wide">GW{f.event}</span>
                    <span className="text-xs sm:text-sm md:text-base font-black text-white mt-0.5 truncate max-w-full leading-tight">
                      {f.opponentShortName} ({f.isHome ? 'H' : 'A'})
                    </span>
                    <div className="flex flex-col items-center gap-1 mt-1.5 w-full">
                      <span className={`text-[10px] sm:text-xs font-mono font-black px-1.5 py-0.5 rounded-lg w-full shadow-sm truncate ${diffColor}`}>
                        FDR {diff}
                      </span>
                      <span className="text-[10px] sm:text-xs font-mono font-black text-emerald-300 bg-emerald-950/90 px-1.5 py-0.5 rounded-lg border border-emerald-500/40 w-full shadow-sm truncate">
                        {xpVal.toFixed(1)} xP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Tab Navigation Header */}
        <div className="flex items-center gap-3 px-6 pt-4 bg-slate-950 border-b border-white/10">
          <button
            onClick={() => setActiveTab('season')}
            className={`pb-3 px-4 text-sm sm:text-base font-black transition-all border-b-2 ${
              activeTab === 'season'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            This Season (Match Log)
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`pb-3 px-4 text-sm sm:text-base font-black transition-all border-b-2 ${
              activeTab === 'past'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Previous Seasons
          </button>
          <button
            onClick={() => setActiveTab('fixtures')}
            className={`pb-3 px-4 text-sm sm:text-base font-black transition-all border-b-2 ${
              activeTab === 'fixtures'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Full Fixture Schedule
          </button>
        </div>

        {/* 5. Tab Body: Match History or Past Seasons */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[420px] bg-slate-950/40">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-sm font-bold">Loading match statistics...</span>
            </div>
          ) : activeTab === 'season' ? (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left font-mono text-xs sm:text-sm border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-950 border-b border-white/15 text-[11px] uppercase font-black tracking-wider text-slate-400">
                    <th className="py-3 px-3.5">GW</th>
                    <th className="py-3 px-3.5">Opponent</th>
                    <th className="py-3 px-2 text-center">Result</th>
                    <th className="py-3 px-2 text-center font-bold text-emerald-400">Pts</th>
                    <th className="py-3 px-2 text-center">MP</th>
                    <th className="py-3 px-2 text-center">GS</th>
                    <th className="py-3 px-2 text-center">A</th>
                    <th className="py-3 px-2 text-center">xG</th>
                    <th className="py-3 px-2 text-center">xA</th>
                    <th className="py-3 px-2 text-center">xGI</th>
                    <th className="py-3 px-2 text-center">CS</th>
                    <th className="py-3 px-2 text-center">GC</th>
                    <th className="py-3 px-2 text-center">xGC</th>
                    <th className="py-3 px-2 text-center">BPS</th>
                    <th className="py-3 px-2 text-center">Bonus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {summaryData?.history && summaryData.history.length > 0 ? (
                    summaryData.history.map(m => {
                      const opp = teamMap.get(m.opponent_team);
                      const resultStr = `${m.team_h_score} - ${m.team_a_score}`;
                      return (
                        <tr key={m.fixture} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3.5 font-bold text-white">GW{m.round}</td>
                          <td className="py-2.5 px-3.5">
                            <span className="font-bold text-slate-200">{opp?.short_name || 'TBD'}</span>
                            <span className="text-slate-500 text-xs ml-1">({m.was_home ? 'H' : 'A'})</span>
                          </td>
                          <td className="py-2.5 px-2 text-center text-slate-400 font-bold">{resultStr}</td>
                          <td className="py-2.5 px-2 text-center font-black text-emerald-400 bg-emerald-950/20">{m.total_points}</td>
                          <td className="py-2.5 px-2 text-center text-slate-300">{m.minutes}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-white">{m.goals_scored}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-white">{m.assists}</td>
                          <td className="py-2.5 px-2 text-center text-rose-300">{parseFloat(m.expected_goals || '0').toFixed(2)}</td>
                          <td className="py-2.5 px-2 text-center text-blue-300">{parseFloat(m.expected_assists || '0').toFixed(2)}</td>
                          <td className="py-2.5 px-2 text-center text-amber-300">{parseFloat(m.expected_goal_involvements || '0').toFixed(2)}</td>
                          <td className="py-2.5 px-2 text-center text-indigo-300">{m.clean_sheets}</td>
                          <td className="py-2.5 px-2 text-center text-slate-400">{m.goals_conceded}</td>
                          <td className="py-2.5 px-2 text-center text-slate-400">{parseFloat(m.expected_goals_conceded || '0').toFixed(2)}</td>
                          <td className="py-2.5 px-2 text-center text-slate-400">{m.bps}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-amber-400">{m.bonus}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={15} className="py-8 text-center text-slate-500 font-sans text-sm">
                        No match records available yet for this season.
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Sticky Summary Totals & Per-90 Footer */}
                {seasonTotals && (
                  <tfoot className="bg-slate-950 font-black border-t-2 border-white/20 text-white">
                    <tr>
                      <td className="py-3 px-3.5 uppercase text-emerald-400" colSpan={3}>Totals</td>
                      <td className="py-3 px-2 text-center text-emerald-400 bg-emerald-950/40">{seasonTotals.totals.points}</td>
                      <td className="py-3 px-2 text-center">{seasonTotals.totals.minutes}</td>
                      <td className="py-3 px-2 text-center">{seasonTotals.totals.goals}</td>
                      <td className="py-3 px-2 text-center">{seasonTotals.totals.assists}</td>
                      <td className="py-3 px-2 text-center text-rose-300">{seasonTotals.totals.xG.toFixed(2)}</td>
                      <td className="py-3 px-2 text-center text-blue-300">{seasonTotals.totals.xA.toFixed(2)}</td>
                      <td className="py-3 px-2 text-center text-amber-300">{seasonTotals.totals.xGI.toFixed(2)}</td>
                      <td className="py-3 px-2 text-center text-indigo-300">{seasonTotals.totals.clean_sheets}</td>
                      <td className="py-3 px-2 text-center">{seasonTotals.totals.goals_conceded}</td>
                      <td className="py-3 px-2 text-center">{seasonTotals.totals.xGC.toFixed(2)}</td>
                      <td className="py-3 px-2 text-center">{seasonTotals.totals.bps}</td>
                      <td className="py-3 px-2 text-center text-amber-400">{seasonTotals.totals.bonus}</td>
                    </tr>
                    <tr className="text-slate-400 text-xs bg-slate-900/60">
                      <td className="py-2.5 px-3.5 uppercase" colSpan={3}>Per 90 Mins</td>
                      <td className="py-2.5 px-2 text-center text-slate-400">-</td>
                      <td className="py-2.5 px-2 text-center">90</td>
                      <td className="py-2.5 px-2 text-center">-</td>
                      <td className="py-2.5 px-2 text-center">-</td>
                      <td className="py-2.5 px-2 text-center text-rose-300">{seasonTotals.per90.xG}</td>
                      <td className="py-2.5 px-2 text-center text-blue-300">{seasonTotals.per90.xA}</td>
                      <td className="py-2.5 px-2 text-center text-amber-300">{seasonTotals.per90.xGI}</td>
                      <td className="py-2.5 px-2 text-center">-</td>
                      <td className="py-2.5 px-2 text-center">-</td>
                      <td className="py-2.5 px-2 text-center">{seasonTotals.per90.xGC}</td>
                      <td className="py-2.5 px-2 text-center">-</td>
                      <td className="py-2.5 px-2 text-center">-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : activeTab === 'past' ? (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left font-mono text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-white/15 text-[11px] uppercase font-black tracking-wider text-slate-400">
                    <th className="py-3 px-3.5">Season</th>
                    <th className="py-3 px-3.5 text-center font-bold text-emerald-400">Total Pts</th>
                    <th className="py-3 px-3.5 text-center">Minutes</th>
                    <th className="py-3 px-3.5 text-center">Goals</th>
                    <th className="py-3 px-3.5 text-center">Assists</th>
                    <th className="py-3 px-3.5 text-center">Clean Sheets</th>
                    <th className="py-3 px-3.5 text-center">Bonus</th>
                    <th className="py-3 px-3.5 text-center">Start £</th>
                    <th className="py-3 px-3.5 text-center">End £</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {summaryData?.history_past && summaryData.history_past.length > 0 ? (
                    summaryData.history_past.map(p => (
                      <tr key={p.season_name} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3.5 font-bold text-white">{p.season_name}</td>
                        <td className="py-2.5 px-3.5 text-center font-black text-emerald-400 bg-emerald-950/20">{p.total_points}</td>
                        <td className="py-2.5 px-3.5 text-center text-slate-300">{p.minutes}</td>
                        <td className="py-2.5 px-3.5 text-center font-bold text-white">{p.goals_scored}</td>
                        <td className="py-2.5 px-3.5 text-center font-bold text-white">{p.assists}</td>
                        <td className="py-2.5 px-3.5 text-center text-indigo-300">{p.clean_sheets}</td>
                        <td className="py-2.5 px-3.5 text-center text-amber-400">{p.bonus}</td>
                        <td className="py-2.5 px-3.5 text-center text-slate-400">£{(p.start_cost / 10).toFixed(1)}m</td>
                        <td className="py-2.5 px-3.5 text-center text-emerald-400 font-bold">£{(p.end_cost / 10).toFixed(1)}m</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-sans text-sm">
                        No previous season records found for this player.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {summaryData?.fixtures?.map(f => {
                const isHome = f.is_home;
                const opp = teamMap.get(isHome ? f.team_a : f.team_h);
                const diff = f.difficulty || 3;
                const diffColor = diff === 1 || diff === 2 ? 'bg-emerald-600 text-white' :
                                  diff === 3 ? 'bg-slate-300 text-slate-900 font-black' :
                                  diff === 4 ? 'bg-[#e90052] text-white font-black' : 'bg-[#6a041d] text-rose-100 font-black';

                const eventXp = f.event ? getPlayerGameweekXp(player.id, f.event) : 3.0;

                return (
                  <div key={f.id || f.event} className="p-4 bg-slate-950 rounded-2xl border border-white/10 flex flex-col justify-between shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white">{f.event_name || `GW ${f.event}`}</span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${diffColor}`}>
                        FDR {diff}
                      </span>
                    </div>
                    <div className="my-3">
                      <span className="text-base font-black text-slate-100 block truncate">
                        {opp?.name || 'TBD'}
                      </span>
                      <span className="text-xs sm:text-sm text-slate-400 block mt-0.5">
                        {isHome ? 'Home (H)' : 'Away (A)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Projected</span>
                      <span className="text-sm font-mono font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        {eventXp.toFixed(1)} xP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};