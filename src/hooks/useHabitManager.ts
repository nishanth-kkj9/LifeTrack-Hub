/**
 * Habit Manager Hook
 * Manages habit CRUD, scoring, and streak calculations via canonical habitScoring engine.
 */

import { useCallback } from 'react';
import { Habit, DailyLifeMetric } from '../types/index.ts';
import { getHabitStats } from '../lib/habitScoring.ts';
import { touch, tombstone, isActive } from '../lib/entity.ts';

export interface UseHabitManagerOptions {
  habits: Habit[];
  dailyMetrics?: DailyLifeMetric[];
  onUpdate: (habits: Habit[]) => void;
}

export function useHabitManager({ habits, onUpdate }: UseHabitManagerOptions) {
  const toggleHabitDate = useCallback(
    (habitId: string, dateStr: string) => {
      const updated = habits.map((h) => {
        if (h.id !== habitId) return h;

        const currentDates = h.completedDates || [];
        const isDone = currentDates.includes(dateStr);
        const nextCompletedDates = isDone
          ? currentDates.filter((d) => d !== dateStr)
          : [...currentDates, dateStr];

        const nextDraft: Habit = {
          ...h,
          completedDates: nextCompletedDates,
        };
        const stats = getHabitStats(nextDraft);

        return touch({
          ...nextDraft,
          streak: stats.currentStreak,
          bestStreak: Math.max(stats.bestStreak, h.bestStreak || 0),
          habitScore: stats.strengthScore,
          habitHealth: stats.healthLabel,
        });
      });

      onUpdate(updated);
    },
    [habits, onUpdate]
  );

  const addHabit = useCallback(
    (newHabit: Habit) => {
      const stats = getHabitStats(newHabit);
      const habitWithScore: Habit = touch({
        ...newHabit,
        streak: stats.currentStreak,
        bestStreak: Math.max(stats.bestStreak, newHabit.bestStreak || 0),
        habitScore: stats.strengthScore,
        habitHealth: stats.healthLabel,
      });

      onUpdate([...habits, habitWithScore]);
    },
    [habits, onUpdate]
  );

  const deleteHabit = useCallback(
    (habitId: string) => {
      onUpdate(habits.map((h) => (h.id === habitId ? tombstone(h) : h)));
    },
    [habits, onUpdate]
  );

  const updateHabit = useCallback(
    (updatedHabit: Habit) => {
      const stats = getHabitStats(updatedHabit);

      onUpdate(
        habits.map((h) =>
          h.id === updatedHabit.id
            ? touch({
                ...updatedHabit,
                streak: stats.currentStreak,
                bestStreak: Math.max(stats.bestStreak, updatedHabit.bestStreak || 0),
                habitScore: stats.strengthScore,
                habitHealth: stats.healthLabel,
              })
            : h
        )
      );
    },
    [habits, onUpdate]
  );

  const getHabitsWithScores = useCallback(() => {
    return habits.filter(isActive).map((h) => {
      const stats = getHabitStats(h);

      return {
        ...h,
        streak: stats.currentStreak,
        bestStreak: Math.max(stats.bestStreak, h.bestStreak || 0),
        habitScore: stats.strengthScore,
        habitHealth: stats.healthLabel,
      };
    });
  }, [habits]);

  return {
    toggleHabitDate,
    addHabit,
    deleteHabit,
    updateHabit,
    getHabitsWithScores,
  };
}

export default useHabitManager;
