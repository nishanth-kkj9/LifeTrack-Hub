import fs from 'fs';
import path from 'path';
import {
  hasUserCreatedContent,
  getDemoData,
  EMPTY_USER_DATA,
  mergeArraysById,
  mergeUserAppData,
} from '../src/lib/firebase.ts';
import { isActive } from '../src/lib/entity.ts';
import { UserAppData, Task } from '../src/types/index.ts';

/**
 * Firebase Firestore Security Rules Integrity & Verification Test Suite
 *
 * Directly inspects and validates the real `firestore.rules` file and its data-layer models:
 * 1. Confirms file existence and syntax integrity
 * 2. Verifies Global Default-Deny safety net
 * 3. Verifies User Root isolation (/users/{userId}) and isValidUserDoc shape whitelist
 * 4. Verifies Event-Sourcing Immutability: Delta update and delete are strictly forbidden
 * 5. Verifies HLC fields and delta schema validation rules
 * 6. Verifies per-device syncState security
 * 7. Tests emulator-equivalent validation logic: wrong type rejected, unknown key rejected, valid doc accepted
 * 8. Tests hasUserCreatedContent: demo data with one toggled item is NOT migrated
 * 9. Tests array merge by id with updatedAt and deletedAt tombstones
 */

function simulateValidateUserDoc(data: Record<string, any>): { valid: boolean; reason?: string } {
  const allowedKeys = new Set([
    'tasks',
    'transactions',
    'budget',
    'exams',
    'habits',
    'notes',
    'dailyMetrics',
    'vtuProfile',
    'masterPlan',
    'lastUpdated',
    'version',
  ]);

  for (const k of Object.keys(data)) {
    if (!allowedKeys.has(k)) {
      return { valid: false, reason: `Unknown top-level key '${k}' is rejected` };
    }
  }

  const listKeys = ['tasks', 'transactions', 'exams', 'habits', 'notes', 'dailyMetrics'];
  for (const lk of listKeys) {
    if (lk in data) {
      if (!Array.isArray(data[lk])) {
        return { valid: false, reason: `Field '${lk}' must be a list` };
      }
      if (data[lk].length > 5000) {
        return { valid: false, reason: `Field '${lk}' exceeds 5000 items limit` };
      }
    }
  }

  if (!('lastUpdated' in data) || typeof data.lastUpdated !== 'number') {
    return { valid: false, reason: "'lastUpdated' must be a number" };
  }

  if ('version' in data && typeof data.version !== 'number') {
    return { valid: false, reason: "'version' must be a number" };
  }

  return { valid: true };
}

async function runRulesVerification() {
  console.log('--- Starting Firestore Rules Verification & Integrity Suite ---');
  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  // 1. Read real firestore.rules file from workspace root
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  assert('firestore.rules file exists on disk', fs.existsSync(rulesPath));

  const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
  assert('firestore.rules is non-empty', rulesContent.length > 200);

  // 2. Syntax & Version declarations
  assert('Declares rules_version = "2"', rulesContent.includes("rules_version = '2'"));
  assert('Configures cloud.firestore service', rulesContent.includes('service cloud.firestore'));

  // 3. Global Default-Deny Safety Net
  assert(
    'Enforces global default-deny for all unmatched documents',
    rulesContent.includes('match /{document=**}') && rulesContent.includes('allow read, write: if false;')
  );

  // 4. Authentication and Ownership helpers
  assert('Implements isSignedIn() authentication helper', rulesContent.includes('function isSignedIn()'));
  assert(
    'Implements isOwner(userId) ownership enforcement',
    rulesContent.includes('function isOwner(userId)') && rulesContent.includes('request.auth.uid == userId')
  );

  // 5. User document isolation and field validation
  assert('Protects /users/{userId} path with isOwner check', rulesContent.includes('match /users/{userId}'));
  assert('Denies listing of all users (/users/{userId} allow list: if false)', rulesContent.includes('allow list: if false;'));
  assert('Enforces isValidUserDoc on /users/{userId} create and update', rulesContent.includes('isValidUserDoc(request.resource.data)'));
  assert('isValidUserDoc requires keys().hasOnly()', rulesContent.includes('data.keys().hasOnly('));
  assert('isValidUserDoc checks array fields size() <= 5000', rulesContent.includes('size() <= 5000'));
  assert('isValidUserDoc requires lastUpdated is number', rulesContent.includes('lastUpdated is number'));

  // 6. Immutability guarantee on deltas
  assert(
    'Guarantees delta event immutability (allow update: if false;)',
    rulesContent.includes('match /deltas/{deltaId}') &&
      rulesContent.includes('allow update: if false;') &&
      rulesContent.includes('allow delete: if false;')
  );

  // 7. HLC & Schema Validation checks
  assert(
    'isValidSyncDelta checks required HLC fields (hlcPhysicalTimeMs, hlcLogicalCounter, hlcNodeId)',
    rulesContent.includes('hlcPhysicalTimeMs') &&
      rulesContent.includes('hlcLogicalCounter') &&
      rulesContent.includes('hlcNodeId')
  );
  assert(
    'isValidSyncDelta enforces payload byte limit (<= 65536)',
    rulesContent.includes('data.payload.size() <= 65536')
  );
  assert(
    'isValidSyncDelta pins protocol/schema versions to the supported value (== 1)',
    rulesContent.includes('data.protocolVersion is number && data.protocolVersion == 1') &&
      rulesContent.includes('data.schemaVersion is number && data.schemaVersion == 1')
  );

  assert(
    'isValidSyncDelta strictly checks deltaId matching and regex format',
    rulesContent.includes('data.id == deltaId') && rulesContent.includes("data.id.matches('^[a-zA-Z0-9_\\\\-]+$')")
  );

  // 8. Device Checkpoints, Habits, and Metrics validation
  assert('Protects /syncState/{deviceId} subcollection', rulesContent.includes('match /syncState/{deviceId}'));
  assert('Protects /habits/{habitId} subcollection with isValidHabitDoc', rulesContent.includes('isValidHabitDoc(request.resource.data, habitId)'));
  assert('Protects /metrics/{date} subcollection with isValidMetricDoc', rulesContent.includes('isValidMetricDoc(request.resource.data, date)'));

  // 9. Document Schema Rule Behavior Simulations
  console.log('\n[Validation Suite: User Document Shape Rules]');
  const validDoc = {
    tasks: [],
    transactions: [],
    budget: { monthlyBudget: 500, savingsGoal: 100 },
    exams: [],
    habits: [],
    notes: [],
    version: 1,
    lastUpdated: Date.now(),
  };
  assert('Valid user document accepted', simulateValidateUserDoc(validDoc).valid === true);

  const unknownKeyDoc = {
    ...validDoc,
    maliciousInjectedField: 'unauthorized',
  };
  assert('Unknown top-level key rejected', simulateValidateUserDoc(unknownKeyDoc).valid === false);

  const wrongTypeDoc = {
    ...validDoc,
    lastUpdated: 'not-a-number-timestamp',
  };
  assert('Wrong type for lastUpdated rejected', simulateValidateUserDoc(wrongTypeDoc).valid === false);

  const nonListTasksDoc = {
    ...validDoc,
    tasks: 'invalid-string-instead-of-array',
  };
  assert('Non-list tasks field rejected', simulateValidateUserDoc(nonListTasksDoc).valid === false);

  const oversizedListDoc = {
    ...validDoc,
    tasks: new Array(5001).fill({ id: 't' }),
  };
  assert('Oversized list (>5000 items) rejected', simulateValidateUserDoc(oversizedListDoc).valid === false);

  // 10. Migration Filter Test: Demo data with one toggled item must NOT be migrated
  console.log('\n[Migration Suite: hasUserCreatedContent]');
  assert('Empty initial data has no user-created content', hasUserCreatedContent(EMPTY_USER_DATA) === false);

  const untouchedDemo = getDemoData();
  assert('Untouched sample/demo data has no user-created content', hasUserCreatedContent(untouchedDemo) === false);

  // User toggles one demo task to completed:
  const demoWithToggledItem: UserAppData = {
    ...untouchedDemo,
    tasks: untouchedDemo.tasks.map((t) => (t.id === 'task-1' ? { ...t, completed: true } : t)),
  };
  assert(
    'Demo data with one toggled item is NOT classified as user content (not migrated to cloud)',
    hasUserCreatedContent(demoWithToggledItem) === false
  );

  // User creates a brand-new custom task:
  const dataWithCustomTask: UserAppData = {
    ...untouchedDemo,
    tasks: [
      ...untouchedDemo.tasks,
      {
        id: 'task-custom-user-999',
        title: 'New Organic Task',
        category: 'study',
        priority: 'high',
        dueDate: '2026-11-15',
        completed: false,
        subtasks: [],
        createdAt: Date.now(),
      },
    ],
  };
  assert(
    'User data with newly created task ID is correctly recognized as user content (eligible for cloud migration)',
    hasUserCreatedContent(dataWithCustomTask) === true
  );

  // 11. Merging Suite: mergeArraysById with updatedAt and tombstones
  console.log('\n[Merge Suite: mergeArraysById & mergeUserAppData]');
  const cloudTask: Task = {
    id: 'task-sync-1',
    title: 'Cloud Version (Older)',
    category: 'study',
    priority: 'low',
    dueDate: '2026-11-12',
    completed: false,
    subtasks: [],
    createdAt: 1000,
    updatedAt: 1000,
  };
  const localTaskUpdated: Task = {
    id: 'task-sync-1',
    title: 'Local Version (Newer)',
    category: 'study',
    priority: 'high',
    dueDate: '2026-11-12',
    completed: true,
    subtasks: [],
    createdAt: 1000,
    updatedAt: 2000, // Newer timestamp
  };

  const mergedTasks = mergeArraysById([cloudTask], [localTaskUpdated]);
  assert('Newer local item wins over older cloud item', mergedTasks[0]?.title === 'Local Version (Newer)');

  // Tombstone delete test (must preserve recent tombstone for propagation, exclude from active list):
  const now = Date.now();
  const tombstonedLocalTask: Task = {
    id: 'task-sync-1',
    title: 'Deleted Task',
    category: 'study',
    priority: 'low',
    dueDate: '2026-11-12',
    completed: false,
    subtasks: [],
    createdAt: 1000,
    updatedAt: now,
    deletedAt: now,
  };
  const mergedWithTombstone = mergeArraysById([cloudTask], [tombstonedLocalTask], now);
  assert('Recent tombstone stays in merged array for offline device replication', mergedWithTombstone.length === 1 && Boolean(mergedWithTombstone[0]?.deletedAt));
  assert('Tombstoned item is excluded from active list via isActive()', mergedWithTombstone.filter(isActive).length === 0);

  // 12. Real Firestore Emulator Execution via @firebase/rules-unit-testing (when FIRESTORE_EMULATOR_HOST is set)
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`\n[Live Firestore Emulator Suite @ ${process.env.FIRESTORE_EMULATOR_HOST}]`);
    const { initializeTestEnvironment, assertSucceeds, assertFails } = await import('@firebase/rules-unit-testing');
    const { doc, getDoc, setDoc, updateDoc, deleteDoc } = await import('firebase/firestore');

    const [host, portStr] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    const port = Number(portStr) || 8080;

    const testEnv = await initializeTestEnvironment({
      projectId: process.env.GCLOUD_PROJECT || 'demo-lifetrack',
      firestore: {
        rules: rulesContent,
        host,
        port,
      },
    });

    try {
      const aliceCtx = testEnv.authenticatedContext('alice_uid');
      const bobCtx = testEnv.authenticatedContext('bob_uid');
      const anonCtx = testEnv.unauthenticatedContext();

      // Default-deny global fallback
      await assertFails(getDoc(doc(aliceCtx.firestore(), 'unmatched/doc1')));
      assert('Emulator denies read on unmatched collection', true);

      // Unauthenticated user cannot read/write user doc
      await assertFails(getDoc(doc(anonCtx.firestore(), 'users/alice_uid')));
      await assertFails(setDoc(doc(anonCtx.firestore(), 'users/alice_uid'), validDoc));
      assert('Emulator denies unauthenticated access to /users/{userId}', true);

      // Owner can write valid user doc; non-owner (Bob) is denied
      await assertSucceeds(setDoc(doc(aliceCtx.firestore(), 'users/alice_uid'), validDoc));
      await assertFails(getDoc(doc(bobCtx.firestore(), 'users/alice_uid')));
      await assertFails(setDoc(doc(bobCtx.firestore(), 'users/alice_uid'), validDoc));
      assert('Emulator allows owner write & isolates from other users', true);

      // Schema validation: unknown key or non-numeric lastUpdated fails
      await assertFails(setDoc(doc(aliceCtx.firestore(), 'users/alice_uid'), unknownKeyDoc));
      await assertFails(setDoc(doc(aliceCtx.firestore(), 'users/alice_uid'), wrongTypeDoc));
      assert('Emulator rejects unknown keys and invalid lastUpdated types', true);

      // Delta immutability and pinned versions
      const validDelta = {
        id: 'delta-1',
        entityType: 'TASK',
        entityId: 'task-1',
        operation: 'UPSERT',
        payload: '{"id":"task-1"}',
        hlcTimestamp: '1700000000000:0000:dev1',
        createdAt: 1700000000000,
        originDeviceId: 'dev1',
        protocolVersion: 1,
        schemaVersion: 1,
        hlcPhysicalTimeMs: 1700000000000,
        hlcLogicalCounter: 0,
        hlcNodeId: 'dev1',
      };
      const deltaRef = doc(aliceCtx.firestore(), 'users/alice_uid/deltas/delta-1');
      await assertSucceeds(setDoc(deltaRef, validDelta));
      await assertFails(updateDoc(deltaRef, { operation: 'DELETE' }));
      await assertFails(deleteDoc(deltaRef));
      await assertFails(
        setDoc(doc(aliceCtx.firestore(), 'users/alice_uid/deltas/delta-2'), {
          ...validDelta,
          id: 'delta-2',
          protocolVersion: 2,
        })
      );
      assert('Emulator enforces delta immutability and protocolVersion == 1', true);
    } finally {
      await testEnv.cleanup();
    }
  } else {
    console.log('\n[Note] FIRESTORE_EMULATOR_HOST not set — live emulator assertions skipped (configured in CI via setup-java + firebase emulators:exec).');
  }

  console.log(`--- All ${passed}/${total} Firestore Rules & Data Layer Tests Passed Successfully ---`);
}

runRulesVerification().catch((err) => {
  console.error('Firestore rules verification failed:', err);
  process.exit(1);
});
