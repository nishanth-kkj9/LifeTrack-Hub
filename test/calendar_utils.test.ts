import {
  buildDayBuckets,
  getMonthGrid,
  getWeekDays,
  monthStats,
  getOverdueTasks,
  formatAgendaDateHeader,
  buildAgendaGroups,
  shiftMonthKeepingDay,
  formatCalendarCellAriaLabel,
  computeCalendarKeyNavigation,
  projectRecurringOccurrences,
} from '../src/lib/calendarUtils.ts';
import { nextOccurrence } from '../src/lib/taskActions.ts';
import { ExamReminder, Task } from '../src/types/index.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-cal-1',
    title: 'Calendar Task',
    category: 'study',
    priority: 'medium',
    dueDate: '2026-11-12',
    completed: false,
    status: 'todo',
    subtasks: [],
    createdAt: new Date(2026, 10, 1).getTime(),
    ...overrides,
  };
}

function makeExam(overrides: Partial<ExamReminder> = {}): ExamReminder {
  return {
    id: 'exam-cal-1',
    subject: 'Algorithms',
    courseCode: 'BCS401',
    examDate: '2026-11-18',
    examType: 'external',
    createdAt: new Date(2026, 10, 1).getTime(),
    ...overrides,
  };
}

function runCalendarUtilsTests() {
  console.log('--- Starting Calendar Utils Tests ---');

  // 1. Two exams on one day => exams count 2 (not 1 day)
  {
    const grid = getMonthGrid(new Date(2026, 10, 1), 0);
    const exams: ExamReminder[] = [
      makeExam({ id: 'ex-1', subject: 'Algorithms', examDate: '2026-11-18' }),
      makeExam({ id: 'ex-2', subject: 'Operating Systems', examDate: '2026-11-18' }),
    ];
    const buckets = buildDayBuckets([], exams, grid[0], grid[grid.length - 1]);
    const stats = monthStats(buckets, new Date(2026, 10, 1));
    assert(
      buckets.get('2026-11-18')?.exams.length === 2 && stats.exams === 2,
      `two exams on one day yields exams count 2 (got ${stats.exams})`
    );
  }

  // 2. Month with 6 weeks (42 cells) vs 5 weeks (35 cells)
  {
    // August 2026 starts on Saturday (day 6) with 31 days => 6 + 31 = 37 => 42 cells
    const aug2026 = getMonthGrid(new Date(2026, 7, 1), 0);
    assert(
      aug2026.length === 42 &&
        aug2026[6] === '2026-08-01' &&
        aug2026[36] === '2026-08-31',
      `month with 6 weeks (Aug 2026 Sunday-start) produces 42 cells (got ${aug2026.length})`
    );

    // November 2026 starts on Sunday (day 0) with 30 days => 35 cells for Sunday-start
    const nov2026Sun = getMonthGrid(new Date(2026, 10, 1), 0);
    assert(
      nov2026Sun.length === 35 && nov2026Sun[0] === '2026-11-01',
      `Nov 2026 Sunday-start produces 35 cells (got ${nov2026Sun.length})`
    );
  }

  // 3. Monday-start grid
  {
    // November 2026 starts on Sunday: with weekStart=1, Sunday needs 6 leading days (Oct 26..Oct 31) => 6 + 30 = 36 => 42 cells
    const nov2026Mon = getMonthGrid(new Date(2026, 10, 1), 1);
    assert(
      nov2026Mon.length === 42 &&
        nov2026Mon[0] === '2026-10-26' &&
        nov2026Mon[6] === '2026-11-01',
      `Monday-start grid for Nov 2026 starts on Mon 2026-10-26 and places Nov 1 at index 6`
    );

    // June 2026 starts on Monday (day 1): with weekStart=1, index 0 is 2026-06-01 and 35 cells
    const jun2026Mon = getMonthGrid(new Date(2026, 5, 1), 1);
    assert(
      jun2026Mon.length === 35 && jun2026Mon[0] === '2026-06-01',
      'Monday-start grid for June 2026 places Jun 1 at index 0 with 35 cells'
    );
  }

  // 4. Leap February (2024) vs Non-leap February (2026)
  {
    const leapFeb = getMonthGrid(new Date(2024, 1, 1), 0);
    const nonLeapFeb = getMonthGrid(new Date(2026, 1, 1), 0);
    assert(
      leapFeb.length === 35 &&
        leapFeb.includes('2024-02-29') &&
        !nonLeapFeb.includes('2026-02-29') &&
        nonLeapFeb.length === 35,
      'leap February 2024 includes 2024-02-29 while non-leap Feb 2026 ends at Feb 28 (both 35 cells)'
    );
  }

  // 5. Task completed in December but due in November
  {
    const decCompletedAt = new Date(2026, 11, 2, 14, 0, 0).getTime(); // 2026-12-02
    const tasks: Task[] = [
      makeTask({
        id: 'cross-month-done',
        dueDate: '2026-11-28',
        completed: true,
        completedAt: decCompletedAt,
      }),
      makeTask({
        id: 'nov-fallback-done',
        dueDate: '2026-11-10',
        completed: true,
        completedAt: undefined,
      }),
      makeTask({
        id: 'nov-pending',
        dueDate: '2026-11-20',
        completed: false,
      }),
    ];

    const novGrid = getMonthGrid(new Date(2026, 10, 1), 0);
    const novBuckets = buildDayBuckets(
      tasks,
      [],
      novGrid[0],
      novGrid[novGrid.length - 1],
      new Date(2026, 10, 25, 12, 0)
    );
    const novStats = monthStats(novBuckets, '2026-11');
    assert(
      novStats.done === 1 && novStats.pending === 1 && novBuckets.get('2026-11-20')?.overdue === true,
      `November stats exclude task completed in Dec (done=${novStats.done}, pending=${novStats.pending}) and flag overdue`
    );

    const decGrid = getMonthGrid(new Date(2026, 11, 1), 0);
    const decBuckets = buildDayBuckets(tasks, [], decGrid[0], decGrid[decGrid.length - 1]);
    const decStats = monthStats(decBuckets, '2026-12');
    assert(
      decStats.done === 1 &&
        decStats.pending === 0 &&
        decBuckets.get('2026-12-02')?.done.length === 1,
      `December stats count task completed in Dec even though due in Nov (done=${decStats.done})`
    );
  }

  // 6. getOverdueTasks sorts oldest first and excludes completed / today tasks
  {
    const now = new Date(2026, 10, 14, 15, 0); // 2026-11-14 15:00
    const tasks: Task[] = [
      makeTask({ id: 'o-newer', dueDate: '2026-11-13', completed: false }),
      makeTask({ id: 'o-oldest', dueDate: '2026-11-05', dueTime: '09:00', completed: false }),
      makeTask({ id: 'o-today-past-time', dueDate: '2026-11-14', dueTime: '10:00', completed: false }),
      makeTask({ id: 'o-done', dueDate: '2026-11-01', completed: true }),
    ];
    const overdue = getOverdueTasks(tasks, now);
    assert(
      overdue.length === 2 && overdue[0].id === 'o-oldest' && overdue[1].id === 'o-newer',
      `getOverdueTasks returns pending tasks with dueDate < today ordered oldest first (got ${overdue.map((t) => t.id).join(', ')})`
    );
  }

  // 7. formatAgendaDateHeader & buildAgendaGroups (Today, Tomorrow, Mon Nov 23, Show completed, 7/30/90 range)
  {
    assert(
      formatAgendaDateHeader('2026-11-14', '2026-11-14', '2026-11-15') === 'Today' &&
        formatAgendaDateHeader('2026-11-15', '2026-11-14', '2026-11-15') === 'Tomorrow' &&
        formatAgendaDateHeader('2026-11-23', '2026-11-14', '2026-11-15') === 'Mon, Nov 23',
      'formatAgendaDateHeader formats Today, Tomorrow, and "Mon, Nov 23"'
    );

    const tasks: Task[] = [
      makeTask({ id: 'ag-today', dueDate: '2026-11-14', completed: false }),
      makeTask({ id: 'ag-done', dueDate: '2026-11-15', completed: true }),
      makeTask({ id: 'ag-20d', dueDate: '2026-12-04', completed: false }),
      makeTask({ id: 'ag-60d', dueDate: '2027-01-10', completed: false }),
    ];
    const exams: ExamReminder[] = [
      makeExam({ id: 'ag-exam', subject: 'Computer Networks', examDate: '2026-11-23', examTime: '09:30' }),
    ];

    const groups7 = buildAgendaGroups(tasks, exams, {
      todayStr: '2026-11-14',
      rangeDays: 7,
      showCompleted: false,
    });
    assert(
      groups7.length === 1 && groups7[0].headerLabel === 'Today',
      `7-day agenda without completed excludes Tomorrow done, Nov 23, and 20d/60d tasks`
    );

    const groups30WithDone = buildAgendaGroups(tasks, exams, {
      todayStr: '2026-11-14',
      rangeDays: 30,
      showCompleted: true,
    });
    assert(
      groups30WithDone.map((g) => g.headerLabel).join('|') === 'Today|Tomorrow|Mon, Nov 23|Fri, Dec 4',
      `30-day agenda with showCompleted groups under Today, Tomorrow, Mon, Nov 23, Fri, Dec 4`
    );

    const groups90 = buildAgendaGroups(tasks, exams, {
      todayStr: '2026-11-14',
      rangeDays: 90,
      showCompleted: false,
    });
    assert(
      groups90.some((g) => g.date === '2027-01-10'),
      '90-day agenda includes events up to 90 days out'
    );
  }

  // 8. formatCalendarCellAriaLabel (singular/plural, 0 completed omitted, exams)
  {
    const promptExample = formatCalendarCellAriaLabel({
      dateStr: '2026-11-20',
      pendingCount: 5,
      completedCount: 1,
      exams: [{ subject: 'DBMS' }],
    });
    assert(
      promptExample === 'Friday, 20 November 2026, 5 tasks pending, 1 completed, exam: DBMS',
      `formatCalendarCellAriaLabel matches prompt format ("${promptExample}")`
    );

    const singularAndZeroDone = formatCalendarCellAriaLabel({
      dateStr: '2026-11-21',
      pendingCount: 1,
      completedCount: 0,
      exams: [],
    });
    assert(
      singularAndZeroDone === 'Saturday, 21 November 2026, 1 task pending',
      `formatCalendarCellAriaLabel uses singular "1 task pending" and omits 0 completed ("${singularAndZeroDone}")`
    );

    const multipleExams = formatCalendarCellAriaLabel({
      dateStr: '2026-11-22',
      pendingCount: 0,
      completedCount: 2,
      exams: [{ subject: 'DBMS' }, { subject: 'OS' }],
    });
    assert(
      multipleExams === 'Sunday, 22 November 2026, 0 tasks pending, 2 completed, exams: DBMS, OS',
      `formatCalendarCellAriaLabel formats multiple exams ("${multipleExams}")`
    );
  }

  // 9. shiftMonthKeepingDay clamping (Jan 31 -> Feb 28 / leap Feb 29)
  {
    const nonLeap = shiftMonthKeepingDay('2026-01-31', new Date(2026, 1, 1));
    assert(
      nonLeap.nextSelectedDate === '2026-02-28' &&
        nonLeap.nextViewMonth.getFullYear() === 2026 &&
        nonLeap.nextViewMonth.getMonth() === 1,
      `shiftMonthKeepingDay clamps Jan 31 -> Feb 28 in non-leap year (got ${nonLeap.nextSelectedDate})`
    );

    const leap = shiftMonthKeepingDay('2024-01-31', new Date(2024, 1, 1));
    assert(
      leap.nextSelectedDate === '2024-02-29',
      `shiftMonthKeepingDay clamps Jan 31 -> Feb 29 in leap year (got ${leap.nextSelectedDate})`
    );

    const normal = shiftMonthKeepingDay('2026-03-15', new Date(2026, 1, 1));
    assert(
      normal.nextSelectedDate === '2026-02-15',
      `shiftMonthKeepingDay keeps day 15 across months (got ${normal.nextSelectedDate})`
    );
  }

  // 10. computeCalendarKeyNavigation (ArrowKeys, PageUp/PageDown, Home/End for Sun/Mon start)
  {
    const leftCross = computeCalendarKeyNavigation('ArrowLeft', '2026-11-01', 0);
    assert(
      leftCross?.nextDateStr === '2026-10-31' && leftCross.nextViewMonth.getMonth() === 9,
      'ArrowLeft on Nov 1 moves to Oct 31 and switches viewMonth to Oct'
    );

    const rightMove = computeCalendarKeyNavigation('ArrowRight', '2026-11-18', 0);
    assert(rightMove?.nextDateStr === '2026-11-19', 'ArrowRight moves +1 day');

    const upMove = computeCalendarKeyNavigation('ArrowUp', '2026-11-18', 0);
    assert(upMove?.nextDateStr === '2026-11-11', 'ArrowUp moves -7 days');

    const downMove = computeCalendarKeyNavigation('ArrowDown', '2026-11-18', 0);
    assert(downMove?.nextDateStr === '2026-11-25', 'ArrowDown moves +7 days');

    const pageDownClamp = computeCalendarKeyNavigation('PageDown', '2026-01-31', 0);
    assert(
      pageDownClamp?.nextDateStr === '2026-02-28' && pageDownClamp.nextViewMonth.getMonth() === 1,
      'PageDown on Jan 31 clamps to Feb 28'
    );

    const pageUp = computeCalendarKeyNavigation('PageUp', '2026-03-15', 0);
    assert(
      pageUp?.nextDateStr === '2026-02-15' && pageUp.nextViewMonth.getMonth() === 1,
      'PageUp on Mar 15 moves to Feb 15'
    );

    // Wednesday 2026-11-18: Sunday-start week is Nov 15..Nov 21; Monday-start week is Nov 16..Nov 22
    const homeSun = computeCalendarKeyNavigation('Home', '2026-11-18', 0);
    const endSun = computeCalendarKeyNavigation('End', '2026-11-18', 0);
    assert(
      homeSun?.nextDateStr === '2026-11-15' && endSun?.nextDateStr === '2026-11-21',
      `Home/End with Sunday weekStart aligns to Sun Nov 15 .. Sat Nov 21 (got ${homeSun?.nextDateStr}..${endSun?.nextDateStr})`
    );

    const homeMon = computeCalendarKeyNavigation('Home', '2026-11-18', 1);
    const endMon = computeCalendarKeyNavigation('End', '2026-11-18', 1);
    assert(
      homeMon?.nextDateStr === '2026-11-16' && endMon?.nextDateStr === '2026-11-22',
      `Home/End with Monday weekStart aligns to Mon Nov 16 .. Sun Nov 22 (got ${homeMon?.nextDateStr}..${endMon?.nextDateStr})`
    );

    // Sunday 2026-11-22 with Monday weekStart: Home should be Mon 2026-11-16, End should stay Sun 2026-11-22
    const homeMonOnSun = computeCalendarKeyNavigation('Home', '2026-11-22', 1);
    const endMonOnSun = computeCalendarKeyNavigation('End', '2026-11-22', 1);
    assert(
      homeMonOnSun?.nextDateStr === '2026-11-16' && endMonOnSun?.nextDateStr === '2026-11-22',
      'Home/End on Sunday with Monday weekStart spans Mon..Sun'
    );
  }

  // 11. getWeekDays (7 columns aligned to Sunday or Monday weekStart)
  {
    const sunWeek = getWeekDays('2026-11-18', 0);
    const monWeek = getWeekDays('2026-11-18', 1);
    assert(
      sunWeek.length === 7 && sunWeek[0] === '2026-11-15' && sunWeek[6] === '2026-11-21',
      `getWeekDays Sunday-start spans 7 days Sun..Sat (${sunWeek[0]}..${sunWeek[6]})`
    );
    assert(
      monWeek.length === 7 && monWeek[0] === '2026-11-16' && monWeek[6] === '2026-11-22',
      `getWeekDays Monday-start spans 7 days Mon..Sun (${monWeek[0]}..${monWeek[6]})`
    );
  }

  // 12. nextOccurrence & projectRecurringOccurrences
  {
    assert(
      nextOccurrence({ dueDate: '2026-11-10', recurring: 'daily' }, '2026-11-10') === '2026-11-11' &&
        nextOccurrence({ dueDate: '2026-11-13', recurring: 'weekdays' }, '2026-11-13') === '2026-11-16' &&
        nextOccurrence({ dueDate: '2026-11-10', recurring: 'weekly' }, '2026-11-10') === '2026-11-17' &&
        nextOccurrence({ dueDate: '2026-01-31', recurring: 'monthly' }, '2026-01-31') === '2026-02-28',
      'nextOccurrence computes daily, weekdays (skipping weekend), weekly, and clamped monthly occurrences'
    );

    const grid = getMonthGrid(new Date(2026, 10, 1), 0); // 2026-11-01 .. 2026-12-05
    const gridStart = grid[0];
    const gridEnd = grid[grid.length - 1];
    const todayStr = '2026-11-05';

    const inputTasks: Task[] = [
      makeTask({
        id: 'rec-weekly',
        title: 'Weekly Sync',
        dueDate: '2026-11-08',
        recurring: 'weekly',
        completed: false,
      }),
      makeTask({
        id: 'rec-done',
        title: 'Completed Daily',
        dueDate: '2026-11-06',
        recurring: 'daily',
        completed: true,
      }),
      makeTask({
        id: 'non-rec',
        title: 'One-off Task',
        dueDate: '2026-11-06',
        recurring: 'none',
        completed: false,
      }),
    ];
    const snapshotBefore = JSON.stringify(inputTasks);

    const projected = projectRecurringOccurrences(inputTasks, gridStart, gridEnd, todayStr);
    assert(
      JSON.stringify(inputTasks) === snapshotBefore,
      'projectRecurringOccurrences does not mutate input tasks'
    );

    // Original dueDate 2026-11-08 should NOT have a projected duplicate; repeats on Nov 15, 22, 29, Dec 6 (Dec 6 outside gridEnd 2026-12-05)
    assert(
      !projected.has('2026-11-08') &&
        projected.get('2026-11-15')?.[0]?.sourceTaskId === 'rec-weekly' &&
        projected.get('2026-11-22')?.[0]?.sourceTaskId === 'rec-weekly' &&
        projected.get('2026-11-29')?.[0]?.sourceTaskId === 'rec-weekly',
      'Pending weekly task projects Nov 15, Nov 22, Nov 29 without duplicating own dueDate Nov 8'
    );

    const allProjectedIds = Array.from(projected.values())
      .flat()
      .map((p) => p.sourceTaskId);
    assert(
      !allProjectedIds.includes('rec-done') && !allProjectedIds.includes('non-rec'),
      'Completed and non-recurring tasks do not project repeat occurrences'
    );

    const pastProjected = projectRecurringOccurrences(inputTasks, '2026-09-01', '2026-09-30', todayStr);
    assert(
      pastProjected.size === 0,
      'Past month grid strictly on/before todayStr returns zero projected occurrences'
    );
  }

  console.log('--- All Calendar Utils Tests Passed! ---');
}

runCalendarUtilsTests();
