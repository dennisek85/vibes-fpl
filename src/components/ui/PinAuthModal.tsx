'use client';

import React, { useState, useEffect } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { Lock, ShieldAlert, KeyRound, Delete, Loader2, Hash } from 'lucide-react';

interface PinAuthModalProps {
  onSuccess: (isNewUser: boolean) => void;
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({ onSuccess }) => {
  const { loadUserPlanByPin, importTeam } = usePlannerStore();
  const [teamIdInput, setTeamIdInput] = useState('');
  const [pin, setPin] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedTeamId = localStorage.getItem('fpl_last_team_id');
        if (savedTeamId) setTeamIdInput(savedTeamId);
      }
    } catch {}
  }, []);

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
      setErrorMessage('Please enter at least 4 digits.');
      return;
    }

    setIsChecking(true);
    setError(false);
    try {
      const parsedTeamId = teamIdInput.trim() ? parseInt(teamIdInput.trim(), 10) : null;
      if (parsedTeamId && !isNaN(parsedTeamId)) {
        try {
          localStorage.setItem('fpl_last_team_id', String(parsedTeamId));
        } catch {}
      }

      const result = await loadUserPlanByPin(inputPin, parsedTeamId);
      
      // If team wasn't loaded from PIN but user provided a Team ID, auto-import that team!
      if (!result.teamLoaded && parsedTeamId && !isNaN(parsedTeamId)) {
        await importTeam(parsedTeamId);
        setIsChecking(false);
        onSuccess(false);
        return;
      }

      setIsChecking(false);
      onSuccess(!result.teamLoaded);
    } catch {
      setIsChecking(false);
      setError(true);
      setErrorMessage('Could not load plan. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center">
        {/* Shield Icon Header */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-emerald-950/60 mb-3">
          <Lock className="w-6 h-6" />
        </div>

        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
          Enter PIN Workspace
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 mb-4">
          Enter your 4-digit PIN to load or create your isolated squad plan.
        </p>

        {/* Optional Team ID Input */}
        <div className="w-full max-w-[260px] mb-4">
          <label className="text-[11px] font-bold text-slate-400 block text-left mb-1 flex items-center gap-1">
            <Hash className="w-3.5 h-3.5 text-emerald-400" />
            FPL Team ID <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
          </label>
          <input
            type="number"
            value={teamIdInput}
            onChange={(e) => setTeamIdInput(e.target.value)}
            placeholder="e.g. 1234567"
            className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* PIN Dot Indicators */}
        <div className={`flex items-center gap-3 mb-5 ${error ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 border-2 ${
                pin.length > idx
                  ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-md shadow-emerald-500/50'
                  : 'bg-slate-950 border-slate-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-3 text-xs font-bold text-rose-400 bg-rose-950/80 px-3 py-1.5 rounded-xl border border-rose-500/40 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            {errorMessage || 'Please enter at least 4 digits.'}
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-[260px] mb-3.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              disabled={isChecking}
              onClick={() => handleDigit(num)}
              className="py-2.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800 text-white font-bold text-base border border-white/10 shadow transition-all active:scale-90 select-none disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={isChecking}
            onClick={() => { setPin(''); setError(false); }}
            className="py-2.5 rounded-2xl bg-slate-950/40 hover:bg-slate-800 text-slate-400 font-bold text-xs border border-white/5 transition-all select-none"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={isChecking}
            onClick={() => handleDigit('0')}
            className="py-2.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800 text-white font-bold text-base border border-white/10 shadow transition-all active:scale-90 select-none disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={isChecking}
            onClick={handleBackspace}
            className="py-2.5 rounded-2xl bg-slate-950/40 hover:bg-slate-800 text-slate-400 flex items-center justify-center border border-white/5 transition-all active:scale-90 select-none"
          >
            <Delete className="w-4 h-4" />
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
              Loading workspace...
            </>
          ) : (
            <>
              <KeyRound className="w-4 h-4" />
              Unlock / Create Workspace
            </>
          )}
        </button>

        {/* Quick Start with Default Team Button */}
        <div className="w-full max-w-[260px] mt-3 pt-3 border-t border-white/10">
          <button
            type="button"
            disabled={isChecking}
            onClick={async () => {
              setPin('1234');
              await submitPin('1234');
            }}
            className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 hover:text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow"
          >
            <span>⚡ Quick Start with Default Team</span>
          </button>
        </div>

        <p className="text-[10px] text-slate-500 mt-2.5">
          🔒 Entering your Team ID + PIN pairs your plan uniquely to your team.
        </p>
      </div>
    </div>
  );
};