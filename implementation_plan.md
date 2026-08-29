# OpenFPL Prediction Accuracy & Calibration Plan

## 🔍 Why Some Numbers Looked Off

When we examined the initial numbers (e.g. *De Cuyper 13.2 xP*, *Cherki 12.4 xP*), we identified why they were skewed:
1. **FPL Cumulative Metric Bug**: The official FPL API returns `threat` and `creativity` as cumulative season totals (e.g., 150–400 points). Without dividing by games played (per 90 mins), players with high raw stats got inflated additive bonuses.
2. **Normal OpenFPL Realistic Range**: Authentic OpenFPL expected points typically range between **2.0 and 8.0 xP** per match (e.g. Haaland ~4.5–6.0 xP, Saka ~4.5–5.5 xP, Defenders ~2.5–4.5 xP).

---

## 📊 Side-by-Side Comparison: OpenFPL Official API vs Initial Script

| Player | Position | Official OpenFPL Model xP | What Initial Script Produced | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Erling Haaland** | FWD | **4.55** | 7.8 | ⚠️ Inflated |
| **Bruno Fernandes** | MID | **4.08** | 6.2 | ⚠️ Inflated |
| **Antoine Semenyo** | MID | **3.78** | 5.8 | ⚠️ Inflated |
| **João Pedro** | FWD | **3.55** | 5.1 | ⚠️ Inflated |
| **Dominik Szoboszlai** | MID | **3.31** | 4.9 | ⚠️ Inflated |
| **Bryan Mbeumo** | MID | **3.24** | 5.4 | ⚠️ Inflated |
| **Riccardo Calafiori** | DEF | **3.10** | 4.6 | ⚠️ Inflated |
| **Gabriel** | DEF | **2.73** | 3.8 | ⚠️ Inflated |
| **Maxence Lacroix** | DEF | **2.57** | 3.5 | ⚠️ Inflated |

---

## 🛠️ Proposed Solution & Calibration Plan

### 1. Calibrate Python ML Script (`scripts/generate_openfpl_ml.py`)
* **Per-90 Normalization**: Divide cumulative ICT/Threat/Creativity by games played (`minutes / 90`) rather than using raw totals.
* **Match Official OpenFPL Baseline Bounds**:
  * Forwards: $2.5 - 7.5\text{ xP}$
  * Midfielders: $2.2 - 6.8\text{ xP}$
  * Defenders: $1.8 - 4.8\text{ xP}$
  * Goalkeepers: $2.0 - 4.5\text{ xP}$
* **Direct Integration Option**: Incorporate live predictions from OpenFPL's official API (`https://openfpl.kassem.dev/api/scout`) for the target Gameweek, and use calibrated decay for future Gameweeks.

### 2. Re-run GitHub Cloud Action
* Trigger the GitHub Action to regenerate `src/data/openfpl_predictions.json` with the perfectly calibrated numbers.

### 3. Verify in UI
* Verify that Haaland shows ~4.5–5.5 xP, Salah/Palmer show ~4.5–5.5 xP, and defenders show realistic ~2.5–4.0 xP.
