import React, { useState } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { X, RotateCcw } from 'lucide-react';

interface OverridesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OverridesModal: React.FC<OverridesModalProps> = ({ isOpen, onClose }) => {
  const { 
    selectedGameweek, 
    gameweekPlans, 
    setBankOverride, 
    setFreeTransfersOverride 
  } = usePlannerStore();

  const plan = gameweekPlans[selectedGameweek];
  const [bankInput, setBankInput] = useState<string>(
    plan?.calculatedBank !== undefined ? (plan.calculatedBank / 10).toString() : '0.0'
  );
  const [ftInput, setFtInput] = useState<string>(
    plan?.availableTransfers !== undefined ? plan.availableTransfers.toString() : '1'
  );

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !plan) return null;

  const handleSave = () => {
    const parsedBank = parseFloat(bankInput);
    const parsedFt = parseInt(ftInput, 10);

    if (!isNaN(parsedBank)) {
      setBankOverride(selectedGameweek, Math.round(parsedBank * 10));
    }
    if (!isNaN(parsedFt) && parsedFt >= 0) {
      setFreeTransfersOverride(selectedGameweek, Math.min(5, parsedFt));
    }
    onClose();
  };

  const handleResetOverrides = () => {
    setBankOverride(selectedGameweek, null);
    setFreeTransfersOverride(selectedGameweek, null);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h3 className="text-base font-bold text-white">
            Edit Gameweek {selectedGameweek} Overrides
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-xs text-slate-300">
          <div>
            <label className="block font-bold text-slate-200 mb-1">
              Projected Bank (£m)
            </label>
            <input
              type="number"
              step="0.1"
              value={bankInput}
              onChange={(e) => setBankInput(e.target.value)}
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. 1.5"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Override remaining bank balance for future gameweek calculations.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-200 mb-1">
              Available Free Transfers (0 - 5)
            </label>
            <input
              type="number"
              min="0"
              max="5"
              value={ftInput}
              onChange={(e) => setFtInput(e.target.value)}
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. 2"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Override available free transfers count (2026/27 rule max is 5).
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <button
            onClick={handleResetOverrides}
            className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Auto
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
