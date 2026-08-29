# Codebase Cleanup & Performance Optimization Plan

This plan details the dead-code elimination, performance optimizations, and structural cleanup identified across the project.

---

## 🧹 1. Dead Code & Unused Declarations Cleanup

### A. `src/utils/aiTransferScout.ts`
* **[MODIFY]** Remove unused `teamMap` parameter from `getSmartTransferRecommendations` and update call sites.
* **[MODIFY]** Clean up type definition parameter names (e.g. `_pId`, `_gw`).

### B. Delete Obsolete Component
* **[DELETE]** `src/components/planning/AiScoutModal.tsx` (superseded by `src/components/modals/AiScoutModal.tsx`).

### C. Clean Unused Imports in UI Components
* **[MODIFY]** `src/components/planning/PlannerSidebar.tsx`:
  * Remove unused `FPLPlayer`, `AiScoutModal` import.
  * Remove unneeded store destructuring (`players`, `playerMap`, `teamMap`, `openTransferDrawer`).
* **[MODIFY]** `src/components/modals/AiScoutModal.tsx`:
  * Clean up unused imports (`DollarSign`, `TrendingUp`, `SlidersHorizontal`, etc.).
* **[MODIFY]** `src/components/player/PlayerDetailModal.tsx`:
  * Remove unused icon imports (`Sparkles`, `TrendingUp`, `Shield`, `Award`, `Zap`, `Percent`, `AlertCircle`) and unneeded store variables (`selectedGameweek`, `isGameweekLocked`).
* **[MODIFY]** `src/components/pitch/FootballPitch.tsx`:
  * Remove unused `Sparkles`, `isPressing`, `pressProgress`.
* **[MODIFY]** `src/components/pitch/PlayerCard.tsx` & `BenchBar.tsx`:
  * Remove unused `FPLPlayer`, `isBench`.
* **[MODIFY]** `src/components/ui/OverridesModal.tsx` & `SavePlanModal.tsx`:
  * Remove unused icons (`Check`, `Trash2`, `Calendar`).

---

## ⚡ 2. Performance & Code Optimizations

### A. High-Performance Fast Key Lookup for Projections
* In `usePlannerStore.ts`, avoid string concatenation allocations when looking up player points by caching numeric hash indices or using a direct `Map<number, number>`.

### B. Next.js Image Optimization
* In `src/components/ui/KitIcon.tsx` and `src/components/player/PlayerDetailModal.tsx`, resolve `@next/next/no-img-element` warnings by configuring `<Image />` or clean SVG handling.

### C. Strict ESLint Configuration
* Configure `.eslintrc.json` with clean, production-grade rules with 0 warnings.

---

## 🔍 Verification Plan
1. **Automated Checks**:
   * Run `npm run check` (`tsc --noEmit && next lint`) — must produce **0 errors and 0 warnings**.
   * Run `npm run build` — must produce **`✓ Generating static pages (9/9)`** with 0 errors.
2. **Local Manual Verification**:
   * Verify on `http://localhost:3000` that Pitch cards, AI Scout Modal, Player Modal, Lineup Optimizer, and Theme switcher function smoothly.
