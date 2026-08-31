/**
 * Sync Player Form Momentum Script (Background Runner)
 * 
 * Fetches match-by-match element-summary telemetry for active Premier League players,
 * computes rolling 3-match and 5-match xG/xA per 90 velocity, and populates
 * src/data/player_form_momentum.json.
 */

const fs = require('fs');
const path = require('path');

async function syncFormMomentum() {
  console.log('[Momentum Sync] Fetching bootstrap-static player list...');

  try {
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    if (!bootstrapRes.ok) throw new Error('Failed to fetch bootstrap-static');
    const bootstrap = await bootstrapRes.json();

    // Focus on key active players (minutes > 0 or regular squad options)
    const activePlayers = bootstrap.elements.filter(p => p.minutes > 0 || p.now_cost >= 50);
    console.log(`[Momentum Sync] Computing rolling momentum for ${activePlayers.length} active players...`);

    const momentumMap = {};

    // Batch requests in concurrent chunks of 15 to be polite to the FPL server
    const CHUNK_SIZE = 15;
    for (let i = 0; i < activePlayers.length; i += CHUNK_SIZE) {
      const chunk = activePlayers.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (p) => {
        try {
          const res = await fetch(`https://fantasy.premierleague.com/api/element-summary/${p.id}/`);
          if (!res.ok) return;
          const summary = await res.json();
          const history = summary.history || [];

          if (history.length === 0) return;

          // Last 3 matches
          const last3 = history.slice(-3);
          const totalMins3 = last3.reduce((s, m) => s + (m.minutes || 0), 0);
          const nineties3 = Math.max(0.3, totalMins3 / 90.0);
          const totalXg3 = last3.reduce((s, m) => s + parseFloat(m.expected_goals || '0'), 0);
          const totalXa3 = last3.reduce((s, m) => s + parseFloat(m.expected_assists || '0'), 0);

          const rolling3Xg90 = Math.round((totalXg3 / nineties3) * 100) / 100;
          const rolling3Xa90 = Math.round((totalXa3 / nineties3) * 100) / 100;
          const rolling3Mins = Math.round(totalMins3 / Math.max(1, last3.length));

          // Last 5 matches
          const last5 = history.slice(-5);
          const totalMins5 = last5.reduce((s, m) => s + (m.minutes || 0), 0);
          const nineties5 = Math.max(0.5, totalMins5 / 90.0);
          const totalXg5 = last5.reduce((s, m) => s + parseFloat(m.expected_goals || '0'), 0);
          const totalXa5 = last5.reduce((s, m) => s + parseFloat(m.expected_assists || '0'), 0);

          const rolling5Xg90 = Math.round((totalXg5 / nineties5) * 100) / 100;
          const rolling5Xa90 = Math.round((totalXa5 / nineties5) * 100) / 100;

          // Season baseline per 90
          const seasonMins = p.minutes || totalMins5 || 90;
          const seasonNineties = Math.max(0.5, seasonMins / 90.0);
          const seasonXg90 = (parseFloat(p.expected_goals || '0') || totalXg5) / seasonNineties;

          // Calculate Momentum Factor (0.85 to 1.15)
          let momentumMultiplier = 1.0;
          let trend = 'stable';

          if (seasonXg90 > 0.05) {
            const ratio = rolling3Xg90 / seasonXg90;
            if (ratio >= 1.25) {
              momentumMultiplier = Math.min(1.15, 1.0 + ((ratio - 1.0) * 0.3));
              trend = 'rising';
            } else if (ratio <= 0.75) {
              momentumMultiplier = Math.max(0.88, 1.0 - ((1.0 - ratio) * 0.3));
              trend = 'cooling';
            }
          }

          momentumMap[`${p.id}`] = {
            playerId: p.id,
            rolling3Mins,
            rolling3Xg90,
            rolling3Xa90,
            rolling5Xg90,
            rolling5Xa90,
            momentumMultiplier: Math.round(momentumMultiplier * 100) / 100,
            trend
          };
        } catch (e) {
          // Ignore individual player fetch errors
        }
      }));
    }

    const payload = {
      lastUpdated: new Date().toISOString(),
      season: '2026/27',
      players: momentumMap
    };

    const targetPath = path.join(__dirname, '..', 'src', 'data', 'player_form_momentum.json');
    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf-8');

    const { saveToRedis } = require('./redis_helper');
    await saveToRedis('fpl:form_momentum', payload);

    console.log(`[Momentum Sync] Successfully updated ${targetPath} with ${Object.keys(momentumMap).length} players!`);
  } catch (err) {
    console.error('[Momentum Sync] Error syncing form momentum:', err);
    process.exit(1);
  }
}

syncFormMomentum();

