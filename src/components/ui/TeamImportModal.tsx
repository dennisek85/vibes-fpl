import React, { useState } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { X, Search, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

interface TeamImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamImportModal: React.FC<TeamImportModalProps> = ({ isOpen, onClose }) => {
  const { importTeam, loadDemoTeam, isLoading, error } = usePlannerStore();
  const [teamIdInput, setTeamIdInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const id = parseInt(teamIdInput.trim(), 10);
    if (isNaN(id) || id <= 0) {
      setLocalError('Please enter a valid FPL Team ID (numeric number).');
      return;
    }

    const success = await importTeam(id);
    if (success) {
      onClose();
    }
  };

  const handleDemo = () => {
    loadDemoTeam();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl p-6 shadow-2xl cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Import FPL Team</h3>
              <p className="text-xs text-slate-400">Enter your official FPL ID number</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {(error || localError) && (
          <div className="my-3 p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleImport} className="py-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              FPL Team ID
            </label>
            <input
              type="text"
              pattern="[0-9]*"
              value={teamIdInput}
              onChange={(e) => setTeamIdInput(e.target.value)}
              placeholder="e.g. 581293"
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              ?? You can find your Team ID in the URL on fantasy.premierleague.com under &quot;Points&quot; tab: 
              <span className="font-mono text-slate-300"> /entry/<strong>[Team ID]</strong>/event/...</span>
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading Squad...
                </>
              ) : (
                'Import Squad'
              )}
            </button>

            <button
              type="button"
              onClick={handleDemo}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Load Sample Team (Instant Demo)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
