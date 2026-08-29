# Implementation Plan: Comprehensive UX, Design & Layout Overhaul

Transform the entire application into a modern, pitch-first broadcast-grade UI with responsive mobile ergonomics, glassmorphic styling, unified modal designs, and preservation of all AI features and easter eggs.

---

## 🎨 Design System & Visual Language

- **Surfaces**: Deep stadium radial gradients (`#0c2b18` to `#020b06`) and glassmorphic translucent panels (`bg-slate-900/85 backdrop-blur-xl border border-white/12`).
- **Accents**: Neon Emerald (`#00ff85`), Electric Cyan (`#06b6d4`), Amber Gold (`#f59e0b`), and Rose Crimson (`#ff1751`).
- **Typography**: Bold, high-contrast, readable font weights (`font-black` headings, `font-mono` financial numbers).

---

## 🏗️ Architecture & Component Upgrades

### 1. `src/app/page.tsx` (Pitch-First Main Layout & Mobile Dock Carousel)
- **Pitch-First Hierarchy**:
  - Main pitch and starting XI render immediately at the top on both mobile and desktop.
  - Substitutes bench bar positioned directly below the pitch.
- **Top Telemetry Bar**:
  - Compact glass cards for **Free Transfers (`3 / 3`)**, **Bank Balance**, **Gameweek Projected xP**, and **Strategy**.
- **Bottom Action Dock**:
  - **Desktop**: 3-column modular cards for Strategy Chips, AI Scout Launcher, and Lineup Optimizer.
  - **Mobile**: Responsive horizontal 1-card snap carousel with dot pagination.

### 2. `src/components/pitch/FootballPitch.tsx` (Pitch & AI Secret Easter Egg)
- Keep the natural pitch football icon in the centre circle with 1.2s long-press to activate/deactivate the **AI Projections Lab** with animated glow and toast notification.
- Refined pitch lines and subtle stadium grass gradient.

### 3. Harmonized Modals & Flyouts
Update all modals to use matching glassmorphism (`backdrop-blur-xl`), neon accents, rounded-3xl borders, and smooth dismissal ergonomics:
1. **Transfer Market Flyout** (`PlayerMarketDrawer.tsx`)
2. **Player Detail & Fixtures Modal** (`PlayerDetailModal.tsx`)
3. **AI Scout Intelligence Modal** (`AiScoutModal.tsx`)
4. **Import Team Modal** (`TeamImportModal.tsx`)
5. **Save / Load Plans Modal** (`SavePlanModal.tsx`)
6. **Gameweek Overrides Modal** (`OverridesModal.tsx`)

---

## 🔍 Verification Plan

### Automated Tests
- `npm run check` (`tsc --noEmit && next lint`) — 0 errors.

### Manual Verification
- Check `http://localhost:3000` on Desktop and Mobile viewports.
- Test long-press on the football to verify the AI toggle.
- Verify 1-GW, 3-GW, and 5-GW fixture horizons on player cards.
- Test bottom dock carousel swipe/navigation on mobile.
- Open each modal to ensure unified glassmorphic visual consistency and click-outside dismissal.
