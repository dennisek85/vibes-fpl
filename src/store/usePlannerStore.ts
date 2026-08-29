import { create } from 'zustand';
import { PlannerState, PlayedChipInfo, TeamHistoryEvent } from './types';
import { createCoreDataSlice } from './slices/coreDataSlice';
import { createUiStateSlice } from './slices/uiStateSlice';
import { createGameweekPlanSlice } from './slices/gameweekPlanSlice';
import { createPersistenceSlice } from './slices/persistenceSlice';
import { createAiOptimizerSlice } from './slices/aiOptimizerSlice';

export type { PlayedChipInfo, TeamHistoryEvent };

/**
 * Global Planner Zustand Store:
 * Composed cleanly from 5 domain-driven slices (CoreData, UiState, GameweekPlan, Persistence, AiOptimizer)
 */
export const usePlannerStore = create<PlannerState>()((...a) => ({
  ...createCoreDataSlice(...a),
  ...createUiStateSlice(...a),
  ...createGameweekPlanSlice(...a),
  ...createPersistenceSlice(...a),
  ...createAiOptimizerSlice(...a),
}));