import React, { useState, useEffect } from "react";
import { usePlannerStore } from "@/store/usePlannerStore";
import { X, Save, FolderOpen, Check } from "lucide-react";
import { SavedPlan } from "@/types/fpl";

interface SavePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SavePlanModal: React.FC<SavePlanModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { teamSummary, startGameweek, gameweekPlans } = usePlannerStore();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [planName, setPlanName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
      if (teamSummary) {
        setPlanName(`${teamSummary.name} - Plan`);
      }
    }
  }, [isOpen, teamSummary]);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamSummary) return;

    setIsSaving(true);
    try {
      const planPayload: SavedPlan = {
        id: `plan_${teamSummary.id}_${Date.now()}`,
        teamId: teamSummary.id,
        teamName: planName.trim() || teamSummary.name,
        managerName: `${teamSummary.player_first_name} ${teamSummary.player_last_name}`,
        savedAt: new Date().toISOString(),
        startGameweek,
        gameweekPlans,
      };

      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planPayload),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        fetchPlans();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadPlan = (plan: SavedPlan) => {
    usePlannerStore.setState({
      teamSummary: {
        id: plan.teamId,
        name: plan.teamName,
        player_first_name: plan.managerName.split(" ")[0] || "Manager",
        player_last_name: plan.managerName.split(" ").slice(1).join(" ") || "",
        summary_overall_points: 0,
        summary_overall_rank: 0,
        current_event: plan.startGameweek,
      },
      startGameweek: plan.startGameweek,
      selectedGameweek: plan.startGameweek,
      gameweekPlans: plan.gameweekPlans,
    });
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
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Save / Load Plans
              </h3>
              <p className="text-xs text-slate-400">
                Manage saved strategies for your team
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Save Current Plan Section */}
        <form
          onSubmit={handleSave}
          className="py-4 space-y-3 border-b border-white/10"
        >
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">
              Plan Title
            </label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g. Wildcard GW6 Attack"
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || !teamSummary}
            className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                Plan Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Current Multi-GW Strategy"}
              </>
            )}
          </button>
        </form>

        {/* Saved Plans List */}
        <div className="pt-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Saved Plans ({plans.length})
          </h4>
          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {plans.map((p) => (
              <div
                key={p.id}
                onClick={() => handleLoadPlan(p)}
                className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-white/10 cursor-pointer flex items-center justify-between transition-colors group"
              >
                <div>
                  <h5 className="font-bold text-xs text-white group-hover:text-emerald-400">
                    {p.teamName}
                  </h5>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span>{p.managerName}</span>
                    <span>·</span>
                    <span>GW {p.startGameweek}</span>
                    <span>·</span>
                    <span>{new Date(p.savedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 group-hover:bg-emerald-600 group-hover:text-white"
                >
                  Load
                </button>
              </div>
            ))}

            {plans.length === 0 && (
              <p className="text-center py-4 text-xs text-slate-500">
                No saved plans yet. Save your first strategy above!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
