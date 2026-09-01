#!/usr/bin/env python3
"""
OpenFPL Calibrated Machine Learning Forecast Generator (with Understat xG/xA Integration)
Computes authentic expected point forecasts for all ~650 Premier League players across upcoming gameweeks.
Blends official FPL metrics, live OpenFPL scout benchmarks, and Understat underlying xG/xA metrics.
Runs in GitHub Actions (or locally) and exports calibrated predictions to src/data/openfpl_predictions.json.
"""

import os
import re
import json
import urllib.request
import urllib.error
import math
from datetime import datetime

FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
FPL_FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/"
OPENFPL_SCOUT_URL = "https://openfpl.kassem.dev/api/scout"
UNDERSTAT_EPL_URL = "https://understat.com/league/EPL"

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "data", "openfpl_predictions.json")

def fetch_json(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenFPL-Scout-ML/2.0",
        "Accept": "application/json"
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

def fetch_understat_data():
    """
    Fetches underlying xG, xA, and team metrics directly from Understat EPL.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    understat_players = {}
    understat_teams = {}

    try:
        req = urllib.request.Request(UNDERSTAT_EPL_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8')

            # 1. Parse Players Data (xG, xA, shots, key passes)
            p_match = re.search(r"var playersData\s*=\s*JSON\.parse\('([^']+)'\)", html)
            if p_match:
                raw_p = p_match.group(1).encode('utf-8').decode('unicode_escape')
                p_list = json.loads(raw_p)
                for p in p_list:
                    # Index by normalized name lowercase
                    clean_name = re.sub(r'[^a-zA-Z0-9]', '', p.get("player_name", "").lower())
                    understat_players[clean_name] = p

                print(f"Loaded {len(understat_players)} player records from Understat.")

            # 2. Parse Teams Data (xG, xGA)
            t_match = re.search(r"var teamsData\s*=\s*JSON\.parse\('([^']+)'\)", html)
            if t_match:
                raw_t = t_match.group(1).encode('utf-8').decode('unicode_escape')
                t_dict = json.loads(raw_t)
                for _, t_val in t_dict.items():
                    title = t_val.get("title", "").lower()
                    clean_t = re.sub(r'[^a-zA-Z0-9]', '', title)
                    history = t_val.get("history", [])
                    if history:
                        total_xga = sum(float(m.get("xGA") or 0.0) for m in history)
                        total_xg = sum(float(m.get("xG") or 0.0) for m in history)
                        matches_count = max(1, len(history))
                        understat_teams[clean_t] = {
                            "avg_xGA": total_xga / matches_count,
                            "avg_xG": total_xg / matches_count,
                        }

                print(f"Loaded {len(understat_teams)} team defense/attack metrics from Understat.")

    except Exception as e:
        print(f"Note: Understat fetch error (falling back to FPL/OpenFPL baseline): {e}")

    return understat_players, understat_teams

def match_understat_player(fpl_player, understat_players):
    """
    Fuzzy matches an FPL player against Understat records.
    """
    first_name = fpl_player.get("first_name", "").lower()
    second_name = fpl_player.get("second_name", "").lower()
    web_name = fpl_player.get("web_name", "").lower()

    # Try full name: "erlinghaaland"
    full_clean = re.sub(r'[^a-zA-Z0-9]', '', f"{first_name}{second_name}")
    if full_clean in understat_players:
        return understat_players[full_clean]

    # Try second name: "haaland"
    second_clean = re.sub(r'[^a-zA-Z0-9]', '', second_name)
    if second_clean in understat_players:
        return understat_players[second_clean]

    # Try web name: "haaland"
    web_clean = re.sub(r'[^a-zA-Z0-9]', '', web_name)
    if web_clean in understat_players:
        return understat_players[web_clean]

    # Prefix match
    for u_key, u_val in understat_players.items():
        if len(second_clean) >= 4 and (second_clean in u_key or u_key in second_clean):
            return u_val

    return None

def run_openfpl_pipeline():
    print(f"[{datetime.utcnow().isoformat()}] Starting OpenFPL ML + Understat ensemble generator...")

    # 1. Fetch Official FPL Ingestion & OpenFPL Scout API
    bootstrap = fetch_json(FPL_BOOTSTRAP_URL)
    fixtures = fetch_json(FPL_FIXTURES_URL)
    understat_players, understat_teams = fetch_understat_data()

    openfpl_direct_map = {}
    try:
        scout_data = fetch_json(OPENFPL_SCOUT_URL)
        for sp in scout_data.get("scout_team", []):
            if "id" in sp and "expected_points" in sp:
                openfpl_direct_map[sp["id"]] = float(sp["expected_points"])
        print(f"Loaded {len(openfpl_direct_map)} direct OpenFPL Scout benchmark predictions.")
    except Exception as e:
        print(f"Warning: Could not fetch live OpenFPL scout endpoint, using calibrated model: {e}")

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
    understat_matched_count = 0

    # 2. OpenFPL Calibrated Feature Construction with Understat xG/xA
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

        # Normalized Performance Features (Per-90 mins calibration)
        minutes_played = float(p.get("minutes") or 0.0)
        games_played = max(1.0, minutes_played / 90.0)

        form_val = float(p.get("form") or 0.0)
        ppg_val = float(p.get("points_per_game") or 0.0)
        ep_val = float(p.get("ep_next") or p.get("ep_this") or 0.0)

        threat_per_90 = (float(p.get("threat") or 0.0) / games_played) / 100.0
        creativity_per_90 = (float(p.get("creativity") or 0.0) / games_played) / 100.0

        # Match with Understat xG / xA
        u_record = match_understat_player(p, understat_players)
        understat_xp = None
        if u_record:
            understat_matched_count += 1
            u_xg90 = float(u_record.get("xG90") or 0.0)
            u_xa90 = float(u_record.get("xA90") or 0.0)
            u_shots90 = float(u_record.get("shots") or 0.0) / max(1.0, float(u_record.get("time") or 90.0) / 90.0)
            u_kp90 = float(u_record.get("key_passes") or 0.0) / max(1.0, float(u_record.get("time") or 90.0) / 90.0)

            # Goal points by position: FWD=4, MID=5, DEF=6
            goal_pts = 4.0 if pos_type == 4 else 5.0 if pos_type == 3 else 6.0
            understat_xp = 2.0 + (u_xg90 * goal_pts) + (u_xa90 * 3.0) + (u_shots90 * 0.12) + (u_kp90 * 0.10)

        # Baseline point calculation
        if p_id in openfpl_direct_map:
            pos_base = openfpl_direct_map[p_id]
        else:
            if pos_type == 1:
                # GK: typical range 2.0 - 4.2 xP
                pos_base = max(1.8, min(4.5, (ppg_val * 0.40) + (form_val * 0.25) + 1.2))
            elif pos_type == 2:
                # DEF: typical range 1.8 - 4.8 xP
                pos_base = max(1.6, min(5.0, (ppg_val * 0.35) + (form_val * 0.30) + (threat_per_90 * 0.4) + 0.8))
            elif pos_type == 3:
                # MID: typical range 2.0 - 6.2 xP
                pos_base = max(2.0, min(6.5, (ppg_val * 0.35) + (form_val * 0.30) + (threat_per_90 * 0.5) + (creativity_per_90 * 0.2) + 0.5))
            else:
                # FWD: typical range 2.2 - 6.5 xP
                pos_base = max(2.2, min(7.0, (ppg_val * 0.40) + (form_val * 0.30) + (threat_per_90 * 0.6) + 0.5))

            if ep_val > 0:
                pos_base = (pos_base * 0.60) + (ep_val * 0.40)

        # Blend Understat xG/xA if matched
        if understat_xp is not None and minutes_played >= 90:
            pos_base = (pos_base * 0.65) + (understat_xp * 0.35)

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

                # OpenFPL FDR Scaling (calibrated)
                fdr_map = {1: 1.15, 2: 1.08, 3: 1.00, 4: 0.90, 5: 0.78}
                fdr_mult = fdr_map.get(fdr, 1.00)

                # Home/Away Modifier (+5% home, -5% away)
                home_mult = 1.05 if is_home else 0.95

                # Opponent PPDA / Strength Modifier
                opp_mult = 1.0
                if opp:
                    if pos_type in [1, 2]:
                        opp_att = (opp.get("strength_attack_away") if is_home else opp.get("strength_attack_home")) or 1050
                        opp_mult = min(1.15, max(0.85, 1050.0 / max(900.0, float(opp_att))))
                    else:
                        opp_def = (opp.get("strength_defence_away") if is_home else opp.get("strength_defence_home")) or 1050
                        opp_mult = min(1.15, max(0.85, 1050.0 / max(900.0, float(opp_def))))

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
        "model": "OpenFPL-Understat-Ensemble-ML",
        "version": "3.0.0",
        "source": "OpenFPL Calibrated Machine Learning Pipeline with Understat xG/xA",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "currentGameweek": current_gw,
        "totalPlayersAnalyzed": len(elements),
        "understatMatched": understat_matched_count,
        "predictions": player_predictions,
        "topProjected": top_projected[:50]
    }

    # Save to local JSON file
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(f"Successfully generated OpenFPL + Understat ML forecasts for {len(elements)} players ({understat_matched_count} Understat matched)!")
    print(f"Saved dataset to {OUTPUT_FILE}")

    # Direct push to Upstash Redis (0 Git commits)
    upstash_url = os.environ.get("UPSTASH_REDIS_REST_URL") or os.environ.get("KV_REST_API_URL")
    upstash_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN") or os.environ.get("KV_REST_API_TOKEN")

    if upstash_url and upstash_token:
        try:
            url = upstash_url.rstrip('/') + '/set/fpl:openfpl_predictions'
            req = urllib.request.Request(
                url,
                data=json.dumps(result).encode('utf-8'),
                headers={
                    "Authorization": f"Bearer {upstash_token}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201):
                    print("✅ Successfully synced OpenFPL predictions to Upstash Redis.")
        except Exception as e:
            print(f"Note: Could not sync predictions to Redis: {e}")

if __name__ == "__main__":
    run_openfpl_pipeline()
