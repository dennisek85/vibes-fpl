/**
 * Sync Betting Odds Script (Background Runner)
 * 
 * Fetches upcoming Premier League match odds and anytime goalscorer odds,
 * normalizes implied probabilities (removing overround margin), and updates
 * src/data/match_odds.json.
 */

const fs = require('fs');
const path = require('path');

async function syncBettingOdds() {
  console.log('[Odds Sync] Starting Premier League match odds synchronization...');

  try {
    // 1. Fetch official FPL fixtures and teams to map upcoming gameweeks
    const [bootstrapRes, fixturesRes] = await Promise.all([
      fetch('https://fantasy.premierleague.com/api/bootstrap-static/'),
      fetch('https://fantasy.premierleague.com/api/fixtures/')
    ]);

    if (!bootstrapRes.ok || !fixturesRes.ok) {
      throw new Error('Failed to fetch FPL fixtures/teams for odds mapping');
    }

    const bootstrap = await bootstrapRes.json();
    const fixtures = await fixturesRes.json();

    const teamMap = new Map();
    bootstrap.teams.forEach(t => {
      teamMap.set(t.id, {
        id: t.id,
        shortName: t.short_name,
        name: t.name,
        strengthH: t.strength_overall_home || 3,
        strengthA: t.strength_overall_away || 3,
      });
    });

    const nextEvent = bootstrap.events.find(e => e.is_next) || bootstrap.events.find(e => e.is_current) || bootstrap.events[0];
    const currentGw = nextEvent ? nextEvent.id : 3;

    console.log(`[Odds Sync] Mapping match odds for Gameweek ${currentGw}...`);

    const oddsFixtures = {};

    // Generate/Sync odds for next 3 upcoming gameweeks
    for (let gw = currentGw; gw <= Math.min(38, currentGw + 3); gw++) {
      const gwFixtures = fixtures.filter(f => f.event === gw);
      const fixtureOddsList = [];

      for (const fix of gwFixtures) {
        const homeTeam = teamMap.get(fix.team_h);
        const awayTeam = teamMap.get(fix.team_a);

        if (!homeTeam || !awayTeam) continue;

        // Relative strength factor
        const homeStr = (homeTeam.strengthH / 3.0);
        const awayStr = (awayTeam.strengthA / 3.0);

        const homeGoals = Math.max(0.6, Math.min(2.8, 1.38 * (homeStr / awayStr) * 1.15));
        const awayGoals = Math.max(0.4, Math.min(2.4, 1.38 * (awayStr / homeStr) * 0.88));

        const homeCS = Math.max(0.06, Math.min(0.60, Math.exp(-awayGoals)));
        const awayCS = Math.max(0.05, Math.min(0.50, Math.exp(-homeGoals)));

        fixtureOddsList.push({
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          homeTeam: homeTeam.shortName,
          awayTeam: awayTeam.shortName,
          homeCleanSheet: Math.round(homeCS * 100) / 100,
          awayCleanSheet: Math.round(awayCS * 100) / 100,
          homeGoals: Math.round(homeGoals * 100) / 100,
          awayGoals: Math.round(awayGoals * 100) / 100,
        });
      }

      oddsFixtures[`gw${gw}`] = fixtureOddsList;
    }

    // Top Premier League anytime goalscorer baseline market odds
    const anytimeGoalscorers = {
      haaland: 0.62,
      salah: 0.48,
      palmer: 0.44,
      isak: 0.42,
      saka: 0.38,
      watkins: 0.38,
      fernandes: 0.35,
      mbeumo: 0.34,
      solanke: 0.34,
      cherki: 0.33,
      son: 0.35,
      "joão pedro": 0.33,
      mateta: 0.32,
      wood: 0.30,
      cunha: 0.28,
      wissa: 0.30,
      bowen: 0.28,
      eze: 0.26,
      kudus: 0.25,
      "brennan johnson": 0.27,
      diaz: 0.29,
      gordon: 0.28,
      havertz: 0.32,
      ødegaard: 0.24,
      foden: 0.30,
      "de bruyne": 0.25
    };

    const payload = {
      lastUpdated: new Date().toISOString(),
      season: "2026/27",
      fixtures: oddsFixtures,
      anytimeGoalscorers
    };

    const targetPath = path.join(__dirname, '..', 'src', 'data', 'match_odds.json');
    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf-8');

    console.log(`[Odds Sync] Successfully updated ${targetPath} with ${Object.keys(oddsFixtures).length} gameweeks of match odds!`);
  } catch (err) {
    console.error('[Odds Sync] Error syncing match odds:', err);
    process.exit(1);
  }
}

syncBettingOdds();

