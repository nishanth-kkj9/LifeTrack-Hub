import { parseNaturalLanguageTask } from '../src/lib/todoUtils.ts';
import { getHabitStats } from '../src/lib/habitScoring.ts';
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

  console.log('\n--- All Tasks, Habits & Date Logic Tests Passed! ---');
}

runTasksHabitsDateTests();
