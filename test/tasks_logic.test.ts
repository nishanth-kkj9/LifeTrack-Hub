import { completeTask, reopenTask, setStatus, computeNextDueDate } from '../src/lib/taskActions.ts';
import { parseNaturalLanguageTask } from '../src/lib/todoUtils.ts';
import { isOverdue } from '../src/lib/taskUtils.ts';
import { stripUndefined, EMPTY_USER_DATA } from '../src/lib/firebase.ts';
import { Task, TaskPriority, TaskRecurrence, TaskStatus, UserAppData } from '../src/types/index.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-base-1',
    title: 'Sample Task',
    category: 'study',
    priority: 'medium',
    dueDate: '2026-11-12',
    completed: false,
    status: 'todo',
    subtasks: [
      { id: 'st-1', title: 'Step 1', completed: true },
      { id: 'st-2', title: 'Step 2', completed: false },
    ],
    createdAt: 1700000000000,
    ...overrides,
  };
}

function assertNoUndefinedDeep(value: unknown, path = 'root'): void {
  if (value === undefined) {
    throw new Error(`Undefined value at ${path}`);
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => assertNoUndefinedDeep(item, `${path}[${idx}]`));
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) {
      throw new Error(`Undefined key at ${path}.${k}`);
    }
    assertNoUndefinedDeep(v, `${path}.${k}`);
  }
}

function runTasksLogicSuite() {
  console.log('--- Starting Consolidated Tasks Logic Test Suite ---');

  const fixedNow = 1731600000000;
  const fixedToday = '2026-11-14';

  // ------------------------------------------------------------------
  // 1. taskActions: completeTask, reopenTask, setStatus
  // ------------------------------------------------------------------
  console.log('\n[1. taskActions]');
  {
    const base = makeTask({ status: 'in_progress' });
    const { completed, nextTask } = completeTask(base, fixedNow, fixedToday);
    assert(
      completed.completed === true &&
        completed.status === 'done' &&
        completed.completedAt === fixedNow &&
        completed.subtasks.every((s) => s.completed) &&
        nextTask === undefined &&
        base.completed === false &&
        base.subtasks[1].completed === false,
      'completeTask marks task & subtasks done without mutating input'
    );

    const mixedCompleted: Task = {
      ...completed,
      subtasks: [
        { id: 'st-1', title: 'Step 1', completed: true },
        { id: 'st-2', title: 'Step 2', completed: false },
      ],
    };
    const reopened = reopenTask(mixedCompleted);
    assert(
      reopened.completed === false &&
        reopened.status === 'todo' &&
        !('completedAt' in reopened) &&
        reopened.subtasks[0].completed === true &&
        reopened.subtasks[1].completed === false,
      'reopenTask resets completed/status, deletes completedAt key, and preserves subtasks'
    );

    const viaStatusDone = setStatus(base, 'done', fixedNow + 200, fixedToday).task;
    const viaComplete = completeTask(base, fixedNow + 200, fixedToday).completed;
    assert(
      JSON.stringify(viaStatusDone) === JSON.stringify(viaComplete),
      'setStatus(task, "done") produces identical output to completeTask'
    );

    const transitions: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'in_progress'];
    let cur = makeTask();
    for (const s of transitions) {
      cur = setStatus(cur, s, fixedNow, fixedToday).task;
      assert(
        cur.completed === (s === 'done') && ('completedAt' in cur) === (s === 'done'),
        `setStatus("${s}") keeps completed <-> status==="done" and completedAt key invariant`
      );
    }
  }

  // ------------------------------------------------------------------
  // 2. Recurrence: daily, weekdays, weekly, monthly, recurAfterCompletion
  // ------------------------------------------------------------------
  console.log('\n[2. Recurrence]');
  {
    const dailyOverdue = makeTask({
      id: 'rec-daily',
      dueDate: '2026-11-11',
      recurring: 'daily',
      actualMinutes: 25,
    });
    const { completed: dailyHist, nextTask: dailyNext } = completeTask(
      dailyOverdue,
      fixedNow,
      '2026-11-14'
    );
    assert(
      dailyHist.completed === true &&
        dailyNext !== undefined &&
        dailyNext.id !== dailyOverdue.id &&
        dailyNext.dueDate === '2026-11-15' &&
        dailyNext.completed === false &&
        dailyNext.status === 'todo' &&
        !('completedAt' in dailyNext) &&
        dailyNext.subtasks.every((s) => s.completed === false) &&
        dailyNext.actualMinutes === 0,
      'daily overdue 3 days keeps completed history and spawns next task for tomorrow with reset subtasks'
    );

    const monthlyJan31 = makeTask({ dueDate: '2026-01-31', recurring: 'monthly' });
    assert(
      completeTask(monthlyJan31, fixedNow, '2026-01-31').nextTask?.dueDate === '2026-02-28' &&
        computeNextDueDate({ dueDate: '2024-01-31', recurring: 'monthly' }, '2024-01-31') ===
          '2024-02-29',
      'monthly Jan 31 clamps to Feb 28 (non-leap) and Feb 29 (leap year)'
    );

    const fridayTask = makeTask({ dueDate: '2026-11-13', recurring: 'weekdays' });
    assert(
      completeTask(fridayTask, fixedNow, '2026-11-13').nextTask?.dueDate === '2026-11-16',
      'weekdays Friday advances to Monday'
    );

    assert(
      computeNextDueDate({ dueDate: '2026-11-01', recurring: 'weekly' }, '2026-11-14') ===
        '2026-11-15',
      'weekly overdue loops +7 days until strictly > today'
    );

    const afterCompTask = makeTask({
      dueDate: '2026-11-25',
      recurring: 'daily',
      recurAfterCompletion: true,
    });
    assert(
      completeTask(afterCompTask, fixedNow, '2026-11-14').nextTask?.dueDate === '2026-11-15',
      'recurAfterCompletion computes next due date from today instead of future dueDate'
    );

    const statusDoneRec = setStatus(
      makeTask({ dueDate: '2026-11-14', recurring: 'weekly', status: 'in_review' }),
      'done',
      fixedNow,
      '2026-11-14'
    );
    assert(
      statusDoneRec.task.completed === true && statusDoneRec.nextTask?.dueDate === '2026-11-21',
      'setStatus("done") on recurring task spawns next occurrence'
    );
  }

  // ------------------------------------------------------------------
  // 3. Natural Language Parser Table (Ref: Thu Nov 12, 2026 10:00 AM)
  // ------------------------------------------------------------------
  console.log('\n[3. Natural Language Parser Table]');
  {
    const ref10am = new Date(2026, 10, 12, 10, 0, 0);
    const ref4pm = new Date(2026, 10, 12, 16, 0, 0);

    interface ParserCase {
      input: string;
      ref?: Date;
      title: string;
      dueDate?: string;
      dueTime?: string;
      priority?: TaskPriority;
      recurring?: TaskRecurrence;
    }

    const cases: ParserCase[] = [
      { input: 'Practice SAT test', title: 'Practice SAT test', dueDate: '2026-11-12' },
      { input: "Today's meeting", title: "Today's meeting", dueDate: '2026-11-12' },
      { input: "Tomorrow's quiz", title: "Tomorrow's quiz", dueDate: '2026-11-12' },
      { input: 'Read chapter p2 notes', title: 'Read chapter p2 notes', priority: 'medium' },
      { input: '!p2 Read chapter notes', title: 'Read chapter notes', priority: 'high' },
      { input: 'urgent care visit', title: 'urgent care visit', priority: 'medium' },
      { input: 'Urgent fix asap', title: 'fix', priority: 'urgent' },
      { input: 'call mom at 3', ref: ref10am, title: 'call mom', dueTime: '15:00' },
      { input: 'call mom at 3', ref: ref4pm, title: 'call mom', dueTime: '03:00' },
      { input: 'submit form 25 Nov', title: 'submit form', dueDate: '2026-11-25' },
      { input: 'pay rent Nov 25', title: 'pay rent', dueDate: '2026-11-25' },
      { input: 'plan next week', title: 'plan', dueDate: '2026-11-16' },
      { input: 'budget review next month', title: 'budget review', dueDate: '2026-12-12' },
      {
        input: 'meet at 5pm on 20 nov',
        title: 'meet',
        dueDate: '2026-11-20',
        dueTime: '17:00',
      },
      { input: 'Review by fri', title: 'Review', dueDate: '2026-11-13' },
      { input: 'Sync next mon', title: 'Sync', dueDate: '2026-11-16' },
      {
        input: 'Standup daily p2',
        title: 'Standup',
        priority: 'high',
        recurring: 'daily',
      },
      {
        input: 'Sun cream and Mon ami wed prep',
        title: 'Sun cream and Mon ami wed prep',
        dueDate: '2026-11-12',
      },
    ];

    for (const tc of cases) {
      const parsed = parseNaturalLanguageTask(tc.input, tc.ref ?? ref10am);
      assert(
        parsed.title === tc.title,
        `parser ["${tc.input}"] title === "${tc.title}" (got "${parsed.title}")`
      );
      if (tc.dueDate !== undefined) {
        assert(
          parsed.dueDate === tc.dueDate,
          `parser ["${tc.input}"] dueDate === "${tc.dueDate}" (got "${parsed.dueDate}")`
        );
      }
      if (tc.dueTime !== undefined) {
        assert(
          parsed.dueTime === tc.dueTime,
          `parser ["${tc.input}"] dueTime === "${tc.dueTime}" (got "${parsed.dueTime}")`
        );
      }
      if (tc.priority !== undefined) {
        assert(
          parsed.priority === tc.priority,
          `parser ["${tc.input}"] priority === "${tc.priority}" (got "${parsed.priority}")`
        );
      }
      if (tc.recurring !== undefined) {
        assert(
          parsed.recurring === tc.recurring,
          `parser ["${tc.input}"] recurring === "${tc.recurring}" (got "${parsed.recurring}")`
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // 4. isOverdue
  // ------------------------------------------------------------------
  console.log('\n[4. isOverdue]');
  {
    const now = new Date(2026, 10, 12, 10, 30, 0);
    assert(
      isOverdue(makeTask({ dueDate: '2026-11-11', completed: false }), now) === true,
      'past dueDate uncompleted -> overdue'
    );
    assert(
      isOverdue(makeTask({ dueDate: '2026-11-11', completed: true }), now) === false,
      'past dueDate completed -> not overdue'
    );
    assert(
      isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: '09:15' }), now) === true &&
        isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: '9:15' }), now) === true,
      'today dueTime strictly before current HH:MM -> overdue'
    );
    assert(
      isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: '10:30' }), now) === false,
      'today dueTime equal to current HH:MM -> not overdue'
    );
    assert(
      isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: '14:00' }), now) === false,
      'today dueTime after current HH:MM -> not overdue'
    );
    assert(
      isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: undefined }), now) === false,
      'today without dueTime -> not overdue'
    );
    assert(
      isOverdue(makeTask({ dueDate: '2026-11-13', dueTime: '00:01' }), now) === false,
      'future dueDate -> not overdue'
    );
    assert(
      isOverdue(makeTask({ dueDate: '' }), now) === false,
      'missing/empty dueDate -> not overdue'
    );
    assert(
      isOverdue(makeTask({ dueDate: '2026-11-12', dueTime: '08:00' }), now.getTime()) === true,
      'supports epoch ms number for now'
    );
  }

  // ------------------------------------------------------------------
  // 5. stripUndefined
  // ------------------------------------------------------------------
  console.log('\n[5. stripUndefined]');
  {
    const dirtyTask: Task = {
      id: 'task-strip-1',
      title: 'Verify Firestore serialization',
      description: undefined,
      category: 'work',
      priority: 'high',
      dueDate: '2026-11-15',
      dueTime: undefined,
      recurring: undefined,
      completed: false,
      completedAt: undefined,
      estimatedMinutes: undefined,
      subtasks: [
        { id: 'st-1', title: 'Step A', completed: false, estimatedMinutes: undefined },
        { id: 'st-2', title: 'Step B', completed: true, estimatedMinutes: 15 },
      ],
      createdAt: fixedNow,
      deletedAt: undefined,
    };

    const payload: UserAppData = {
      ...EMPTY_USER_DATA,
      tasks: [dirtyTask],
      masterPlan: undefined,
    };

    const stripped = stripUndefined(payload);
    assertNoUndefinedDeep(stripped);

    const strippedTask = stripped.tasks[0];
    assert(
      !('dueTime' in strippedTask) &&
        !('recurring' in strippedTask) &&
        !('completedAt' in strippedTask) &&
        !('description' in strippedTask) &&
        !('deletedAt' in strippedTask) &&
        !('masterPlan' in stripped) &&
        !('estimatedMinutes' in strippedTask.subtasks[0]) &&
        strippedTask.subtasks[1].estimatedMinutes === 15,
      'stripUndefined drops undefined keys at root, task, and nested subtask levels while keeping defined values'
    );

    const mixed = stripUndefined({
      keepNull: null,
      keepZero: 0,
      keepFalse: false,
      keepEmpty: '',
      dropMe: undefined,
      arr: ['x', undefined, null, 'y'],
    });
    assertNoUndefinedDeep(mixed);
    assert(
      mixed.keepNull === null &&
        mixed.keepZero === 0 &&
        mixed.keepFalse === false &&
        mixed.keepEmpty === '' &&
        !('dropMe' in mixed) &&
        mixed.arr.length === 4 &&
        mixed.arr[1] === null &&
        mixed.arr[2] === null,
      'stripUndefined preserves null/falsy primitives and keeps exact array lengths'
    );

    const d = new Date(fixedNow);
    const withDate = stripUndefined({ date: d, omit: undefined });
    assert(withDate.date === d && !('omit' in withDate), 'stripUndefined preserves Date instances');
  }

  console.log('\n--- All Consolidated Tasks Logic Tests Passed! ---');
}

runTasksLogicSuite();
