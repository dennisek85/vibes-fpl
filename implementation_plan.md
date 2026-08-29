# AI Transfer Scout & Market Intelligence Lab Plan

This plan introduces a dedicated, high-power **AI Transfer Scout & Intelligence Hub** powered by our calibrated OpenFPL machine learning engine.

---

## 🎯 Features to Build

### 1. 🔍 Smart Squad Transfers (Budget-Aware & Constraint-Checked)
* Evaluates all legal 1-for-1 transfers for your current 15-man squad against all ~650 Premier League players.
* Checks:
  * **Remaining Bank Balance** (must afford Player IN price).
  * **Max 3 Players Per Club** limit.
  * **Same Position Rule** (GK $\rightarrow$ GK, DEF $\rightarrow$ DEF, etc.).
* Calculates net expected point delta:
  $$\Delta xP = xP_{\text{IN}} - xP_{\text{OUT}}$$
* Allows filtering by:
  * **1-Gameweek Sprint** (Immediate impact for this upcoming deadline).
  * **3-Gameweek Horizon** (Optimal upcoming fixture swing).
  * **5-Gameweek Hold** (Long-term value).
* Includes a **1-Click "Apply Transfer"** button that swaps the players in your gameweek plan automatically!

---

### 2. 🌟 Unconstrained Dream Targets ("The Template & Market Leaders")
* Shows the top target players across the entire Premier League without budget constraints:
  * **Top Projected by Position** (Best GK, DEF, MID, FWD across 1, 3, and 5 GWs).
  * **Value ROI Leaders** (Highest $xP$ per £1.0M budget).
  * **Form & Fixture Momentum** (Players with easiest upcoming FDR runs + high xG/xA).

---

### 3. 🃏 AI Chip Advisor
* **Triple Captain Radar**: Highlights the top 3 single-gameweek captaincy peaks across the next 10 GWs (e.g. Haaland GW6 home = $7.4\text{ xP} \times 3 = 22.2\text{ pts}$).
* **Bench Boost Detector**: Analyzes bench scoring potential and identifies the peak Gameweek for bench points.
* **Wildcard / Free Hit Timing**: Highlights major fixture swing gameweeks where an overhaul provides maximum point gain.

---

## 🖥️ UI / UX Layout

We will create `src/components/modals/AiScoutModal.tsx`:
* Accessible by clicking **`Scout Best Transfer (+xP)`** in the Sidebar or from the Pitch toolbar.
* Tabbed design:
  1. **🎯 My Squad Recommendations** (Tailored transfers with 1-click Apply).
  2. **🌟 Premier League Dream Targets** (Unconstrained top performers & ROI value picks).
  3. **🃏 Chip Strategy Radar** (Optimal Triple Captain, Bench Boost, and Wildcard gameweeks).

---

## 📁 Files to Modify & Create
* **[NEW]** `src/utils/aiTransferScout.ts`: Pure TypeScript transfer evaluator computing $\Delta xP$, budget constraints, and unconstrained market leaders.
* **[NEW]** `src/components/modals/AiScoutModal.tsx`: Rich glassmorphism modal with tabs, stat cards, and 1-click action buttons.
* **[MODIFY]** `src/store/usePlannerStore.ts`: Expose `isScoutModalOpen`, `openScoutModal`, and `closeScoutModal`.
* **[MODIFY]** `src/components/planning/PlannerSidebar.tsx`: Connect `Scout Best Transfer (+xP)` button to launch the new Scout Hub.
