export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SyncEntity {
  id: string;
  updatedAt?: number;
  deletedAt?: number;
}

/**
 * Stamps an entity with the current timestamp on create or edit.
 * Clears deletedAt if an entity is explicitly restored/updated.
 */
export function touch<T extends SyncEntity>(item: T, now: number = Date.now()): T {
  const { deletedAt: _ignored, ...rest } = item;
  return {
    ...(rest as T),
    updatedAt: now,
  };
}

/**
 * Marks an entity as softly deleted with a tombstone timestamp.
 */
export function tombstone<T extends SyncEntity>(item: T, now: number = Date.now()): T {
  return {
    ...item,
    updatedAt: now,
    deletedAt: now,
  };
}

/**
 * Returns true if the entity has not been softly deleted.
 */
export function isActive<T extends { deletedAt?: number }>(item: T | null | undefined): item is T {
  return Boolean(item) && !item?.deletedAt;
}

/**
 * Drops tombstones older than ttlMs so deleted arrays do not grow unbounded forever,
 * while preserving recent tombstones so stale offline devices still observe deletions.
 */
export function purgeOldTombstones<T extends { deletedAt?: number }>(
  items: T[],
  now: number = Date.now(),
  ttlMs: number = TOMBSTONE_TTL_MS
): T[] {
  return items.filter((item) => {
    if (!item.deletedAt) return true;
    return now - item.deletedAt <= ttlMs;
  });
}
