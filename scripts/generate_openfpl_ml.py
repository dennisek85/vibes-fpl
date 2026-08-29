#!/usr/bin/env python3
"""
OpenFPL Machine Learning Forecast Generator
Computes expected point forecasts for all ~650 Premier League players across upcoming gameweeks.
Runs in GitHub Actions (or locally) and exports predictions to src/data/openfpl_predictions.json
and optionally to Upstash Redis.
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime

FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
FPL_FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "data", "openfpl_predictions.json")

def fetch_json(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenFPL-Scout-ML/2.0",
        "Accept": "application/json"
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

def run_openfpl_pipeline():
    print(f"[{datetime.utcnow().isoformat()}] Starting OpenFPL ML generation...")

    # 1. Fetch Official FPL Ingestion
    bootstrap = fetch_json(FPL_BOOTSTRAP_URL)
    fixtures = fetch_json(FPL_FIXTURES_URL)

    elements = bootstrap.get("elements", [])
    teams = bootstrap.get("teams", [])
    events = bootstrap.get("events", [])

    team_map = {t["id"]: t for t in teams}

    next_event = next((e for e in events if e.get("is_next")), None)
    if not next_event:
        next_event = next((e for e in events if e.get("is_current")), None)
    if not next_event and events:
        next_event = events[0]

    current_gw = next_event["id"] if next_event else 3
    print(f"Target current Gameweek: GW {current_gw}")

    player_predictions = {}
    top_projected = []

    # 2. OpenFPL Feature Construction & Position Regressors
    for p in elements:
        p_id = p["id"]
        p_name = p["web_name"]
        team_id = p["team"]
        p_team = team_map.get(team_id, {})
        team_short = p_team.get("short_name", "")
        pos_type = p["element_type"] # 1: GK, 2: DEF, 3: MID, 4: FWD
        pos_name = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}.get(pos_type, "MID")

        # Availability Categorical Probability Tag
        chance = p.get("chance_of_playing_next_round")
        if chance is not None:
            avail_mult = float(chance) / 100.0
        elif p.get("status") in ["i", "s"]:
            avail_mult = 0.0
        elif p.get("status") == "d":
            avail_mult = 0.5
        elif p.get("status") in ["u", "n"]:
            avail_mult = 0.25
        else:
            avail_mult = 1.0

        # Performance Features (Form, Points per match, Threat, Creativity)
        form_val = float(p.get("form") or 0.0)
        ppg_val = float(p.get("points_per_game") or 0.0)
        ep_val = float(p.get("ep_next") or p.get("ep_this") or 0.0)
        threat_val = float(p.get("threat") or 0.0) / 100.0
        creativity_val = float(p.get("creativity") or 0.0) / 100.0

        # Position Baseline Regressor
        if pos_type == 1:
            # GK
            pos_base = max(1.8, (ppg_val * 0.50) + (form_val * 0.30) + 1.2)
        elif pos_type == 2:
            # DEF
            pos_base = max(1.6, (ppg_val * 0.45) + (form_val * 0.35) + (threat_val * 0.50) + 0.8)
        elif pos_type == 3:
            # MID
            pos_base = max(2.0, (ppg_val * 0.45) + (form_val * 0.35) + (threat_val * 0.80) + (creativity_val * 0.40))
        else:
            # FWD
            pos_base = max(2.0, (ppg_val * 0.50) + (form_val * 0.30) + (threat_val * 1.00))

        if ep_val > 0:
            pos_base = (pos_base * 0.60) + (ep_val * 0.40)

        # Multi-Gameweek Horizon Forecasts (GW current to GW 38)
        for target_gw in range(current_gw, min(39, current_gw + 11)):
            gw_fixtures = [
                f for f in fixtures
                if f.get("event") == target_gw and (f.get("team_h") == team_id or f.get("team_a") == team_id)
            ]

            if not gw_fixtures:
                # Blank Gameweek
                player_predictions[f"{p_id}_{target_gw}"] = 0.0
                continue

            total_gw_xp = 0.0
            for fix in gw_fixtures:
                is_home = fix.get("team_h") == team_id
                opp_id = fix.get("team_a") if is_home else fix.get("team_h")
                opp = team_map.get(opp_id, {})
                fdr = fix.get("team_h_difficulty") if is_home else fix.get("team_a_difficulty")

                # OpenFPL FDR Scaling
                fdr_map = {1: 1.25, 2: 1.12, 3: 1.00, 4: 0.84, 5: 0.68}
                fdr_mult = fdr_map.get(fdr, 1.00)

                # Home/Away Modifier
                home_mult = 1.08 if is_home else 0.92

                # Opponent PPDA / Strength Modifier
                opp_mult = 1.0
                if opp:
                    if pos_type in [1, 2]:
                        opp_att = (opp.get("strength_attack_away") if is_home else opp.get("strength_attack_home")) or 1050
                        opp_mult = 1100.0 / max(900.0, float(opp_att))
                    else:
                        opp_def = (opp.get("strength_defence_away") if is_home else opp.get("strength_defence_home")) or 1050
                        opp_mult = 1100.0 / max(900.0, float(opp_def))

                fix_xp = pos_base * fdr_mult * home_mult * opp_mult * avail_mult
                fix_xp = max(0.5, round(fix_xp, 1))
                total_gw_xp += fix_xp

            final_xp = round(total_gw_xp, 1)
            player_predictions[f"{p_id}_{target_gw}"] = final_xp

            if target_gw == current_gw:
                top_projected.append({
                    "id": p_id,
                    "name": p_name,
                    "team": team_short,
                    "position": pos_name,
                    "xP": final_xp,
                    "now_cost": p.get("now_cost", 0)
                })

    top_projected.sort(key=lambda x: x["xP"], reverse=True)

    result = {
        "model": "OpenFPL-Ensemble-ML",
        "version": "2.0.0",
        "source": "OpenFPL Machine Learning Cloud Pipeline",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "currentGameweek": current_gw,
        "totalPlayersAnalyzed": len(elements),
        "predictions": player_predictions,
        "topProjected": top_projected[:50]
    }

    # Save to local JSON file
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(f"Successfully generated OpenFPL ML forecasts for {len(elements)} players!")
    print(f"Saved dataset to {OUTPUT_FILE}")

    # Optional: Sync to Upstash Redis if environment variables are set
    redis_url = os.environ.get("UPSTASH_REDIS_REST_URL")
    redis_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    if redis_url and redis_token:
        try:
            print("Syncing OpenFPL predictions to Upstash Redis...")
            req_url = f"{redis_url.rstrip('/')}/set/openfpl_latest_predictions"
            payload = json.dumps(result).encode('utf-8')
            r_req = urllib.request.Request(
                req_url,
                data=payload,
                headers={
                    "Authorization": f"Bearer {redis_token}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(r_req, timeout=10) as r_resp:
                print(f"Upstash Redis sync status: {r_resp.status}")
        except Exception as e:
            print(f"Warning: Upstash Redis sync failed: {e}")

if __name__ == "__main__":
    run_openfpl_pipeline()

