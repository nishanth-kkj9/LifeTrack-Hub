import { QuickNote } from '../types/index.ts';

export interface NoteCategoryOption {
  id: string;
  label: string;
}

export const NOTE_CATEGORIES: NoteCategoryOption[] = [
  { id: 'Formulas', label: 'Formulas & Math' },
  { id: 'Study', label: 'Study & Exams' },
  { id: 'Ideas', label: 'Ideas' },
  { id: 'Checklist', label: 'Checklist' },
  { id: 'Finance', label: 'Finance & Life' },
  { id: 'General', label: 'General' },
];

export const NEW_CATEGORY_OPTION_VALUE = '__new_category__';
export const MAX_NOTE_CATEGORY_LENGTH = 24;

export function getNoteCategories(notes: QuickNote[] = []): NoteCategoryOption[] {
  const result: NoteCategoryOption[] = [...NOTE_CATEGORIES];
  const seenLower = new Set(NOTE_CATEGORIES.map((c) => c.id.toLowerCase()));

  for (const note of notes) {
    if (!note || typeof note.category !== 'string') continue;
    const trimmed = note.category.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seenLower.has(lower)) continue;
    seenLower.add(lower);
    result.push({ id: trimmed, label: trimmed });
  }

  return result;
}

export function validateNewNoteCategory(
  raw: string,
  existing: NoteCategoryOption[]
): { ok: true; category: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a category name.' };
  }
  if (trimmed.length > MAX_NOTE_CATEGORY_LENGTH) {
    return {
      ok: false,
      error: `Category must be ${MAX_NOTE_CATEGORY_LENGTH} characters or less.`,
    };
  }
  const duplicate = existing.find(
    (c) =>
      c.id.toLowerCase() === trimmed.toLowerCase() ||
      c.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) {
    return { ok: false, error: `Category "${duplicate.id}" already exists.` };
  }
  return { ok: true, category: trimmed };
}
