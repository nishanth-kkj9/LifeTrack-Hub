import { parseNaturalLanguageTask } from '../src/lib/todoUtils.ts';
import {
  HABIT_CATEGORIES,
  expandVacationDates,
  formatCustomDaysLabel,
  getHabitCategoryColor,
  getHabitStats,
  getHabitTodayStatus,
  isHabitDueOnDate,
} from '../src/lib/habitScoring.ts';
import { getLocalDateOffset, getLocalDateString, getLocalMonthPrefix, parseLocalDate } from '../src/lib/dateUtils.ts';
import { calculateHabitStreaks, generateDueDates } from '../src/lib/schedule.ts';
import { formatCurrency } from '../src/lib/format.ts';
import { computeDailyProgress, getTaskDueTimestamp, isOverdue } from '../src/lib/taskUtils.ts';
import {
  classifyMatrixTask,
  isMatrixImportant,
  isMatrixUrgent,
  moveTaskToQuadrant,
} from '../src/lib/matrixUtils.ts';
import {
  DEFAULT_POMODORO_SETTINGS,
  computeRoundedFocusMinutes,
  getNextPomodoroTransition,
  loadPomodoroSettings,
  sanitizePomodoroSettings,
} from '../src/lib/pomodoroUtils.ts';
import { Habit, Task } from '../src/types/index.ts';

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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-unit-1',
    title: 'Sample Task',
    completed: false,
    priority: 'medium',
    category: 'study',
    createdAt: new Date(2026, 10, 1).getTime(),
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

  // Table-driven tests (fixed reference: Thu Nov 12, 2026 10:00 AM unless overridden)
  interface NlpCase {
    input: string;
    ref?: Date;
    expectedTitle: string;
    expectedDueDate?: string;
    expectedDueTime?: string;
    expectedPriority?: 'urgent' | 'high' | 'medium' | 'low';
    expectedRecurring?: 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
  }

  const nlpCases: NlpCase[] = [
    {
      input: 'Practice SAT test',
      expectedTitle: 'Practice SAT test',
      expectedDueDate: '2026-11-12',
    },
    {
      input: "Today's meeting",
      expectedTitle: "Today's meeting",
      expectedDueDate: '2026-11-12',
    },
    {
      input: "Tomorrow's quiz",
      expectedTitle: "Tomorrow's quiz",
      expectedDueDate: '2026-11-12',
    },
    {
      input: 'Read chapter p2 notes',
      expectedTitle: 'Read chapter p2 notes',
      expectedPriority: 'medium',
    },
    {
      input: 'urgent care visit',
      expectedTitle: 'urgent care visit',
      expectedPriority: 'medium',
    },
    {
      input: 'call mom at 3',
      ref: new Date(2026, 10, 12, 10, 0, 0),
      expectedTitle: 'call mom',
      expectedDueTime: '15:00',
    },
    {
      input: 'call mom at 3',
      ref: new Date(2026, 10, 12, 16, 0, 0),
      expectedTitle: 'call mom',
      expectedDueTime: '03:00',
    },
    {
      input: 'submit form 25 Nov',
      expectedTitle: 'submit form',
      expectedDueDate: '2026-11-25',
    },
    {
      input: 'pay rent Nov 25',
      expectedTitle: 'pay rent',
      expectedDueDate: '2026-11-25',
    },
    {
      input: 'plan next week',
      expectedTitle: 'plan',
      expectedDueDate: '2026-11-16', // Mon Nov 16 from Thu Nov 12
    },
    {
      input: 'budget review next month',
      expectedTitle: 'budget review',
      expectedDueDate: '2026-12-12',
    },
    {
      input: 'meet at 5pm on 20 nov',
      expectedTitle: 'meet',
      expectedDueDate: '2026-11-20',
      expectedDueTime: '17:00',
    },
    {
      input: 'Sun cream and Mon ami wed prep',
      expectedTitle: 'Sun cream and Mon ami wed prep',
      expectedDueDate: '2026-11-12',
    },
    {
      input: '!p2 Read chapter notes',
      expectedTitle: 'Read chapter notes',
      expectedPriority: 'high',
    },
  ];

  for (const tc of nlpCases) {
    const parsed = parseNaturalLanguageTask(tc.input, tc.ref ?? refDate);
    assert(
      parsed.title === tc.expectedTitle,
      `[${tc.input}] title === "${tc.expectedTitle}" (got "${parsed.title}")`
    );
    if (tc.expectedDueDate !== undefined) {
      assert(
        parsed.dueDate === tc.expectedDueDate,
        `[${tc.input}] dueDate === "${tc.expectedDueDate}" (got "${parsed.dueDate}")`
      );
    }
    if (tc.expectedDueTime !== undefined) {
      assert(
        parsed.dueTime === tc.expectedDueTime,
        `[${tc.input}] dueTime === "${tc.expectedDueTime}" (got "${parsed.dueTime}")`
      );
    }
    if (tc.expectedPriority !== undefined) {
      assert(
        parsed.priority === tc.expectedPriority,
        `[${tc.input}] priority === "${tc.expectedPriority}" (got "${parsed.priority}")`
      );
    }
    if (tc.expectedRecurring !== undefined) {
      assert(
        parsed.recurring === tc.expectedRecurring,
        `[${tc.input}] recurring === "${tc.expectedRecurring}" (got "${parsed.recurring}")`
      );
    }
  }

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
    stats30.currentStreak === 30 && stats30.bestStreak === 30 && stats30.healthLabel === 'Strong',
    '30 consecutive completions (~80%) sets streak=30 and unified healthLabel="Strong"'
  );

  const dates60 = Array.from({ length: 60 }, (_, i) => getLocalDateOffset(-i, todayLocal));
  const stats60 = getHabitStats(makeHabit({ completedDates: dates60 }), todayStr);
  assert(
    stats60.strengthScore >= 94 && stats60.strengthScore <= 97 && stats60.healthLabel === 'Excellent',
    `60 consecutive daily completions yields ~96% strength and healthLabel="Excellent" (got ${stats60.strengthScore}%)`
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

  // ------------------------------------------------------------------
  // 4. Overdue Task Detection & Due Timestamp Calculation
  // ------------------------------------------------------------------
  console.log('\n[4. Overdue Task Detection & Due Timestamp]');
  const overdueNow = new Date(2026, 10, 12, 10, 30, 0); // 2026-11-12 10:30

  assert(
    isOverdue(makeTask({ dueDate: '2026-11-11' }), overdueNow) === true,
    'isOverdue: uncompleted task with dueDate < today returns true'
  );
  assert(
    isOverdue(makeTask({ dueDate: '2026-11-11', completed: true }), overdueNow) === false,
    'isOverdue: completed task with dueDate < today returns false'
  );
  assert(
    isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: '09:15' }), overdueNow) === true,
    'isOverdue: today task with dueTime < current HH:MM (09:15 < 10:30) returns true'
  );
  assert(
    isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: '9:15' }), overdueNow) === true,
    'isOverdue: today task with single-digit dueTime (9:15 < 10:30) returns true'
  );
  assert(
    isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: '10:30' }), overdueNow) === false,
    'isOverdue: today task with dueTime === current HH:MM (10:30 === 10:30) returns false'
  );
  assert(
    isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: '14:00' }), overdueNow) === false,
    'isOverdue: today task with dueTime > current HH:MM (14:00 > 10:30) returns false'
  );
  assert(
    isOverdue(makeTask({ dueDate: '2026-11-12' }), overdueNow) === false,
    'isOverdue: all-day today task without dueTime returns false'
  );
  assert(
    isOverdue(makeTask({ dueDate: '2026-11-13', dueTime: '01:00' }), overdueNow) === false,
    'isOverdue: future task (dueDate > today) with early dueTime returns false'
  );
  assert(
    isOverdue(makeTask({ dueDate: undefined }), overdueNow) === false,
    'isOverdue: task without dueDate returns false'
  );
  assert(
    isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: '08:00' }), overdueNow.getTime()) === true,
    'isOverdue: accepts numeric epoch ms timestamp for `now`'
  );

  const timedDueMs = getTaskDueTimestamp(makeTask({ dueDate: '2026-11-12', dueTime: '15:45' }));
  assert(
    timedDueMs === new Date(2026, 10, 12, 15, 45, 0, 0).getTime(),
    'getTaskDueTimestamp resolves local date + explicit dueTime accurately'
  );
  const dateOnlyDueMs = getTaskDueTimestamp(makeTask({ dueDate: '2026-11-12' }));
  assert(
    dateOnlyDueMs === new Date(2026, 10, 12, 9, 0, 0, 0).getTime(),
    'getTaskDueTimestamp defaults date-only task to 09:00 local time'
  );

  // ------------------------------------------------------------------
  // 5. Pomodoro Settings, Cycle Transitions & Focus Minute Rounding
  // ------------------------------------------------------------------
  console.log('\n[5. Pomodoro Settings, Cycles & Focus Rounding]');
  const defaultPomo = loadPomodoroSettings();
  assert(
    defaultPomo.focus === 25 &&
      defaultPomo.short === 5 &&
      defaultPomo.long === 15 &&
      defaultPomo.longEvery === 4 &&
      defaultPomo.autoStart === false,
    'loadPomodoroSettings falls back cleanly to default settings (25/5/15/4/false)'
  );

  const sanitizedPomo = sanitizePomodoroSettings({
    focus: 0,
    short: 200,
    long: 30,
    longEvery: -2,
    autoStart: true,
  });
  assert(
    sanitizedPomo.focus === 1 &&
      sanitizedPomo.short === 60 &&
      sanitizedPomo.long === 30 &&
      sanitizedPomo.longEvery === 1 &&
      sanitizedPomo.autoStart === true,
    'sanitizePomodoroSettings clamps bounds and preserves valid fields'
  );

  const pomoSettings = { ...DEFAULT_POMODORO_SETTINGS, longEvery: 4, autoStart: true };
  const t1 = getNextPomodoroTransition('focus', 0, pomoSettings);
  const t2 = getNextPomodoroTransition('focus', 1, pomoSettings);
  const t3 = getNextPomodoroTransition('focus', 2, pomoSettings);
  const t4 = getNextPomodoroTransition('focus', 3, pomoSettings);
  const tBreak = getNextPomodoroTransition('long_break', 4, pomoSettings);
  assert(
    t1.nextMode === 'short_break' &&
      t1.nextFocusCount === 1 &&
      t2.nextMode === 'short_break' &&
      t2.nextFocusCount === 2 &&
      t3.nextMode === 'short_break' &&
      t3.nextFocusCount === 3 &&
      t4.nextMode === 'long_break' &&
      t4.nextFocusCount === 4 &&
      t4.shouldAutoStart === true &&
      tBreak.nextMode === 'focus' &&
      tBreak.nextFocusCount === 4 &&
      tBreak.shouldAutoStart === true,
    'getNextPomodoroTransition sends every longEvery-th focus session to long_break and honors autoStart'
  );

  assert(
    computeRoundedFocusMinutes(0, 30) === 0 &&
      computeRoundedFocusMinutes(29, 30) === 0 &&
      computeRoundedFocusMinutes(30, 30) === 1 &&
      computeRoundedFocusMinutes(89, 30) === 1 &&
      computeRoundedFocusMinutes(90, 30) === 2 &&
      computeRoundedFocusMinutes(1500, 30) === 25,
    'computeRoundedFocusMinutes enforces >=30s threshold and rounds minutes accurately'
  );

  // ------------------------------------------------------------------
  // 6. Eisenhower Matrix Derivation, Quadrant Moves & Daily Progress
  // ------------------------------------------------------------------
  console.log('\n[6. Eisenhower Matrix Derivation & Daily Progress]');
  const matrixNow = new Date(2026, 10, 12, 10, 30, 0); // 2026-11-12 10:30

  assert(
    isMatrixUrgent(makeTask({ dueDate: '2026-11-11' }), matrixNow) === true &&
      isMatrixUrgent(makeTask({ dueDate: '2026-11-12', dueTime: '09:00' }), matrixNow) === true &&
      isMatrixUrgent(makeTask({ dueDate: '2026-11-14' }), matrixNow) === true &&
      isMatrixUrgent(makeTask({ dueDate: '2026-11-15' }), matrixNow) === false &&
      isMatrixUrgent(makeTask({ dueDate: undefined }), matrixNow) === false,
    'isMatrixUrgent derives true for overdue or due within 2 days, false beyond 2 days'
  );

  assert(
    isMatrixImportant(makeTask({ priority: 'urgent', isStarred: false })) === true &&
      isMatrixImportant(makeTask({ priority: 'high', isStarred: false })) === true &&
      isMatrixImportant(makeTask({ priority: 'medium', isStarred: true })) === true &&
      isMatrixImportant(makeTask({ priority: 'medium', isStarred: false })) === false &&
      isMatrixImportant(makeTask({ priority: 'low', isStarred: false })) === false,
    'isMatrixImportant derives true for urgent/high priority or isStarred'
  );

  const q1Sample = makeTask({ dueDate: '2026-11-12', priority: 'high' });
  const q2Sample = makeTask({ dueDate: '2026-11-20', priority: 'medium', isStarred: true });
  const q3Sample = makeTask({ dueDate: '2026-11-13', priority: 'medium', isStarred: false });
  const q4Sample = makeTask({ dueDate: '2026-11-20', priority: 'low', isStarred: false });
  assert(
    classifyMatrixTask(q1Sample, matrixNow).quadrant === 'q1' &&
      classifyMatrixTask(q2Sample, matrixNow).quadrant === 'q2' &&
      classifyMatrixTask(q3Sample, matrixNow).quadrant === 'q3' &&
      classifyMatrixTask(q4Sample, matrixNow).quadrant === 'q4',
    'classifyMatrixTask derives all 4 quadrants accurately from urgent + important'
  );

  const movedQ1ToQ2 = moveTaskToQuadrant(q1Sample, 'q2', matrixNow);
  assert(
    movedQ1ToQ2.dueDate === '2026-11-15' &&
      movedQ1ToQ2.priority === 'high' &&
      classifyMatrixTask(movedQ1ToQ2, matrixNow).quadrant === 'q2',
    'Moving Q1 -> Q2 updates dueDate outside 2-day window while keeping important priority'
  );

  const movedQ2ToQ3 = moveTaskToQuadrant(q2Sample, 'q3', matrixNow);
  assert(
    movedQ2ToQ3.dueDate === '2026-11-12' &&
      movedQ2ToQ3.isStarred === false &&
      classifyMatrixTask(movedQ2ToQ3, matrixNow).quadrant === 'q3',
    'Moving Q2 (starred) -> Q3 updates dueDate to today and clears isStarred'
  );

  const movedQ4ToQ1 = moveTaskToQuadrant(q4Sample, 'q1', matrixNow);
  assert(
    movedQ4ToQ1.dueDate === '2026-11-12' &&
      movedQ4ToQ1.priority === 'urgent' &&
      classifyMatrixTask(movedQ4ToQ1, matrixNow).quadrant === 'q1',
    'Moving Q4 -> Q1 updates dueDate to today and priority to urgent'
  );

  const dailyProg = computeDailyProgress(
    [
      makeTask({ id: 'dp-1', dueDate: '2026-11-12', completed: true, completedAt: matrixNow.getTime() }),
      makeTask({ id: 'dp-2', dueDate: '2026-11-12', completed: false }),
      makeTask({ id: 'dp-3', dueDate: '2026-11-15', completed: false }),
    ],
    '2026-11-12'
  );
  const emptyDayProg = computeDailyProgress(
    [makeTask({ id: 'dp-4', dueDate: '2026-11-15', completed: false })],
    '2026-11-12'
  );
  assert(
    dailyProg.completedToday === 1 &&
      dailyProg.dueToday === 2 &&
      dailyProg.percent === 50 &&
      emptyDayProg.dueToday === 0 &&
      emptyDayProg.percent === 0,
    'computeDailyProgress computes completedToday / tasksDueToday accurately'
  );

  // ------------------------------------------------------------------
  // 7. Habit Schedule Model (custom_days & weekly_target)
  // ------------------------------------------------------------------
  console.log('\n[7. Habit Schedule Model: custom_days & weekly_target]');

  const week8SundayStr = '2026-11-15'; // Sunday
  const week8SundayLocal = parseLocalDate(week8SundayStr);

  // isHabitDueOnDate checks
  const mwfHabit = makeHabit({
    scheduleType: 'custom_days',
    customDays: [1, 3, 5], // Mon, Wed, Fri
    targetDaysPerWeek: 3,
    createdAt: parseLocalDate('2026-09-21').getTime(),
  });
  assert(
    isHabitDueOnDate(mwfHabit, '2026-11-09') === true && // Mon
      isHabitDueOnDate(mwfHabit, '2026-11-10') === false && // Tue
      isHabitDueOnDate(mwfHabit, '2026-11-11') === true && // Wed
      isHabitDueOnDate(mwfHabit, '2026-11-12') === false && // Thu
      isHabitDueOnDate(mwfHabit, '2026-11-13') === true && // Fri
      isHabitDueOnDate(mwfHabit, '2026-11-14') === false && // Sat
      isHabitDueOnDate(mwfHabit, '2026-11-15') === false, // Sun
    'isHabitDueOnDate(custom_days [1,3,5]) is true on Mon/Wed/Fri and false on other weekdays'
  );
  assert(
    formatCustomDaysLabel([5, 1, 3]) === 'Mon Wed Fri',
    `formatCustomDaysLabel orders Mon..Sun cleanly (got "${formatCustomDaysLabel([5, 1, 3])}")`
  );

  const weekly3Habit = makeHabit({
    scheduleType: 'weekly_target',
    targetDaysPerWeek: 3,
    createdAt: parseLocalDate('2026-09-21').getTime(),
  });
  assert(
    ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'].every(
      (d) => isHabitDueOnDate(weekly3Habit, d) === false
    ),
    'isHabitDueOnDate(weekly_target) is NEVER due on a specific day'
  );

  // 8 weeks (56 days) ending Sunday 2026-11-15 -> Mon 2026-09-21 .. Sun 2026-11-15
  const mwf8WeeksDates: string[] = [];
  for (let offset = -55; offset <= 0; offset++) {
    const dStr = getLocalDateOffset(offset, week8SundayLocal);
    const dow = parseLocalDate(dStr).getDay();
    if (dow === 1 || dow === 3 || dow === 5) {
      mwf8WeeksDates.push(dStr);
    }
  }
  const mwfStats = getHabitStats(
    { ...mwfHabit, completedDates: mwf8WeeksDates },
    week8SundayStr
  );
  assert(
    mwfStats.strengthScore >= 90 &&
      mwfStats.currentStreak === 24 &&
      mwfStats.bestStreak === 24 &&
      mwfStats.backlogDays === 0,
    `Perfect Mon/Wed/Fri custom_days for 8 weeks yields strength>=90 (${mwfStats.strengthScore}) and streak=24 without breaking on Tue/Thu`
  );

  // 3x/week done on varying 3 days across 8 Mon-Sun weeks
  const weekly8WeeksDates: string[] = [];
  const weekPatterns = [
    [0, 2, 4], // Mon, Wed, Fri (offsets from week Monday)
    [1, 3, 5], // Tue, Thu, Sat
    [4, 5, 6], // Fri, Sat, Sun
    [0, 1, 6], // Mon, Tue, Sun
  ];
  for (let w = 0; w < 8; w++) {
    const monday = getLocalDateOffset(-55 + w * 7, week8SundayLocal);
    const mondayDate = parseLocalDate(monday);
    const pattern = weekPatterns[w % weekPatterns.length];
    for (const dayOffset of pattern) {
      weekly8WeeksDates.push(getLocalDateOffset(dayOffset, mondayDate));
    }
  }
  const weekly8Stats = getHabitStats(
    { ...weekly3Habit, completedDates: weekly8WeeksDates },
    week8SundayStr
  );
  assert(
    weekly8Stats.currentStreak === 8 &&
      weekly8Stats.bestStreak === 8 &&
      weekly8Stats.strengthScore >= 85 &&
      weekly8Stats.backlogDays === 0 &&
      weekly8Stats.completionRate === 100,
    `3x/week for 8 weeks yields streak=8w, strength>=85 (${weekly8Stats.strengthScore}), backlog=0 (got streak=${weekly8Stats.currentStreak}, backlog=${weekly8Stats.backlogDays})`
  );

  // Missed week breaks weekly_target streak (miss week 7, week 8 has 1 of 3 checks on Wednesday 2026-11-11)
  const missedWeek7Dates = weekly8WeeksDates.filter(
    (d) => d < '2026-11-02' || d > '2026-11-08'
  );
  const brokenMidWeekStats = getHabitStats(
    {
      ...weekly3Habit,
      completedDates: [...missedWeek7Dates.filter((d) => d < '2026-11-09'), '2026-11-09'],
    },
    '2026-11-11'
  );
  assert(
    brokenMidWeekStats.currentStreak === 0 &&
      brokenMidWeekStats.bestStreak === 6 &&
      brokenMidWeekStats.backlogDays === 2,
    `Missed week breaks weekly_target streak (current=0, best=6) and backlog reflects remaining checks (2)`
  );

  // Missed week 7 then met week 8 starts new streak=1 while preserving bestStreak=6
  const recoveredWeek8Stats = getHabitStats(
    { ...weekly3Habit, completedDates: missedWeek7Dates },
    week8SundayStr
  );
  assert(
    recoveredWeek8Stats.currentStreak === 1 && recoveredWeek8Stats.bestStreak === 6,
    `Meeting target after a missed week starts fresh streak=1 while keeping bestStreak=6`
  );

  // Empty customDays behaves as daily
  const emptyCustomHabit = makeHabit({
    scheduleType: 'custom_days',
    customDays: [],
    completedDates: dates30,
  });
  const emptyCustomStats = getHabitStats(emptyCustomHabit, todayStr);
  assert(
    isHabitDueOnDate(emptyCustomHabit, '2026-11-10') === true &&
      emptyCustomStats.strengthScore === stats30.strengthScore &&
      emptyCustomStats.currentStreak === 30 &&
      emptyCustomStats.backlogDays === 0,
    `Empty customDays behaves identically to daily (strength=${emptyCustomStats.strengthScore}, streak=${emptyCustomStats.currentStreak})`
  );

  // ------------------------------------------------------------------
  // 8. Unified Label Scale, 7-Day Backlog Window & Today's Status
  // ------------------------------------------------------------------
  console.log('\n[8. Unified Label Scale, 7-Day Backlog & Today Status]');

  // Unified threshold scale across all 5 tiers + 12-day (~47%) benchmark
  const dates12 = Array.from({ length: 12 }, (_, i) => getLocalDateOffset(-i, todayLocal));
  const stats12 = getHabitStats(makeHabit({ completedDates: dates12 }), todayStr);
  const dates16 = Array.from({ length: 16 }, (_, i) => getLocalDateOffset(-i, todayLocal));
  const stats16 = getHabitStats(makeHabit({ completedDates: dates16 }), todayStr);
  const stats2 = getHabitStats(makeHabit({ completedDates: [todayStr, getLocalDateOffset(-1, todayLocal)] }), todayStr);

  assert(
    stats12.strengthScore >= 45 &&
      stats12.strengthScore <= 49 &&
      stats12.healthLabel === 'Building' &&
      stats12.levelLabel.includes('Building') &&
      stats12.levelBadgeColor.includes('amber'),
    `12 consecutive days yields ~47% strength (${stats12.strengthScore}%) with unified Building tier`
  );
  assert(
    stats16.strengthScore >= 50 &&
      stats16.strengthScore < 70 &&
      stats16.healthLabel === 'Stable' &&
      stats16.levelLabel.includes('Developing') &&
      stats16.levelBadgeColor.includes('indigo'),
    `Score >=50 & <70 (${stats16.strengthScore}%) maps consistently to Stable / Developing`
  );
  assert(
    stats30.strengthScore >= 70 &&
      stats30.strengthScore < 85 &&
      stats30.healthLabel === 'Strong' &&
      stats30.levelLabel.includes('Strong') &&
      stats30.levelBadgeColor.includes('blue'),
    `Score >=70 & <85 (${stats30.strengthScore}%) maps consistently to Strong`
  );
  assert(
    stats60.strengthScore >= 85 &&
      stats60.healthLabel === 'Excellent' &&
      stats60.levelLabel.includes('Mastered') &&
      stats60.levelBadgeColor.includes('emerald'),
    `Score >=85 (${stats60.strengthScore}%) maps consistently to Excellent / Mastered`
  );
  assert(
    stats2.strengthScore < 25 &&
      stats2.healthLabel === 'Needs focus' &&
      stats2.levelLabel.includes('Needs Focus') &&
      stats2.levelBadgeColor.includes('rose'),
    `Score <25 (${stats2.strengthScore}%) maps consistently to Needs focus / Needs Focus`
  );

  // 7-day backlogDays window
  const oldTwoDates = [getLocalDateOffset(-300, todayLocal), getLocalDateOffset(-299, todayLocal)];
  const last7Completed = Array.from({ length: 7 }, (_, i) => getLocalDateOffset(-(i + 1), todayLocal));
  const oldCheckedRecentClean = getHabitStats(
    makeHabit({
      createdAt: parseLocalDate(oldTwoDates[0]).getTime(),
      completedDates: [...oldTwoDates, ...last7Completed],
    }),
    todayStr
  );
  assert(
    oldCheckedRecentClean.backlogDays === 0,
    `Habit checked twice 300 days ago with clean last 7 days (today unchecked) has backlog=0 (got ${oldCheckedRecentClean.backlogDays})`
  );

  const oldCheckedAbandoned = getHabitStats(
    makeHabit({
      createdAt: parseLocalDate(oldTwoDates[0]).getTime(),
      completedDates: oldTwoDates,
    }),
    todayStr
  );
  assert(
    oldCheckedAbandoned.backlogDays === 7,
    `Habit checked twice 300 days ago with no recent checks caps backlog strictly to last 7 days=7, not ~298 (got ${oldCheckedAbandoned.backlogDays})`
  );

  // Exclude today, vacation, and not-due days from last-7-day backlogDays
  // todayStr = 2026-11-12 (Thu). Last 7 days: Nov 5 (Thu) .. Nov 11 (Wed).
  // custom_days [1, 3, 5] (Mon, Wed, Fri) -> due in last 7 days: Nov 6 (Fri), Nov 9 (Mon), Nov 11 (Wed).
  // Put Nov 9 on vacation, complete Nov 6 -> only Nov 11 (Wed) missed -> backlogDays === 1 (today Thu not counted).
  const selectiveBacklog = getHabitStats(
    makeHabit({
      scheduleType: 'custom_days',
      customDays: [1, 3, 5],
      completedDates: ['2026-11-06'],
      vacationPeriods: [{ id: 'v-7', startDate: '2026-11-08', endDate: '2026-11-10' }],
    }),
    todayStr
  );
  assert(
    selectiveBacklog.backlogDays === 1,
    `7-day backlog excludes today, vacation, and non-due days (got ${selectiveBacklog.backlogDays})`
  );

  // Vacation range expansion & Today's Status (COMPLETED | DUE | REST, never FAILED)
  const expandedVac = expandVacationDates([
    { id: 'v-mid', startDate: '2026-11-09', endDate: '2026-11-13' },
  ]);
  assert(
    expandedVac.length === 5 &&
      expandedVac.includes('2026-11-09') &&
      expandedVac.includes('2026-11-11') &&
      expandedVac.includes('2026-11-13'),
    `expandVacationDates expands every date from start to end inclusive (${expandedVac.length} days)`
  );

  const midVacationHabit = makeHabit({
    vacationPeriods: [{ id: 'v-mid', startDate: '2026-11-09', endDate: '2026-11-13' }],
  });
  assert(
    getHabitTodayStatus(midVacationHabit, '2026-11-11') === 'REST',
    'Mid-vacation day returns Today Status REST (never FAILED)'
  );
  assert(
    getHabitTodayStatus(makeHabit({ completedDates: [] }), todayStr) === 'DUE',
    'Unchecked due day returns Today Status DUE (never FAILED)'
  );
  assert(
    getHabitTodayStatus(makeHabit({ completedDates: [todayStr] }), todayStr) === 'COMPLETED',
    'Checked today returns Today Status COMPLETED'
  );
  assert(
    getHabitTodayStatus(
      makeHabit({ scheduleType: 'custom_days', customDays: [1, 3, 5], completedDates: [] }),
      '2026-11-12' // Thursday
    ) === 'REST',
    'Non-due custom_days weekday returns Today Status REST'
  );
  assert(
    getHabitTodayStatus(
      makeHabit({ scheduleType: 'weekly_target', targetDaysPerWeek: 3, completedDates: [] }),
      todayStr
    ) === 'REST',
    'Unchecked weekly_target day returns Today Status REST'
  );

  assert(
    HABIT_CATEGORIES.join(',') === 'Study,Health,Fitness,Mindfulness,Finance,Personal,Other',
    'HABIT_CATEGORIES exposes all 7 canonical categories'
  );
  assert(
    getHabitCategoryColor('Study') === getHabitCategoryColor('study') &&
      getHabitCategoryColor('STUDY') === getHabitCategoryColor(' study ') &&
      getHabitCategoryColor('Fitness') === getHabitCategoryColor('fitness') &&
      getHabitCategoryColor('Mindfulness') === getHabitCategoryColor('MINDFULNESS') &&
      getHabitCategoryColor('Health') === getHabitCategoryColor('health') &&
      getHabitCategoryColor('Finance') === getHabitCategoryColor('finance') &&
      getHabitCategoryColor('Personal') === getHabitCategoryColor('personal') &&
      getHabitCategoryColor('Other') === getHabitCategoryColor('other') &&
      getHabitCategoryColor(undefined) === getHabitCategoryColor('Personal'),
    'Habit category color lookup is case-insensitive across all categories and defaults undefined to Personal'
  );

  console.log('\n--- All Tasks, Habits & Date Logic Tests Passed! ---');
}

runTasksHabitsDateTests();
