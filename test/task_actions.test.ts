import { completeTask, reopenTask, setStatus, computeNextDueDate } from '../src/lib/taskActions.ts';
import { Task, TaskStatus } from '../src/types/index.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function makeSampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Prepare VTU Lab Viva',
    category: 'study',
    priority: 'high',
    dueDate: '2026-11-15',
    completed: false,
    status: 'todo',
    subtasks: [
      { id: 'st-1', title: 'Review algorithms', completed: true },
      { id: 'st-2', title: 'Write dry runs', completed: false },
    ],
    createdAt: 1700000000000,
    ...overrides,
  };
}

function runTaskActionsTests() {
  console.log('--- Starting Task Actions Pure State & Recurrence Tests ---');

  const fixedNow = 1731600000000;
  const fixedToday = '2026-11-14';

  // 1. Non-recurring completeTask tests
  {
    const task = makeSampleTask({ status: 'in_progress' });
    const { completed, nextTask } = completeTask(task, fixedNow, fixedToday);

    assert(completed.completed === true, 'completeTask sets completed to true');
    assert(completed.status === 'done', 'completeTask sets status to "done"');
    assert(completed.completedAt === fixedNow, 'completeTask sets completedAt to provided timestamp');
    assert(nextTask === undefined, 'non-recurring completeTask does not spawn nextTask');
    assert(
      completed.subtasks.length === 2 && completed.subtasks.every((s) => s.completed === true),
      'completeTask marks all subtasks as completed'
    );
    assert(
      task.completed === false && task.status === 'in_progress' && !('completedAt' in task),
      'completeTask does not mutate input task'
    );
    assert(task.subtasks[1].completed === false, 'completeTask does not mutate input subtasks');

    const emptySubtasksTask = makeSampleTask({ subtasks: [] });
    const { completed: completedEmpty } = completeTask(emptySubtasksTask, fixedNow, fixedToday);
    assert(
      completedEmpty.completed === true &&
        completedEmpty.status === 'done' &&
        completedEmpty.completedAt === fixedNow &&
        completedEmpty.subtasks.length === 0,
      'completeTask works cleanly when task has zero subtasks'
    );
  }

  // 2. reopenTask tests
  {
    const { completed: completedTask } = completeTask(makeSampleTask(), fixedNow, fixedToday);
    const mixedTask: Task = {
      ...completedTask,
      subtasks: [
        { id: 'st-1', title: 'Step 1', completed: true },
        { id: 'st-2', title: 'Step 2', completed: false },
      ],
    };

    const reopened = reopenTask(mixedTask);
    assert(reopened.completed === false, 'reopenTask sets completed to false');
    assert(reopened.status === 'todo', 'reopenTask sets status to "todo"');
    assert(
      !('completedAt' in reopened) && !Object.prototype.hasOwnProperty.call(reopened, 'completedAt'),
      'reopenTask deletes completedAt key instead of setting undefined'
    );
    assert(
      reopened.subtasks[0].completed === true && reopened.subtasks[1].completed === false,
      'reopenTask leaves subtasks as they are'
    );
    assert(
      mixedTask.completed === true && mixedTask.completedAt === fixedNow,
      'reopenTask does not mutate input task'
    );
  }

  // 3. setStatus tests
  {
    const base = makeSampleTask({ status: 'todo' });

    const { task: inProgress, nextTask: inProgressNext } = setStatus(
      base,
      'in_progress',
      fixedNow,
      fixedToday
    );
    assert(inProgress.status === 'in_progress', 'setStatus updates status to in_progress');
    assert(inProgress.completed === false, 'setStatus("in_progress") keeps completed false');
    assert(!('completedAt' in inProgress), 'setStatus("in_progress") has no completedAt key');
    assert(inProgressNext === undefined, 'setStatus("in_progress") does not spawn nextTask');
    assert(
      inProgress.subtasks[0].completed === true && inProgress.subtasks[1].completed === false,
      'setStatus("in_progress") preserves subtasks'
    );

    const { task: viaSetStatusDone } = setStatus(inProgress, 'done', fixedNow + 500, fixedToday);
    const { completed: viaCompleteTask } = completeTask(inProgress, fixedNow + 500, fixedToday);
    assert(
      JSON.stringify(viaSetStatusDone) === JSON.stringify(viaCompleteTask),
      'setStatus(task, "done", now) produces exact same completed task as completeTask(task, now)'
    );

    const { task: inReview } = setStatus(viaSetStatusDone, 'in_review', fixedNow + 1000, fixedToday);
    assert(inReview.status === 'in_review', 'setStatus("in_review") updates status');
    assert(inReview.completed === false, 'setStatus("in_review") sets completed to false');
    assert(
      !('completedAt' in inReview) && !Object.prototype.hasOwnProperty.call(inReview, 'completedAt'),
      'setStatus("in_review") deletes completedAt key'
    );
    assert(
      inReview.subtasks.every((s) => s.completed === true),
      'setStatus("in_review") leaves subtasks as they are'
    );

    const sequence: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'todo'];
    let current = makeSampleTask();
    for (const s of sequence) {
      current = setStatus(current, s, fixedNow, fixedToday).task;
      assert(
        current.completed === (current.status === 'done'),
        `invariant completed === (status === "done") holds for status "${s}"`
      );
      assert(
        ('completedAt' in current) === current.completed,
        `invariant completedAt key presence matches completed=${current.completed} for status "${s}"`
      );
    }
  }

  // 4. Recurring task completion & date rules
  {
    console.log('\n[4. Recurring Task Completion & Next Due Date]');

    // Test Case A: daily overdue 3 days -> tomorrow
    const dailyOverdue = makeSampleTask({
      id: 'rec-daily-1',
      title: 'Anki spaced repetition',
      dueDate: '2026-11-11', // 3 days overdue when today is 2026-11-14
      dueTime: '09:00',
      priority: 'urgent',
      tags: ['study', 'daily'],
      estimatedMinutes: 20,
      actualMinutes: 15,
      isStarred: true,
      recurring: 'daily',
      subtasks: [
        { id: 'st-a', title: 'Deck A', completed: true },
        { id: 'st-b', title: 'Deck B', completed: false },
      ],
    });

    const { completed: dailyHist, nextTask: dailyNext } = completeTask(
      dailyOverdue,
      fixedNow,
      '2026-11-14'
    );

    assert(
      dailyHist.id === 'rec-daily-1' &&
        dailyHist.completed === true &&
        dailyHist.status === 'done' &&
        dailyHist.completedAt === fixedNow &&
        dailyHist.subtasks.every((s) => s.completed),
      'daily recurring completeTask keeps original task completed as history'
    );
    assert(dailyNext !== undefined, 'daily recurring completeTask creates nextTask');
    if (dailyNext) {
      assert(dailyNext.id !== dailyOverdue.id, 'nextTask gets a brand new id');
      assert(
        dailyNext.dueDate === '2026-11-15',
        `daily overdue 3 days advances to tomorrow 2026-11-15 (got ${dailyNext.dueDate})`
      );
      assert(
        dailyNext.completed === false &&
          dailyNext.status === 'todo' &&
          !('completedAt' in dailyNext),
        'nextTask is open (completed=false, status="todo", no completedAt)'
      );
      assert(
        dailyNext.subtasks.length === 2 && dailyNext.subtasks.every((s) => s.completed === false),
        'nextTask resets all subtasks to completed=false'
      );
      assert(
        dailyNext.title === dailyOverdue.title &&
          dailyNext.dueTime === '09:00' &&
          dailyNext.priority === 'urgent' &&
          dailyNext.isStarred === true &&
          dailyNext.estimatedMinutes === 20 &&
          dailyNext.actualMinutes === 0 &&
          dailyNext.recurring === 'daily' &&
          dailyNext.tags?.join(',') === 'study,daily',
        'nextTask preserves task fields and resets actualMinutes'
      );
    }

    // Test Case B: monthly Jan 31 -> Feb 28 (and leap year -> Feb 29)
    const monthlyJan31 = makeSampleTask({
      id: 'rec-monthly-1',
      dueDate: '2026-01-31',
      recurring: 'monthly',
    });
    const { nextTask: monthlyNext } = completeTask(monthlyJan31, fixedNow, '2026-01-31');
    assert(
      monthlyNext?.dueDate === '2026-02-28',
      `monthly Jan 31 clamps to Feb 28 in non-leap year 2026 (got ${monthlyNext?.dueDate})`
    );

    const leapMonthlyDue = computeNextDueDate(
      { dueDate: '2024-01-31', recurring: 'monthly' },
      '2024-01-31'
    );
    assert(
      leapMonthlyDue === '2024-02-29',
      `monthly Jan 31 clamps to Feb 29 in leap year 2024 (got ${leapMonthlyDue})`
    );

    // Overdue multi-month catchup preserving anchor day 31 when catching up to March
    const overdueMonthly = computeNextDueDate(
      { dueDate: '2026-01-31', recurring: 'monthly' },
      '2026-03-05'
    );
    assert(
      overdueMonthly === '2026-03-31',
      `overdue monthly from Jan 31 with today Mar 5 advances until > today (2026-03-31, got ${overdueMonthly})`
    );

    // Test Case C: weekdays Friday -> Monday
    // 2026-11-13 is Friday; next weekday must be Monday 2026-11-16
    const weekdayFri = makeSampleTask({
      id: 'rec-weekdays-1',
      dueDate: '2026-11-13',
      recurring: 'weekdays',
    });
    const { nextTask: weekdayNext } = completeTask(weekdayFri, fixedNow, '2026-11-13');
    assert(
      weekdayNext?.dueDate === '2026-11-16',
      `weekdays Friday 2026-11-13 advances to Monday 2026-11-16 (got ${weekdayNext?.dueDate})`
    );

    // Weekdays overdue from Wed 2026-11-11 completed on Fri 2026-11-13 -> Mon 2026-11-16
    const overdueWeekday = computeNextDueDate(
      { dueDate: '2026-11-11', recurring: 'weekdays' },
      '2026-11-13'
    );
    assert(
      overdueWeekday === '2026-11-16',
      `overdue weekdays loops until > today (got ${overdueWeekday})`
    );

    // Test Case D: weekly +7 loop until > today
    const overdueWeekly = computeNextDueDate(
      { dueDate: '2026-11-01', recurring: 'weekly' },
      '2026-11-14'
    );
    assert(
      overdueWeekly === '2026-11-15',
      `overdue weekly adds 7 until > today (got ${overdueWeekly})`
    );

    // Test Case E: recurAfterCompletion computes from today instead of old dueDate
    const futureEarlyWithAfterCompletion = makeSampleTask({
      id: 'rec-after-1',
      dueDate: '2026-11-25', // future scheduled date
      recurring: 'daily',
      recurAfterCompletion: true,
    });
    const { nextTask: afterCompletionNext } = completeTask(
      futureEarlyWithAfterCompletion,
      fixedNow,
      '2026-11-14'
    );
    assert(
      afterCompletionNext?.dueDate === '2026-11-15',
      `recurAfterCompletion computes from today (2026-11-14 -> 2026-11-15) instead of old dueDate (got ${afterCompletionNext?.dueDate})`
    );

    // Same future task WITHOUT recurAfterCompletion computes from old dueDate
    const futureWithoutAfterCompletion = makeSampleTask({
      id: 'rec-scheduled-1',
      dueDate: '2026-11-25',
      recurring: 'daily',
    });
    const { nextTask: scheduledNext } = completeTask(
      futureWithoutAfterCompletion,
      fixedNow,
      '2026-11-14'
    );
    assert(
      scheduledNext?.dueDate === '2026-11-26',
      `without recurAfterCompletion computes from old dueDate (2026-11-25 -> 2026-11-26, got ${scheduledNext?.dueDate})`
    );

    // Test Case F: setStatus(..., 'done') also spawns nextTask for recurring tasks
    const kanbanRecurring = makeSampleTask({
      id: 'rec-kanban-1',
      dueDate: '2026-11-14',
      status: 'in_review',
      recurring: 'weekly',
    });
    const { task: kanbanCompleted, nextTask: kanbanNext } = setStatus(
      kanbanRecurring,
      'done',
      fixedNow,
      '2026-11-14'
    );
    assert(
      kanbanCompleted.completed === true &&
        kanbanCompleted.status === 'done' &&
        kanbanNext?.dueDate === '2026-11-21',
      'setStatus("done") on recurring task spawns next weekly occurrence 2026-11-21'
    );

    // 'none' recurring does not create nextTask
    const noneRecurring = makeSampleTask({ recurring: 'none', dueDate: '2026-11-14' });
    assert(
      completeTask(noneRecurring, fixedNow, '2026-11-14').nextTask === undefined,
      'recurring="none" does not create nextTask'
    );
  }

  console.log('--- All Task Actions Pure State & Recurrence Tests Passed! ---');
}

runTaskActionsTests();
