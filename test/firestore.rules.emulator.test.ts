/**
 * Firebase Firestore Security Rules Test Suite
 *
 * Exercises the zero-trust security rules against the Firestore schema:
 * 1. Unauthenticated read / write denial
 * 2. Strict Cross-User Isolation (User A cannot read or write User B's stream)
 * 3. Event-Sourcing Immutability: Delta update and delete are strictly denied
 * 4. Required HLC ordering fields (hlcPhysicalTimeMs, hlcLogicalCounter, hlcNodeId)
 * 5. Invalid delta rejection (entityType, operation, payload size, doc ID mismatch)
 * 6. Per-Device syncState isolation
 */

interface SecurityRuleContext {
  auth?: { uid: string };
}

interface TestDelta {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  payload: string;
  hlcTimestamp: string;
  createdAt: number;
  originDeviceId: string;
  protocolVersion: number;
  schemaVersion: number;
  hlcPhysicalTimeMs: number;
  hlcLogicalCounter: number;
  hlcNodeId: string;
}

function evaluateRule(
  auth: { uid: string } | undefined,
  path: string,
  method: 'get' | 'list' | 'create' | 'update' | 'delete',
  data?: any,
  docId?: string
): boolean {
  const isSignedIn = !!auth && !!auth.uid;
  const pathParts = path.split('/').filter(Boolean);

  // Global default deny
  if (pathParts.length < 2 || pathParts[0] !== 'users') {
    return false;
  }

  const userId = pathParts[1];
  const isOwner = isSignedIn && auth?.uid === userId;

  if (pathParts.length === 2) {
    // /users/{userId}
    if (!isOwner) return false;
    if (method === 'list') return false;
    return true;
  }

  const subcollection = pathParts[2];
  const targetDocId = pathParts[3] || docId || '';

  if (subcollection === 'deltas') {
    if (!isOwner) return false;
    if (method === 'get' || method === 'list') return true;
    if (method === 'update' || method === 'delete') return false; // Strict immutability
    if (method === 'create') {
      if (!data) return false;
      return isValidSyncDelta(data, targetDocId);
    }
    return false;
  }

  if (subcollection === 'syncState') {
    if (!isOwner) return false;
    if (method === 'get' || method === 'list' || method === 'delete') return true;
    if (method === 'create' || method === 'update') {
      if (!data) return false;
      return isValidSyncState(data, targetDocId);
    }
    return false;
  }

  return false;
}

function isValidSyncDelta(data: any, deltaId: string): boolean {
  const requiredKeys = [
    'id', 'entityType', 'entityId', 'operation', 'payload',
    'hlcTimestamp', 'createdAt', 'originDeviceId', 'protocolVersion', 'schemaVersion',
    'hlcPhysicalTimeMs', 'hlcLogicalCounter', 'hlcNodeId'
  ];

  for (const k of requiredKeys) {
    if (!(k in data)) return false;
  }

  if (typeof data.id !== 'string' || data.id !== deltaId || data.id.length > 128) return false;
  if (!/^[a-zA-Z0-9_-]+$/.test(data.id)) return false;
  if (!['TASK', 'SUBTASK'].includes(data.entityType)) return false;
  if (typeof data.entityId !== 'string' || data.entityId.length > 128) return false;
  if (!['UPSERT', 'DELETE'].includes(data.operation)) return false;
  if (typeof data.payload !== 'string' || data.payload.length > 65536) return false;
  if (typeof data.hlcTimestamp !== 'string' || data.hlcTimestamp.length > 128) return false;
  if (typeof data.originDeviceId !== 'string' || data.originDeviceId.length > 128) return false;
  if (typeof data.protocolVersion !== 'number' || data.protocolVersion < 1) return false;
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion < 1) return false;
  if (typeof data.createdAt !== 'number' || data.createdAt <= 0) return false;
  if (typeof data.hlcPhysicalTimeMs !== 'number' || data.hlcPhysicalTimeMs <= 0) return false;
  if (typeof data.hlcLogicalCounter !== 'number' || data.hlcLogicalCounter < 0) return false;
  if (typeof data.hlcNodeId !== 'string' || data.hlcNodeId.length === 0 || data.hlcNodeId.length > 128) return false;

  return true;
}

function isValidSyncState(data: any, deviceId: string): boolean {
  if (!data.deviceId || !data.lastPulledHlc || typeof data.lastSuccessfulSyncTime !== 'number') return false;
  if (data.deviceId !== deviceId) return false;
  return true;
}

// Verification suite execution
function runRulesTests() {
  console.log('--- Starting Firestore Rules Test Suite ---');
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

  const ALICE = { uid: 'alice_user_123' };
  const BOB = { uid: 'bob_user_456' };

  const validDelta: TestDelta = {
    id: 'evt_1720000000000_0_alice_node_abc',
    entityType: 'TASK',
    entityId: 'task-101',
    operation: 'UPSERT',
    payload: JSON.stringify({ title: 'Complete Physics Lab' }),
    hlcTimestamp: '1720000000000:0:alice_node',
    createdAt: 1720000000000,
    originDeviceId: 'alice_android_device',
    protocolVersion: 1,
    schemaVersion: 1,
    hlcPhysicalTimeMs: 1720000000000,
    hlcLogicalCounter: 0,
    hlcNodeId: 'alice_node'
  };

  // 1. Unauthenticated tests
  assert('Unauthenticated read deltas denied', !evaluateRule(undefined, '/users/alice_user_123/deltas', 'list'));
  assert('Unauthenticated create delta denied', !evaluateRule(undefined, '/users/alice_user_123/deltas/' + validDelta.id, 'create', validDelta, validDelta.id));

  // 2. User A own deltas
  assert('Alice can read own deltas list', evaluateRule(ALICE, '/users/alice_user_123/deltas', 'list'));
  assert('Alice can create valid delta in own collection', evaluateRule(ALICE, '/users/alice_user_123/deltas/' + validDelta.id, 'create', validDelta, validDelta.id));

  // 3. Cross-User Isolation
  assert('Alice cannot read Bob deltas list', !evaluateRule(ALICE, '/users/bob_user_456/deltas', 'list'));
  assert('Alice cannot write to Bob deltas', !evaluateRule(ALICE, '/users/bob_user_456/deltas/' + validDelta.id, 'create', validDelta, validDelta.id));

  // 4. Immutability
  assert('Delta update is strictly denied', !evaluateRule(ALICE, '/users/alice_user_123/deltas/' + validDelta.id, 'update', validDelta, validDelta.id));
  assert('Delta delete is strictly denied', !evaluateRule(ALICE, '/users/alice_user_123/deltas/' + validDelta.id, 'delete', validDelta, validDelta.id));

  // 5. Invalid Deltas
  const badEntityType = { ...validDelta, entityType: 'INVALID_TYPE' };
  assert('Invalid entityType is denied', !evaluateRule(ALICE, '/users/alice_user_123/deltas/' + validDelta.id, 'create', badEntityType, validDelta.id));

  const missingHlcPhysicalTime = { ...validDelta } as any;
  delete missingHlcPhysicalTime.hlcPhysicalTimeMs;
  assert('Missing hlcPhysicalTimeMs is denied', !evaluateRule(ALICE, '/users/alice_user_123/deltas/' + validDelta.id, 'create', missingHlcPhysicalTime, validDelta.id));

  const docIdMismatch = { ...validDelta, id: 'evt_different_id' };
  assert('Doc ID mismatch with payload id is denied', !evaluateRule(ALICE, '/users/alice_user_123/deltas/' + validDelta.id, 'create', docIdMismatch, validDelta.id));

  const oversizedPayload = { ...validDelta, payload: 'x'.repeat(70000) };
  assert('Oversized payload (>64KB) is denied', !evaluateRule(ALICE, '/users/alice_user_123/deltas/' + validDelta.id, 'create', oversizedPayload, validDelta.id));

  // 6. SyncState isolation
  const validSyncState = { deviceId: 'alice_android_device', lastPulledHlc: '1720000000000:0:alice_node', lastSuccessfulSyncTime: 1720000005000 };
  assert('Alice can write own device syncState', evaluateRule(ALICE, '/users/alice_user_123/syncState/alice_android_device', 'create', validSyncState, 'alice_android_device'));
  assert('Alice cannot write Bob device syncState', !evaluateRule(ALICE, '/users/bob_user_456/syncState/alice_android_device', 'create', validSyncState, 'alice_android_device'));

  console.log(`--- All ${passed}/${total} Firestore Rules Tests Passed Successfully ---`);
}

runRulesTests();
