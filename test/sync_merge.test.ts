import {
  mergeArraysById,
  mergeUserAppData,
  sanitizeUserAppData,
  EMPTY_USER_DATA,
} from '../src/lib/firebase.ts';
import { touch, tombstone, restoreTransaction, isActive, TOMBSTONE_TTL_MS } from '../src/lib/entity.ts';
import { RecurringTransaction, Task, Transaction, UserAppData } from '../src/types/index.ts';

function makeTask(id: string, title: string, updatedAt?: number, deletedAt?: number): Task {
  return {
    id,
    title,
    category: 'study',
    priority: 'medium',
    dueDate: '2026-11-14',
    completed: false,
    subtasks: [],
    createdAt: 1000,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(deletedAt !== undefined ? { deletedAt } : {}),
  };
}

function runSyncMergeTests() {
  console.log('--- Starting Offline/Cloud Sync Merge & Tombstone Tests ---');
  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      console.error(`  ✗ FAIL: ${name}${detail ? ` (${detail})` : ''}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  const T0 = 1_700_000_000_000;
  const T1 = T0 + 10_000;
  const T2 = T0 + 20_000;

  // Scenario (a): Device A deletes task, stale Device B syncs later -> task stays deleted on both
  const originalTask = touch(makeTask('t-del', 'Finish Lab Report'), T0);
  const deviceADeleted = tombstone(originalTask, T1);
  const deviceBStale = { ...originalTask }; // still at T0

  // Cloud has Device A's tombstone; Device B pushes stale copy -> merged preserves tombstone
  const cloudAfterA = mergeArraysById([originalTask], [deviceADeleted], T2);
  assert('Cloud retains tombstone after Device A deletes', cloudAfterA.length === 1 && cloudAfterA[0].deletedAt === T1);
  assert('Active UI view excludes tombstoned task on Device A', cloudAfterA.filter(isActive).length === 0);

  const afterStaleBSync = mergeArraysById(cloudAfterA, [deviceBStale], T2);
  assert('Stale Device B cannot resurrect deleted task', afterStaleBSync.filter(isActive).length === 0);
  assert('Device B receives tombstone so it deletes locally too', afterStaleBSync[0]?.deletedAt === T1);

  // Reverse direction: Device B was deleted offline locally while cloud still holds T0
  const localDeletedVsCloudOld = mergeArraysById([deviceBStale], [deviceADeleted], T2);
  assert('Offline deletion on Device A beats older active item in cloud', localDeletedVsCloudOld.filter(isActive).length === 0);

  // Scenario (b): Device A edits title after Device B's version -> Device A wins
  const deviceBEdit = touch(makeTask('t-edit', 'Old Title'), T1);
  const deviceAEdit = touch(makeTask('t-edit', 'Updated By Device A'), T2);
  const mergedEdit1 = mergeArraysById([deviceBEdit], [deviceAEdit], T2);
  const mergedEdit2 = mergeArraysById([deviceAEdit], [deviceBEdit], T2);
  assert('Newer edit wins when local is newer', mergedEdit1[0]?.title === 'Updated By Device A');
  assert('Newer edit wins when cloud is newer', mergedEdit2[0]?.title === 'Updated By Device A');

  // Scenario (c): Device A and Device B create/edit different tasks -> both preserved
  const taskFromA = touch(makeTask('t-a', 'Task From A'), T1);
  const taskFromB = touch(makeTask('t-b', 'Task From B'), T1);
  const combined = mergeArraysById([taskFromA], [taskFromB], T2);
  assert('Distinct tasks from A and B are both preserved', combined.length === 2);

  // Scenario (d): Unstamped item from sanitizeUserAppData defaults to updatedAt: 0 and loses to any stamped edit/delete
  const { data: sanitizedUnstamped } = sanitizeUserAppData({
    tasks: [makeTask('t-unstamped', 'Legacy Unstamped Copy')], // no updatedAt
  });
  assert('sanitizeUserAppData defaults missing updatedAt to 0 (not Date.now())', sanitizedUnstamped.tasks[0]?.updatedAt === 0);
  assert('sanitizeUserAppData defaults missing top-level lastUpdated to 0', sanitizedUnstamped.lastUpdated === 0);

  const cloudStampedEdit = touch(makeTask('t-unstamped', 'Cloud Edited Copy'), T0);
  const unstampedVsCloud = mergeArraysById([cloudStampedEdit], sanitizedUnstamped.tasks, T1);
  assert('Unstamped local item loses to older-clocked stamped cloud item', unstampedVsCloud[0]?.title === 'Cloud Edited Copy');

  const cloudStampedDelete = tombstone(makeTask('t-unstamped', 'Deleted Cloud Copy'), T0);
  const unstampedVsDelete = mergeArraysById([cloudStampedDelete], sanitizedUnstamped.tasks, T1);
  assert('Unstamped local item cannot resurrect a stamped cloud tombstone', unstampedVsDelete.filter(isActive).length === 0);

  // Scenario (e): Tombstones older than 30 days are garbage-collected
  const oldDelete = tombstone(makeTask('t-old-del', 'Old Deleted Task'), T0);
  const afterTtlNow = T0 + TOMBSTONE_TTL_MS + 1000;
  const gcResult = mergeArraysById([oldDelete], [], afterTtlNow);
  assert('Tombstones older than 30 days are purged by mergeArraysById', gcResult.length === 0);

  // Scenario (f): mergeUserAppData does not invent a newer lastUpdated than either source
  const cloudDoc: UserAppData = { ...EMPTY_USER_DATA, lastUpdated: T1, version: 3 };
  const localDoc: UserAppData = { ...EMPTY_USER_DATA, lastUpdated: T0, version: 2 };
  const mergedDoc = mergeUserAppData(cloudDoc, localDoc, T2 + 999999);
  assert('mergeUserAppData preserves max source lastUpdated without forcing Date.now()', mergedDoc.lastUpdated === T1);

  // Scenario (g): restoreTransaction clears deletedAt, bumps updatedAt, and restores active state across merge
  const txBase: Transaction = touch(
    {
      id: 'tx-restore-1',
      title: 'Hostel Mess',
      amount: 1200,
      type: 'expense',
      category: 'Food & Dining',
      date: '2026-11-15',
      paymentMethod: 'Card',
      createdAt: T0,
    },
    T0
  );
  const txDeleted = tombstone(txBase, T1);
  assert('Tombstoned transaction is inactive and has deletedAt', !isActive(txDeleted) && txDeleted.deletedAt === T1);

  const txRestored = restoreTransaction(txDeleted, T2);
  assert(
    'restoreTransaction clears deletedAt, keeps fields, bumps updatedAt, and makes tx active',
    isActive(txRestored) &&
      !('deletedAt' in txRestored) &&
      txRestored.updatedAt === T2 &&
      txRestored.amount === 1200
  );

  const mergedRestored = mergeArraysById([txDeleted], [txRestored], T2);
  assert(
    'Restored transaction wins merge over older cloud tombstone and remains active',
    mergedRestored.length === 1 && isActive(mergedRestored[0]) && !mergedRestored[0]?.deletedAt
  );

  // Scenario (h): recurringTransactions sync merge preserves tombstones
  const recItem: RecurringTransaction = touch(
    {
      id: 'rec-sync-1',
      title: 'Cloud Storage',
      amount: 199,
      type: 'expense',
      category: 'Subscriptions',
      paymentMethod: 'Card',
      frequency: 'monthly',
      dayOfMonth: 5,
      startDate: '2026-10-05',
    },
    T0
  );
  const recDeleted = tombstone(recItem, T1);
  const recMerged = mergeUserAppData(
    { ...EMPTY_USER_DATA, recurringTransactions: [recItem], lastUpdated: T0 },
    { ...EMPTY_USER_DATA, recurringTransactions: [recDeleted], lastUpdated: T1 },
    T2
  );
  assert(
    'mergeUserAppData propagates recurringTransactions tombstones and keeps deleted item inactive',
    recMerged.recurringTransactions?.length === 1 &&
      recMerged.recurringTransactions.filter(isActive).length === 0
  );

  console.log(`--- All ${passed}/${total} Sync Merge & Tombstone Tests Passed ---`);
}

runSyncMergeTests();
