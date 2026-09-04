# 🧭 Vibes FPL — AI Agent Flight Manual

## 🏛️ Architecture & Data Flow
```
Official FPL API ──> Next.js Proxies (/api/fpl/*) ──> Zustand (usePlannerStore) ──> UI
                                                             │
                                   ┌─────────────────────────┴────────────────────────┐
                                   ▼                                                  ▼
                    Persistence (Redis KV / .data/)                      ML & Solvers (src/utils/*)
```
- **Cloud Scraper**: GitHub Actions (`track_price_changes.yml`) syncs odds, form, prices & ownership directly to **Upstash Redis** every 2 hours (0 Git commits).

## ⚡ Core Engineering Rules
1. **PowerShell 5.1**: ALWAYS use `;` to chain commands (never `&&` / `||`). Use `$env:VAR="val"; cmd` for env vars.
2. **NEVER Auto-Launch Git Commands**: NEVER automatically run ANY Git commands (`git add`, `git commit`, `git push`, `git status`, `git diff`, etc.). ALWAYS keep code changes in your local working tree for the user to test and verify in the browser. Always let the user propose and explicitly instruct any Git action when they are completely satisfied with their testing.
3. **Safe File Editing**: For small targeted edits use `replace_file_content`, but ALWAYS view the exact target lines immediately before replacing them. For any multi-section rewrite or structurally complex file, use PowerShell `Set-Content` to write the complete correct file atomically — this avoids cascading partial-edit corruption from stale TargetContent matches.
4. **Disambiguation**: Verify `player.element_type` and `teamShortName` when matching odds/set-pieces (e.g. Cole Palmer CHE vs backup GK Palmer IPS).
5. **Verification**: Always run `npm run check` before completing work.
6. **Communication**: ALWAYS explain WHAT you are doing and WHY before executing changes or running commands.
7. **Zero Unused Code**: Strictly eliminate all unused imports, destructured store variables, parameters, and dead code. Enforced by TypeScript (`noUnusedLocals`, `noUnusedParameters`) & ESLint (`@typescript-eslint/no-unused-vars`).
8. **UI Text Centralization**: NEVER hardcode user-facing strings, descriptions, labels, or badges directly in UI components. ALWAYS define and import them from `src/lib/ui-text.ts` (`UI_TEXT`).
9. **Single Source of Truth (Zero Duplicate Calculations)**: NEVER calculate the same metric, ML feature, or risk score independently in multiple places with divergent parameters. ALWAYS compute metrics once in `usePlannerStore` (or shared core utils) and have all UI components, modals, and solver algorithms read from that single canonical source of truth.
10. **Zero Forced/Hardcoded Outcomes (Pure Organic Math)**: NEVER hardcode arbitrary player bonuses, force artificial team selections, or fudge numbers to match external tools. ALWAYS optimize predictions and squad selection organically through sound mathematical modeling (Poisson goal expectancies, Bayesian rate regressions, empirical home/away clean sheet frequencies, and pure knapsack algorithms).

## 📚 Skills Catalog (On-Demand)
- **ML & xP Engine**: [`.agents/skills/fpl-ml-engine/SKILL.md`](.agents/skills/fpl-ml-engine/SKILL.md) (`aiOddsEngine.ts`, `oddsTracker.ts`, `setPieces.ts`, `formTracker.ts`)
- **Squad Optimizers**: [`.agents/skills/fpl-squad-optimizers/SKILL.md`](.agents/skills/fpl-squad-optimizers/SKILL.md) (`aiOptimalSquadSolver.ts`, `aiTransferScout.ts`)
- **Price Predictor**: [`.agents/skills/fpl-price-predictor/SKILL.md`](.agents/skills/fpl-price-predictor/SKILL.md) (`aiPricePredictor.ts`, `track_fpl_prices.js`)
- **UI & State**: [`.agents/skills/fpl-ui-architecture/SKILL.md`](.agents/skills/fpl-ui-architecture/SKILL.md) (`usePlannerStore.ts`, `FootballPitch.tsx`, `AiScoutModal.tsx`, `user-plan/route.ts`)
