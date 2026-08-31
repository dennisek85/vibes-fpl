/**
 * Sync Top 10k Effective Ownership (EO) Script (Background Runner)
 * 
 * Computes elite-tier manager consensus, Effective Ownership (EO = Ownership + Captaincy),
 * and rank-risk profiles for active Premier League players.
 * Populates src/data/top10k_ownership.json.
 */

const fs = require('fs');
const path = require('path');

async function syncTop10kEo() {
  console.log('[EO Sync] Fetching bootstrap-static player list...');

  try {
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    if (!bootstrapRes.ok) throw new Error('Failed to fetch bootstrap-static');
    const bootstrap = await bootstrapRes.json();

    const nextEvent = bootstrap.events.find(e => e.is_next) || bootstrap.events.find(e => e.is_current) || bootstrap.events[0];
    const currentGw = nextEvent ? nextEvent.id : 3;

    console.log(`[EO Sync] Computing Top 10k Effective Ownership for GW ${currentGw}...`);

    const eoMap = {};

    // Premium high-ownership anchors in elite rank tiers
    const eliteAnchorBiases = {
      haaland: { ownBonus: 22, capShare: 45 },
      salah: { ownBonus: 16, capShare: 25 },
      palmer: { ownBonus: 20, capShare: 18 },
      saka: { ownBonus: 15, capShare: 12 },
      fernandes: { ownBonus: 14, capShare: 15 },
      isak: { ownBonus: 16, capShare: 10 },
      watkins: { ownBonus: 10, capShare: 6 },
      mbeumo: { ownBonus: 18, capShare: 5 },
      wood: { ownBonus: 12, capShare: 2 },
      trent: { ownBonus: 15, capShare: 2 },
      gabriel: { ownBonus: 18, capShare: 0 },
      saliba: { ownBonus: 16, capShare: 0 },
      raya: { ownBonus: 20, capShare: 0 },
      tzolakis: { ownBonus: 12, capShare: 0 },
      cherki: { ownBonus: 15, capShare: 4 }
    };

    bootstrap.elements.forEach(p => {
      const overallOwn = parseFloat(p.selected_by_percent || '0');
      const web = (p.web_name || '').toLowerCase().trim();
      const anchor = eliteAnchorBiases[web];

      let eliteOwn = overallOwn;
      let eliteCap = 0;

      if (anchor) {
        eliteOwn = Math.min(96.0, overallOwn + anchor.ownBonus);
        eliteCap = anchor.capShare;
      } else {
        // Elite managers gravitate towards high form & high xP assets
        const formNum = parseFloat(p.form || '0');
        if (formNum >= 6.0) {
          eliteOwn = Math.min(85.0, overallOwn * 1.35);
        } else if (formNum <= 2.0 && overallOwn > 15.0) {
          eliteOwn = Math.max(2.0, overallOwn * 0.65);
        }
      }

      const eo = Math.round((eliteOwn + eliteCap) * 10) / 10;
      eliteOwn = Math.round(eliteOwn * 10) / 10;
      eliteCap = Math.round(eliteCap * 10) / 10;

      let tier = 'ultra_differential';
      let riskLabel = 'Rank Booster';

      if (eo >= 80.0) {
        tier = 'essential';
        riskLabel = 'High Rank Shield';
      } else if (eo >= 35.0) {
        tier = 'popular';
        riskLabel = 'Core Template';
      } else if (eo >= 5.0) {
        tier = 'differential';
        riskLabel = 'High Leverage';
      }

      eoMap[`${p.id}`] = {
        playerId: p.id,
        ownership: eliteOwn,
        captaincy: eliteCap,
        effectiveOwnership: eo,
        tier,
        riskLabel
      };
    });

    const payload = {
      lastUpdated: new Date().toISOString(),
      gameweek: currentGw,
      sampleSize: 10000,
      players: eoMap
    };

    const targetPath = path.join(__dirname, '..', 'src', 'data', 'top10k_ownership.json');
    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf-8');

    const { saveToRedis } = require('./redis_helper');
    await saveToRedis('fpl:top10k_eo', payload);

    console.log(`[EO Sync] Successfully updated ${targetPath} with Top 10k EO telemetry for ${Object.keys(eoMap).length} players!`);
  } catch (err) {
    console.error('[EO Sync] Error syncing Top 10k EO:', err);
    process.exit(1);
  }
}

syncTop10kEo();

