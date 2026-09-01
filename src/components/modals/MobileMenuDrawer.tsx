import React from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { ChipType } from '@/types/fpl';
import { 
  Zap, 
  Sparkles, 
  Lightbulb, 
  RotateCcw, 
  Trash2, 
  Edit3, 
  Search, 
  Save, 
  Lock, 
  LayoutGrid, 
  TableProperties,
  TrendingUp,
  AlertTriangle,
  X,
  Layers
} from 'lucide-react';
import { useSquadRating } from '@/hooks/useSquadRating';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImport: () => void;
  onOpenSave: () => void;
  onOpenOverrides: () => void;
  onLogout: () => void;
}

const CHIPS: Array<{ id: ChipType; label: string; desc: string }> = [
  { id: 'wildcard', label: 'WC', desc: 'Wildcard' },
  { id: 'freehit', label: 'FH', desc: 'Free Hit' },
  { id: 'bboost', label: 'BB', desc: 'Bench Boost' },
  { id: '3xc', label: '3TC', desc: 'Triple Captain' },
];

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  onOpenImport,
  onOpenSave,
  onOpenOverrides,
  onLogout,
}) => {
  const { 
    selectedGameweek, 
    gameweekPlans, 
    playedChips, 
    setChip, 
    resetCurrentGameweek, 
    resetAllFutureGameweeks,
    isGameweekLocked,
    currentView,
    setCurrentView,
    fixtureHorizon,
    setFixtureHorizon,
    showAiPredictions,
    openScoutModal,
    activePin,
    isSaving
  } = usePlannerStore();

  const isLocked = isGameweekLocked(selectedGameweek);
  const activePlan = gameweekPlans[selectedGameweek];
  const activeChip = activePlan?.chip || 'none';

  const getChipPlannedGw = (chipId: ChipType): number | null => {
    for (const [gwStr, plan] of Object.entries(gameweekPlans)) {
      const gw = parseInt(gwStr, 10);
      if (plan.chip === chipId) return gw;
    }
    return null;
  };

  const squadRating = useSquadRating();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-[300px] sm:w-[340px] max-w-[85vw] h-full bg-slate-900 border-l border-white/15 p-4 shadow-2xl z-10 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
        <div className="flex flex-col gap-4">
          
          {/* Top Bar Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-white">Strategy &amp; Menu</span>
              {activePin && (
                <span className="text-[10px] bg-slate-950 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  PIN: {activePin}
                </span>
              )}
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Chips Strategy */}
          <div className="flex flex-col gap-2 bg-slate-950/70 p-3 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Active Chip
              </span>
              <span className="text-xs font-black text-emerald-400 font-mono">
                {activeChip !== 'none' ? activeChip.toUpperCase() : 'None'}
              </span>
            </div>

            {!isLocked && (
              <div className="grid grid-cols-4 gap-1.5">
                {CHIPS.map(chip => {
                  const playedInHistory = playedChips.find(c => c.name === chip.id);
                  const isUsed = !!playedInHistory;
                  const isCurrent = activeChip === chip.id;
                  const plannedGw = getChipPlannedGw(chip.id);
                  const isPlannedElsewhere = plannedGw !== null && plannedGw !== selectedGameweek;

                  return (
                    <button
                      key={chip.id}
                      disabled={isUsed || isPlannedElsewhere}
                      onClick={() => setChip(isCurrent ? 'none' : chip.id)}
                      className={`py-2 rounded-xl border text-xs font-black transition-all flex flex-col items-center justify-center ${
                        isCurrent
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                          : isUsed || isPlannedElsewhere
                          ? 'bg-slate-900/40 border-white/5 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-900 border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-white'
                      }`}
                      title={chip.desc}
                    >
                      <span>{chip.label}</span>
                      <span className="text-[8px] font-bold opacity-75">
                        {isUsed ? 'Used' : isPlannedElsewhere ? `GW${plannedGw}` : chip.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Navigation & Views */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Views</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                onClick={() => {
                  setCurrentView('pitch');
                  onClose();
                }}
                className={`flex items-center justify-center gap-1 p-2 rounded-xl border text-[11px] font-black transition ${
                  currentView === 'pitch'
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                    : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Pitch</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView('matrix');
                  onClose();
                }}
                className={`flex items-center justify-center gap-1 p-2 rounded-xl border text-[11px] font-black transition ${
                  currentView === 'matrix'
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                    : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <TableProperties className="w-3 h-3" />
                <span>Matrix</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView('rotation');
                  onClose();
                }}
                className={`flex items-center justify-center gap-1 p-2 rounded-xl border text-[11px] font-black transition ${
                  currentView === 'rotation'
                    ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md font-extrabold'
                    : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Rotation</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView('analytics');
                  onClose();
                }}
                className={`flex items-center justify-center gap-1 p-2 rounded-xl border text-[11px] font-black transition ${
                  currentView === 'analytics'
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                    : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                <span>AI Alpha</span>
              </button>

              {typeof window !== 'undefined' && localStorage.getItem('vibes_lab_mode') === 'true' && (
                <button
                  onClick={() => {
                    setCurrentView('lab');
                    onClose();
                  }}
                  className={`flex items-center justify-center gap-1 p-2 rounded-xl border text-[11px] font-black transition col-span-3 ${
                    currentView === 'lab'
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-600 border-purple-400 text-white shadow-md'
                      : 'bg-slate-950 border-purple-500/30 text-purple-300 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>🧪 Private ML Lab (A/B Shootout)</span>
                </button>
              )}
            </div>
          </div>

          {/* 3. Team Management Tools */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Management Tools</span>
            
            <button
              onClick={() => {
                onOpenOverrides();
                onClose();
              }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-white/10 text-left text-xs font-bold text-slate-200 transition"
            >
              <Edit3 className="w-4 h-4 text-cyan-400" />
              <span>Edit Bank &amp; FTs Overrides</span>
            </button>

            <button
              onClick={() => {
                onOpenImport();
                onClose();
              }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-white/10 text-left text-xs font-bold text-slate-200 transition"
            >
              <Search className="w-4 h-4 text-emerald-400" />
              <span>Import FPL Team ID</span>
            </button>

            <button
              onClick={() => {
                onOpenSave();
                onClose();
              }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-white/10 text-left text-xs font-bold text-slate-200 transition"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>Saved Plans &amp; PIN Sync</span>
            </button>
          </div>

          {/* 4. Secret AI Lab Tools (When Unlocked) */}
          {showAiPredictions && (
            <div className="flex flex-col gap-2 bg-slate-950/70 p-3 rounded-2xl border border-emerald-500/40 animate-in fade-in">
              <span className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                AI Intelligence Lab
              </span>

              {squadRating && (
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Team Rating:</span>
                  <span className="text-emerald-300 font-mono font-black">{squadRating.overallPercentage}%</span>
                </div>
              )}

              <button
                onClick={() => {
                  openScoutModal();
                  onClose();
                }}
                className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                <span>Open AI Transfer Radar</span>
              </button>

              <button
                onClick={() => {
                  openScoutModal(undefined, undefined, undefined, 'optimal_squad');
                  onClose();
                }}
                className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>🔮 Strongest Team Solver</span>
              </button>
            </div>
          )}

          {/* 5. Horizon Selector */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-white/10">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Horizon:
            </span>
            <div className="flex items-center gap-1">
              {[1, 3, 5].map((hz) => (
                <button
                  key={hz}
                  onClick={() => setFixtureHorizon(hz as 1 | 3 | 5)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                    fixtureHorizon === hz 
                      ? 'bg-emerald-600 text-white shadow' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {hz}GW
                </button>
              ))}
            </div>
          </div>

          {/* 6. Reset Controls */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
            <button
              onClick={() => {
                if (confirm(`Reset Gameweek ${selectedGameweek} plan to default?`)) {
                  resetCurrentGameweek();
                  onClose();
                }
              }}
              className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-amber-400 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset GW {selectedGameweek}
            </button>

            <button
              onClick={() => {
                if (confirm('Reset ALL future gameweek plans back to the base team?')) {
                  resetAllFutureGameweeks();
                  onClose();
                }
              }}
              className="w-full py-1 text-xs text-slate-500 hover:text-rose-400 transition flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Reset All Future GWs
            </button>
          </div>

        </div>

        {/* Bottom Lock / PIN */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>{isSaving ? 'Syncing...' : 'Saved to Cloud'}</span>
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-300 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Switch PIN</span>
          </button>
        </div>

      </div>
    </div>
  );
};

