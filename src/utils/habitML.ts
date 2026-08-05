import { UserHabitModel, CategoryHabitData } from '../types';

export const DEFAULT_HABIT_MODEL: UserHabitModel = {
  categories: {
    task: { frictionMultiplier: 1.0, sampleCount: 0 },
    pomodoro_study: { frictionMultiplier: 1.0, sampleCount: 0 },
    chore: { frictionMultiplier: 1.0, sampleCount: 0 },
    study: { frictionMultiplier: 1.0, sampleCount: 0 },
    errands: { frictionMultiplier: 1.0, sampleCount: 0 },
    morningroutine: { frictionMultiplier: 1.0, sampleCount: 0 },
    custom: { frictionMultiplier: 1.0, sampleCount: 0 },
  },
};

/**
  * Normalize category names to map user categories to habit model keys.
  */
export function normalizeCategoryKey(category: string): string {
  if (!category) return 'task';
  const cat = category.trim().toLowerCase();
  if (cat.includes('study') || cat.includes('pomodoro')) return 'pomodoro_study';
  if (cat.includes('errand')) return 'errands';
  if (cat.includes('morning') || cat.includes('routine')) return 'morningroutine';
  if (cat.includes('chore')) return 'chore';
  if (cat.includes('lecture')) return 'lecture';
  return cat;
}

/**
  * Retrieve category friction multiplier from habit model.
  */
export function getCategoryFrictionMultiplier(
  model: UserHabitModel | undefined,
  category: string
): number {
  if (!model || !model.categories) return 1.0;
  const key = normalizeCategoryKey(category);
  const habitData = model.categories[key] || model.categories[category];
  if (!habitData || typeof habitData.frictionMultiplier !== 'number') {
    return 1.0;
  }
  return Math.min(Math.max(habitData.frictionMultiplier, 0.8), 2.5);
}

/**
  * Calculate effective duration for dynamic task or study block applying friction multiplier.
  */
export function getEffectiveTaskDuration(
  model: UserHabitModel | undefined,
  category: string,
  baseDurationMinutes: number
): { effectiveDuration: number; frictionAdded: number; multiplier: number } {
  const multiplier = getCategoryFrictionMultiplier(model, category);
  const effectiveDuration = Math.max(10, Math.round(baseDurationMinutes * multiplier));
  const frictionAdded = effectiveDuration - baseDurationMinutes;
  return { effectiveDuration, frictionAdded, multiplier };
}

/**
  * Exponential Moving Average (EMA) update for category friction multiplier.
  * Formula: newMultiplier = (0.2 * (actualDuration / plannedDuration)) + (0.8 * currentMultiplier)
  */
export function updateHabitFrictionOnTaskDone(
  model: UserHabitModel | undefined,
  category: string,
  plannedDurationMinutes: number,
  actualDurationMinutes: number
): UserHabitModel {
  const currentModel: UserHabitModel = model && model.categories
    ? { ...model, categories: { ...model.categories } }
    : { ...DEFAULT_HABIT_MODEL, categories: { ...DEFAULT_HABIT_MODEL.categories } };

  const key = normalizeCategoryKey(category);

  const planned = Math.max(10, plannedDurationMinutes);
  const actual = Math.max(5, actualDurationMinutes);

  // Bound ratio between 0.5 and 2.5 to avoid single extreme outliers from distorting multipliers
  const rawRatio = actual / planned;
  const boundedRatio = Math.min(Math.max(rawRatio, 0.5), 2.5);

  const currentData: CategoryHabitData = currentModel.categories[key] || {
    frictionMultiplier: 1.0,
    sampleCount: 0,
  };

  const currentMultiplier = currentData.frictionMultiplier ?? 1.0;

  // Rolling EMA calculation as specified
  const rawNewMultiplier = 0.2 * boundedRatio + 0.8 * currentMultiplier;
  const newMultiplier = Math.min(Math.max(rawNewMultiplier, 0.8), 2.5);

  currentModel.categories[key] = {
    frictionMultiplier: Number(newMultiplier.toFixed(3)),
    sampleCount: (currentData.sampleCount || 0) + 1,
    lastUpdated: new Date().toISOString(),
  };

  return currentModel;
}
