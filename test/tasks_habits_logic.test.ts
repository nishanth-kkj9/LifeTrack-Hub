import { parseNaturalLanguageTask } from '../src/lib/todoUtils.ts';
import { getHabitStats } from '../src/lib/habitScoring.ts';
import { getLocalDateOffset, getLocalDateString, getLocalMonthPrefix, parseLocalDate } from '../src/lib/dateUtils.ts';
import { calculateHabitStreaks, generateDueDates } from '../src/lib/schedule.ts';
import { formatCurrency } from '../src/lib/format.ts';
import { Habit } from '../src/types/index.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-unit-1',
    title: 'Daily Study',
    category: 'study',
    streak: 0,
    completedDates: [],
    targetDaysPerWeek: 7,
    createdAt: new Date(2026, 0, 1).getTime(),
    ...overrides,
  };
}

function runTasksHabitsDateTests() {
  console.log('--- Starting Tasks NLP, Habit Scoring & IST Date Logic Tests ---');

  // ------------------------------------------------------------------
  // 1. Task NLP Parser Tests (Fixed reference: Thu Nov 12, 2026)
  // ------------------------------------------------------------------
  console.log('\n[1. Natural Language Task Parser]');
  const refDate = new Date(2026, 10, 12, 10, 0, 0);

  const milk = parseNaturalLanguageTask('Buy low-fat milk', refDate);
  assert(
    milk.title === 'Buy low-fat milk' && milk.priority === 'medium',
    '"Buy low-fat milk" keeps full title and does not misparse "low" as priority'
  );

  const report = parseNaturalLanguageTask('Produce high-quality report', refDate);
  assert(
    report.title === 'Produce high-quality report' && report.priority === 'medium',
    '"Produce high-quality report" keeps full title and does not misparse "high"'
  );

  const pageTask = parseNaturalLanguageTask('Read page 7 at 3pm', refDate);
  assert(
    pageTask.title === 'Read page 7' && pageTask.dueTime === '15:00',
    '"Read page 7 at 3pm" extracts 15:00 and preserves "page 7" in title'
  );

  const momTask = parseNaturalLanguageTask('Call mom 5pm', refDate);
  assert(
    momTask.title === 'Call mom' && momTask.dueTime === '17:00',
    '"Call mom 5pm" extracts 17:00 without "at"'
  );

  const meetTask = parseNaturalLanguageTask('Meet at 15:30', refDate);
  assert(
    meetTask.title === 'Meet' && meetTask.dueTime === '15:30',
    '"Meet at 15:30" extracts 24h time cleanly'
  );

  const tonightTask = parseNaturalLanguageTask('Study tonight at 8', refDate);
  assert(
    tonightTask.title === 'Study' &&
      tonightTask.dueDate === '2026-11-12' &&
      tonightTask.dueTime === '20:00',
    '"Study tonight at 8" sets today date + 20:00 evening time'
  );

  const fullTask = parseNaturalLanguageTask('Submit lab report tomorrow !1 #study ~45m', refDate);
  assert(
    fullTask.title === 'Submit lab report' &&
      fullTask.dueDate === '2026-11-13' &&
      fullTask.priority === 'urgent' &&
      fullTask.category === 'study' &&
      fullTask.estimatedMinutes === 45,
    'Full token extraction handles tomorrow, !1, #study, and ~45m'
  );

  const standup = parseNaturalLanguageTask('Standup daily p2', refDate);
  assert(
    standup.recurring === 'daily' && standup.priority === 'high' && standup.title === 'Standup',
    '"Standup daily p2" extracts daily recurrence and p2 -> high'
  );

  const friTask = parseNaturalLanguageTask('Review by fri', refDate);
  assert(
    friTask.dueDate === '2026-11-13' && friTask.title === 'Review',
    '"Review by fri" from Thu Nov 12 resolves to Fri Nov 13'
  );

  const nextMonTask = parseNaturalLanguageTask('Sync next mon', refDate);
  assert(
    nextMonTask.dueDate === '2026-11-16' && nextMonTask.title === 'Sync',
    '"Sync next mon" from Thu Nov 12 resolves to Mon Nov 16'
  );

  const inDaysTask = parseNaturalLanguageTask('Follow up in 3 days', refDate);
  assert(
    inDaysTask.dueDate === '2026-11-15' && inDaysTask.title === 'Follow up',
    '"Follow up in 3 days" adds 3 calendar days (Nov 15)'
  );

  const barePriority = parseNaturalLanguageTask('!low', refDate);
  assert(
    barePriority.title === '!low' && barePriority.priority === 'low',
    'Token-only input falls back to trimmed raw input instead of empty title'
  );

  const asapTask = parseNaturalLanguageTask('Urgent fix asap', refDate);
  assert(
    asapTask.priority === 'urgent',
    'Standalone urgent/asap sets urgent priority'
  );

  const emailAt = parseNaturalLanguageTask('Email @3pm #work', refDate);
  assert(
    emailAt.dueTime === '15:00' && emailAt.category === 'work' && emailAt.title === 'Email',
    '@3pm syntax and #work category parsed cleanly'
  );

  // ------------------------------------------------------------------
  // 2. Canonical Habit Scoring Engine (Loop Exponential Model)
  // ------------------------------------------------------------------
  console.log('\n[2. Canonical Habit Scoring & Streaks]');
  const todayStr = '2026-11-12';
  const todayLocal = parseLocalDate(todayStr);

  const staleIgnored = getHabitStats(
    makeHabit({ streak: 99, completedDates: [] }),
    todayStr
  );
  assert(
    staleIgnored.currentStreak === 0 &&
      staleIgnored.bestStreak === 0 &&
      staleIgnored.strengthScore === 0,
    'Ignores stale habit.streak when completedDates is empty'
  );

  const dates30 = Array.from({ length: 30 }, (_, i) => getLocalDateOffset(-i, todayLocal));
  const stats30 = getHabitStats(makeHabit({ completedDates: dates30 }), todayStr);
  assert(
    stats30.strengthScore >= 78 && stats30.strengthScore <= 82,
    `30 consecutive daily completions yields ~80% strength (got ${stats30.strengthScore}%)`
  );
  assert(
    stats30.currentStreak === 30 && stats30.bestStreak === 30 && stats30.healthLabel === 'Excellent',
    '30 consecutive completions sets streak=30 and healthLabel="Excellent"'
  );

  const dates60 = Array.from({ length: 60 }, (_, i) => getLocalDateOffset(-i, todayLocal));
  const stats60 = getHabitStats(makeHabit({ completedDates: dates60 }), todayStr);
  assert(
    stats60.strengthScore >= 94 && stats60.strengthScore <= 97,
    `60 consecutive daily completions yields ~96% strength (got ${stats60.strengthScore}%)`
  );

  const dates90 = Array.from({ length: 90 }, (_, i) => getLocalDateOffset(-i, todayLocal));
  const stats90 = getHabitStats(makeHabit({ completedDates: dates90 }), todayStr);
  assert(
    stats90.strengthScore >= 98 && stats90.strengthScore <= 100,
    `90 consecutive daily completions yields ~99% strength (got ${stats90.strengthScore}%)`
  );

  // Yesterday grace: 5 consecutive days ending yesterday (today not logged yet)
  const yesterdayDates = Array.from({ length: 5 }, (_, i) => getLocalDateOffset(-(i + 1), todayLocal));
  const graceStats = getHabitStats(makeHabit({ completedDates: yesterdayDates }), todayStr);
  assert(
    graceStats.currentStreak === 5 && graceStats.bestStreak === 5,
    `Yesterday grace keeps active streak=5 when today is pending (got ${graceStats.currentStreak})`
  );

  // Weekly target completion rate clamped <= 100
  const weeklyHabit = makeHabit({
    scheduleType: 'weekly_target',
    targetDaysPerWeek: 3,
    completedDates: dates30,
  });
  const weeklyStats = getHabitStats(weeklyHabit, todayStr);
  assert(
    weeklyStats.completionRate === 100 && weeklyStats.completionRate <= 100,
    `Weekly target habit clamps completionRate at 100% instead of >100% (got ${weeklyStats.completionRate}%)`
  );

  // Vacation period preserves streak & strength
  const datesBeforeAfterVac = [
    '2026-11-12',
    '2026-11-11',
    // 2026-11-09..10 on vacation
    '2026-11-08',
    '2026-11-07',
  ];
  const vacHabit = makeHabit({
    completedDates: datesBeforeAfterVac,
    vacationPeriods: [{ startDate: '2026-11-09', endDate: '2026-11-10' }],
  });
  const vacStats = getHabitStats(vacHabit, todayStr);
  assert(
    vacStats.currentStreak === 4 && vacStats.backlogDays === 0,
    `Vacation days preserve active streak=4 without backlog penalty (got streak=${vacStats.currentStreak}, backlog=${vacStats.backlogDays})`
  );

  // ------------------------------------------------------------------
  // 3. IST Local Dates, Schedule Helpers & Currency Formatting
  // ------------------------------------------------------------------
  console.log('\n[3. Local Dates (IST Safe), Schedules & INR Currency]');
  const novFirstMidnight = new Date('2026-11-01T00:30:00+05:30');
  const istMonth = getLocalMonthPrefix(
    process.env.TZ === 'Asia/Kolkata' ? novFirstMidnight : new Date(2026, 10, 1, 0, 30)
  );
  assert(istMonth === '2026-11', `getLocalMonthPrefix returns '2026-11' at midnight IST (got ${istMonth})`);

  assert(
    getLocalDateString(parseLocalDate('2026-11-01')) === '2026-11-01',
    'parseLocalDate -> getLocalDateString round-trips without UTC off-by-one shift'
  );

  const dueWindow = generateDueDates({ startDate: '2026-11-01', timesPerWeek: 7 });
  assert(
    dueWindow.length === 7 && dueWindow[0] === '2026-11-01' && dueWindow[6] === '2026-11-07',
    'generateDueDates generates local YYYY-MM-DD range cleanly'
  );

  const streakCheck = calculateHabitStreaks(
    ['2026-11-12', '2026-11-11', '2026-11-10'],
    refDate
  );
  assert(
    streakCheck.current === 3 && streakCheck.longest === 3,
    'calculateHabitStreaks works deterministically with explicit referenceDate'
  );

  const formattedPos = formatCurrency(1234.5);
  assert(
    formattedPos.includes('₹') && formattedPos.includes('1,234.50'),
    `formatCurrency formats INR with commas and 2 decimals (got ${formattedPos})`
  );

  console.log('\n--- All Tasks, Habits & Date Logic Tests Passed! ---');
}

runTasksHabitsDateTests();
