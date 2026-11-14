import { stripUndefined, EMPTY_USER_DATA } from '../src/lib/firebase.ts';
import { Task, UserAppData } from '../src/types/index.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function assertNoUndefinedAtAnyDepth(value: unknown, path = 'root'): void {
  if (value === undefined) {
    throw new Error(`Found undefined value at ${path}`);
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertNoUndefinedAtAnyDepth(value[i], `${path}[${i}]`);
    }
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) {
      throw new Error(`Found undefined key "${path}.${k}"`);
    }
    assertNoUndefinedAtAnyDepth(v, `${path}.${k}`);
  }
}

function runFirestoreUndefinedTests() {
  console.log('--- Starting Firestore stripUndefined Integrity Tests ---');

  const taskWithUndefined: Task = {
    id: 'task-undef-1',
    title: 'Submit VTU lab record',
    description: undefined,
    category: 'study',
    priority: 'high',
    dueDate: '2026-11-15',
    dueTime: undefined,
    recurring: undefined,
    completed: false,
    completedAt: undefined,
    estimatedMinutes: undefined,
    actualMinutes: undefined,
    subtasks: [
      { id: 'st-u1', title: 'Print cover page', completed: false, estimatedMinutes: undefined },
      { id: 'st-u2', title: 'Get signature', completed: true, estimatedMinutes: 10 },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    deletedAt: undefined,
  };

  const payload: UserAppData = {
    ...EMPTY_USER_DATA,
    tasks: [taskWithUndefined],
    masterPlan: undefined,
  };

  const cleaned = stripUndefined(payload);

  // 1. No undefined keys or values at any depth
  assertNoUndefinedAtAnyDepth(cleaned);
  assert(true, 'stripUndefined removes all undefined keys across nested UserAppData and subtasks');

  // 2. Specifically confirm dropped keys on task & subtask
  const cleanedTask = cleaned.tasks[0];
  assert(!('dueTime' in cleanedTask), 'dueTime key dropped from cleaned task');
  assert(!('recurring' in cleanedTask), 'recurring key dropped from cleaned task');
  assert(!('completedAt' in cleanedTask), 'completedAt key dropped from cleaned task');
  assert(!('description' in cleanedTask), 'description key dropped from cleaned task');
  assert(!('deletedAt' in cleanedTask), 'deletedAt key dropped from cleaned task');
  assert(!('masterPlan' in cleaned), 'top-level undefined masterPlan key dropped');
  assert(!('estimatedMinutes' in cleanedTask.subtasks[0]), 'nested subtask undefined key dropped');
  assert(cleanedTask.subtasks[1].estimatedMinutes === 10, 'defined nested fields remain intact');

  // 3. Arrays keep their exact length
  assert(cleaned.tasks.length === 1, 'tasks array keeps length 1');
  assert(cleanedTask.subtasks.length === 2, 'subtasks array keeps length 2');

  // 4. Null values are kept intact, and arrays with undefined elements keep their length
  const mixedPayload = {
    nullableField: null,
    nested: {
      keepNull: null,
      dropMe: undefined,
      keepZero: 0,
      keepFalse: false,
      keepEmptyStr: '',
    },
    sparseArray: ['a', undefined, null, 'b'],
  };
  const cleanedMixed = stripUndefined(mixedPayload);
  assertNoUndefinedAtAnyDepth(cleanedMixed);
  assert('nullableField' in cleanedMixed && cleanedMixed.nullableField === null, 'top-level null value is kept');
  assert('keepNull' in cleanedMixed.nested && cleanedMixed.nested.keepNull === null, 'nested null value is kept');
  assert(!('dropMe' in cleanedMixed.nested), 'nested undefined key is dropped');
  assert(
    cleanedMixed.nested.keepZero === 0 &&
      cleanedMixed.nested.keepFalse === false &&
      cleanedMixed.nested.keepEmptyStr === '',
    'falsy defined primitives (0, false, "") are preserved'
  );
  assert(
    cleanedMixed.sparseArray.length === 4 &&
      cleanedMixed.sparseArray[1] === null &&
      cleanedMixed.sparseArray[2] === null,
    'arrays preserve exact length and retain null elements'
  );

  // 5. Non-plain objects such as Date are untouched
  const dateObj = new Date(1700000000000);
  const withDate = stripUndefined({ created: dateObj, gone: undefined });
  assert(withDate.created === dateObj && !('gone' in withDate), 'non-plain objects (Date) remain intact');

  console.log('--- All Firestore stripUndefined Integrity Tests Passed! ---');
}

runFirestoreUndefinedTests();
