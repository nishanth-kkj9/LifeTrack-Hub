/**
 * Habit Manager Hook
 * Manages habit CRUD, scoring, and streak calculations
 */

import { useCallback } from 'react';
import { Habit, DailyLifeMetric } from '../types/index.ts';
import { calculateHabitScore } from '../lib/habitScore.ts';
import { calculateHabitStreaks, generateDueDates } from '../lib/schedule.ts';
import { getLocalDateString } from '../lib/dateUtils.ts';

export interface UseHabitManagerOptions {
  habits: Habit[];
  dailyMetrics?: DailyLifeMetric[];
  onUpdate: (habits: Habit[]) => void;
}

export function useHabitManager({ habits, dailyMetrics = [], onUpdate }: UseHabitManagerOptions) {
  const toggleHabitDate = useCallback(
    (habitId: string, dateStr: string) => {
      const updated = habits.map((h) => {
        if (h.id !== habitId) return h;

        const currentDates = h.completedDates || [];
        const isDone = currentDates.includes(dateStr);
        const nextCompletedDates = isDone
          ? currentDates.filter((d) => d !== dateStr)
          : [...currentDates, dateStr];

        const streaks = calculateHabitStreaks(nextCompletedDates);
        const dueDateCount = (h.targetDaysPerWeek || 7) * 4;
        const score = calculateHabitScore({
          completions: nextCompletedDates.length,
          totalDueDates: dueDateCount,
          currentStreak: streaks.current,
          longestStreak: streaks.longest,
        });

        return {
          ...h,
          completedDates: nextCompletedDates,
          streak: streaks.current,
          bestStreak: streaks.longest,
          habitScore: score.currentStrength,
          habitHealth: score.healthLabel,
        };
      });

      onUpdate(updated);
    },
    [habits, onUpdate]
  );

  const addHabit = useCallback(
    (newHabit: Habit) => {
      const dueDateCount = (newHabit.targetDaysPerWeek || 7) * 4;
      const score = calculateHabitScore({
        completions: newHabit.completedDates?.length || 0,
        totalDueDates: dueDateCount,
        currentStreak: newHabit.streak || 0,
        longestStreak: newHabit.bestStreak || 0,
      });

      const habitWithScore: Habit = {
        ...newHabit,
        habitScore: score.currentStrength,
        habitHealth: score.healthLabel,
      };

      onUpdate([...habits, habitWithScore]);
    },
    [habits, onUpdate]
  );

  const deleteHabit = useCallback(
    (habitId: string) => {
      onUpdate(habits.filter((h) => h.id !== habitId));
    },
    [habits, onUpdate]
  );

  const updateHabit = useCallback(
    (updatedHabit: Habit) => {
      const dueDateCount = (updatedHabit.targetDaysPerWeek || 7) * 4;
      const score = calculateHabitScore({
        completions: updatedHabit.completedDates?.length || 0,
        totalDueDates: dueDateCount,
        currentStreak: updatedHabit.streak || 0,
        longestStreak: updatedHabit.bestStreak || 0,
      });

      onUpdate(
        habits.map((h) =>
          h.id === updatedHabit.id
            ? { ...updatedHabit, habitScore: score.currentStrength, habitHealth: score.healthLabel }
            : h
        )
      );
    },
    [habits, onUpdate]
  );

  const getHabitsWithScores = useCallback(() => {
    return habits.map((h) => {
      const dueDateCount = (h.targetDaysPerWeek || 7) * 4;
      const score = calculateHabitScore({
        completions: h.completedDates?.length || 0,
        totalDueDates: dueDateCount,
        currentStreak: h.streak || 0,
        longestStreak: h.bestStreak || 0,
      });

      return {
        ...h,
        habitScore: score.currentStrength,
        habitHealth: score.healthLabel,
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
