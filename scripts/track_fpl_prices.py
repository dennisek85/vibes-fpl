#!/usr/bin/env python3
"""
Automated FPL Price Changes & Time-Series Snapshot Tracker
- Runs via GitHub Actions every 4 hours and daily at 01:45 AM UTC (post price-change window).
- Tracks true daily transfer deltas, logs observed price change trigger points, and records hourly velocity.
- Saves persistent snapshot state to src/data/price_snapshots.json.
"""

import os
import json
import time
import urllib.request
from datetime import datetime, timezone, timedelta

FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "price_snapshots.json")
LOCAL_DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".data", "price_snapshots.json")

def get_today_uk_date_string():
    # FPL price changes trigger around 01:30 AM UK time (UTC/BST)
    # If before 01:30 AM, it belongs to previous trading cycle
    now_utc = datetime.now(timezone.utc)
    # Approximate UK time (UTC or UTC+1)
    uk_time = now_utc + timedelta(hours=1)
    if uk_time.hour < 2:
        yesterday = uk_time - timedelta(days=1)
        return yesterday.strftime("%Y-%m-%d")
    return uk_time.strftime("%Y-%m-%d")

def fetch_fpl_bootstrap():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Price-Tracker/2.0",
        "Accept": "application/json"
    }
    req = urllib.request.Request(FPL_BOOTSTRAP_URL, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

def load_existing_snapshots():
    for f in [OUTPUT_FILE, LOCAL_DATA_FILE]:
        if os.path.exists(f):
            try:
                with open(f, 'r', encoding='utf-8') as fp:
                    return json.load(fp)
            except Exception as e:
                print(f"Note: Could not read {f}: {e}")

    return {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "lastPriceChangeDate": get_today_uk_date_string(),
        "baselines": {},
        "hourlyHistory": {},
        "observedThresholds": {}
    }

def main():
    print("Fetching live FPL bootstrap telemetry...")
    bootstrap = fetch_fpl_bootstrap()
    elements = bootstrap.get("elements", [])
    if not elements:
        print("Error: No elements found in FPL bootstrap.")
        return

    snapshot_data = load_existing_snapshots()
    current_uk_day = get_today_uk_date_string()
    now_ms = int(time.time() * 1000)

    is_new_day = snapshot_data.get("lastPriceChangeDate") != current_uk_day
    if is_new_day:
        print(f"🌅 New Trading Day Detected: {current_uk_day} (Previous: {snapshot_data.get('lastPriceChangeDate')})")
        snapshot_data["lastPriceChangeDate"] = current_uk_day

    baselines = snapshot_data.setdefault("baselines", {})
    hourly_history = snapshot_data.setdefault("hourlyHistory", {})
    observed_thresholds = snapshot_data.setdefault("observedThresholds", {})

    changes_detected = []

    for p in elements:
        p_id = str(p.get("id"))
        current_cost = p.get("now_cost", 50)
        current_in = p.get("transfers_in_event", 0) or 0
        current_out = p.get("transfers_out_event", 0) or 0

        baseline = baselines.get(p_id)

        if baseline:
            prev_cost = baseline.get("cost", current_cost)
            # 1. Price Change Trigger Detection
            if current_cost != prev_cost:
                net_at_change = (current_in - baseline.get("transfersIn", 0)) - (current_out - baseline.get("transfersOut", 0))
                change_type = "rise" if current_cost > prev_cost else "fall"
                obs_key = f"{change_type}_{p_id}_{current_uk_day}"
                observed_thresholds[obs_key] = abs(net_at_change)

                p_name = p.get("web_name", p_id)
                delta_sign = "+" if current_cost > prev_cost else "-"
                diff = abs(current_cost - prev_cost) / 10.0
                print(f"⚡ Price Change Detected: {p_name} ({delta_sign}£{diff:.1f}m) | Recorded Trigger Net: {net_at_change}")
                changes_detected.append(f"{p_name} ({delta_sign}£{diff:.1f}m)")

                # Reset baseline to fresh transfer count
                baseline = {
                    "cost": current_cost,
                    "transfersIn": current_in,
                    "transfersOut": current_out,
                    "timestamp": now_ms,
                    "lastCostChangeDate": current_uk_day
                }
                baselines[p_id] = baseline

            elif is_new_day:
                # Daily rollover: carry forward current cost, reset base if needed
                pass
        else:
            # First initialization
            baselines[p_id] = {
                "cost": current_cost,
                "transfersIn": current_in,
                "transfersOut": current_out,
                "timestamp": now_ms
            }
            baseline = baselines[p_id]

        # 2. Hourly Velocity History
        in_today = max(0, current_in - baseline.get("transfersIn", 0))
        out_today = max(0, current_out - baseline.get("transfersOut", 0))
        net_today = in_today - out_today

        p_history = hourly_history.setdefault(p_id, [])
        last_pt = p_history[-1] if p_history else None

        # Append data point if >= 40 mins since last point
        if not last_pt or (now_ms - last_pt.get("time", 0) > 40 * 60 * 1000):
            p_history.append({
                "time": now_ms,
                "transfersIn": current_in,
                "transfersOut": current_out,
                "net": net_today
            })
            # Keep up to 36 points (last ~24-36h)
            if len(p_history) > 36:
                hourly_history[p_id] = p_history[-36:]

    snapshot_data["lastUpdated"] = datetime.now(timezone.utc).isoformat()

    # Save to src/data/price_snapshots.json
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as fp:
        json.dump(snapshot_data, fp, indent=2)

    # Also save to .data/ if exists
    local_dir = os.path.dirname(LOCAL_DATA_FILE)
    if os.path.exists(local_dir):
        with open(LOCAL_DATA_FILE, 'w', encoding='utf-8') as fp:
            json.dump(snapshot_data, fp, indent=2)

    print(f"✅ Successfully updated price snapshots for {len(elements)} players.")
    if changes_detected:
        print(f"Logged changes: {', '.join(changes_detected)}")

if __name__ == "__main__":
    main()

