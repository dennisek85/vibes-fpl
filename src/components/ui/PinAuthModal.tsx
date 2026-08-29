import React, { useState } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { Lock, ShieldAlert, KeyRound, Delete, Loader2 } from 'lucide-react';

interface PinAuthModalProps {
  onSuccess: (isNewUser: boolean) => void;
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({ onSuccess }) => {
  const { loadUserPlanByPin } = usePlannerStore();
  const [pin, setPin] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(false);

  const handleDigit = async (digit: string) => {
    if (pin.length < 6 && !isChecking) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);

      if (newPin.length === 4) {
        await submitPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (!isChecking) {
      setPin(prev => prev.slice(0, -1));
      setError(false);
    }
  };

  const submitPin = async (inputPin: string) => {
    if (inputPin.trim().length < 4) {
      setError(true);
      return;
    }

    setIsChecking(true);
    try {
      const result = await loadUserPlanByPin(inputPin);
      setIsChecking(false);
      onSuccess(!result.teamLoaded);
    } catch {
      setIsChecking(false);
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
        {/* Shield Icon Header */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-emerald-950/60 mb-4">
          <Lock className="w-7 h-7" />
        </div>

        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
          Enter Personal PIN
        </h2>
        <p className="text-xs text-slate-400 mt-1 mb-5">
          Enter your 4-digit PIN to load your saved transfers and strategy from any device.
        </p>

        {/* PIN Dot Indicators */}
        <div className={`flex items-center gap-3 mb-6 ${error ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                pin.length > idx
                  ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-md shadow-emerald-500/50'
                  : 'bg-slate-950 border-slate-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 text-xs font-bold text-rose-400 bg-rose-950/80 px-3 py-1.5 rounded-xl border border-rose-500/40 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            Please enter at least 4 digits.
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[260px] mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              disabled={isChecking}
              onClick={() => handleDigit(num)}
              className="py-3 rounded-2xl bg-slate-950/80 hover:bg-slate-800 text-white font-bold text-lg border border-white/10 shadow transition-all active:scale-90 select-none disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={isChecking}
            onClick={() => { setPin(''); setError(false); }}
            className="py-3 rounded-2xl bg-slate-950/40 hover:bg-slate-800 text-slate-400 font-bold text-xs border border-white/5 transition-all select-none"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={isChecking}
            onClick={() => handleDigit('0')}
            className="py-3 rounded-2xl bg-slate-950/80 hover:bg-slate-800 text-white font-bold text-lg border border-white/10 shadow transition-all active:scale-90 select-none disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={isChecking}
            onClick={handleBackspace}
            className="py-3 rounded-2xl bg-slate-950/40 hover:bg-slate-800 text-slate-400 flex items-center justify-center border border-white/5 transition-all active:scale-90 select-none"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          disabled={isChecking || pin.length < 4}
          onClick={() => submitPin(pin)}
          className="w-full max-w-[260px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isChecking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your plan...
            </>
          ) : (
            <>
              <KeyRound className="w-4 h-4" />
              Unlock / Create Workspace
            </>
          )}
        </button>

        <p className="text-[10px] text-slate-500 mt-4">
          💡 Any 4-digit number creates your personal private workspace.
        </p>
      </div>
    </div>
  );
};