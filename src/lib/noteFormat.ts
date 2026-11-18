export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; url: string; label: string };

export type Block =
  | {
      type: 'checklist';
      checked: boolean;
      indent: string;
      lineIndex: number;
      rawText: string;
      tokens: InlineToken[];
    }
  | {
      type: 'line';
      lineIndex: number;
      tokens: InlineToken[];
    };

export interface ChecklistStats {
  total: number;
  done: number;
}

const CHECKLIST_LINE_RE = /^([ \t]*)-\s\[([ xX])\](?:[ \t](.*))?$/;
const CHECKLIST_TOGGLE_RE = /^([ \t]*-\s)\[([ xX])\](?=[ \t]|$)/;
const BARE_URL_RE = /^https?:\/\/[^\s<>"'`]+/i;
const TRAILING_URL_PUNCT_RE = /[.,;:!?'"\]]$/;

export function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function trimBareUrl(candidate: string): string {
  let url = candidate;
  while (url.length > 0) {
    if (TRAILING_URL_PUNCT_RE.test(url)) {
      url = url.slice(0, -1);
      continue;
    }
    if (url.endsWith(')')) {
      const openCount = (url.match(/\(/g) || []).length;
      const closeCount = (url.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        url = url.slice(0, -1);
        continue;
      }
    }
    break;
  }
  return url;
}

function pushText(tokens: InlineToken[], str: string): void {
  if (!str) return;
  const last = tokens[tokens.length - 1];
  if (last && last.type === 'text') {
    last.text += str;
  } else {
    tokens.push({ type: 'text', text: str });
  }
}

export function tokenizeInline(input: string): InlineToken[] {
  if (!input) return [];
  const tokens: InlineToken[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // 1. Inline code: `code`
    if (ch === '`') {
      const endIdx = input.indexOf('`', i + 1);
      if (endIdx > i + 1) {
        tokens.push({ type: 'code', text: input.slice(i + 1, endIdx) });
        i = endIdx + 1;
        continue;
      }
    }

    // 2. Bare http(s):// URL
    if (
      (ch === 'h' || ch === 'H') &&
      (i === 0 || /[\s(\["']/.test(input[i - 1]))
    ) {
      const urlMatch = input.slice(i).match(BARE_URL_RE);
      if (urlMatch) {
        const cleanUrl = trimBareUrl(urlMatch[0]);
        if (cleanUrl && isSafeHttpUrl(cleanUrl)) {
          tokens.push({ type: 'link', url: cleanUrl, label: cleanUrl });
          i += cleanUrl.length;
          continue;
        }
      }
    }

    // 3. Bold: **text**
    if (ch === '*' && input[i + 1] === '*') {
      if (i + 2 < input.length && !/\s/.test(input[i + 2])) {
        let searchFrom = i + 2;
        let matched = false;
        while (searchFrom < input.length) {
          const closeIdx = input.indexOf('**', searchFrom);
          if (closeIdx === -1) break;
          if (closeIdx > i + 2 && !/\s/.test(input[closeIdx - 1])) {
            tokens.push({ type: 'bold', text: input.slice(i + 2, closeIdx) });
            i = closeIdx + 2;
            matched = true;
            break;
          }
          searchFrom = closeIdx + 1;
        }
        if (matched) continue;
      }
    }

    // 4. Italic: *text* (only single *, avoiding spaces around delimiters like 2 * 3)
    if (ch === '*' && input[i + 1] !== '*') {
      if (i + 1 < input.length && !/\s/.test(input[i + 1])) {
        let searchFrom = i + 1;
        let matched = false;
        while (searchFrom < input.length) {
          const closeIdx = input.indexOf('*', searchFrom);
          if (closeIdx === -1) break;
          if (input[closeIdx + 1] === '*') {
            // Skip over ** pairs
            searchFrom = closeIdx + 2;
            continue;
          }
          if (closeIdx > i + 1 && !/\s/.test(input[closeIdx - 1])) {
            tokens.push({ type: 'italic', text: input.slice(i + 1, closeIdx) });
            i = closeIdx + 1;
            matched = true;
            break;
          }
          searchFrom = closeIdx + 1;
        }
        if (matched) continue;
      }
    }

    // 5. Plain text fallback
    pushText(tokens, ch);
    i += 1;
  }

  return tokens;
}

export function parseNoteContent(content: string): Block[] {
  if (typeof content !== 'string' || content.length === 0) {
    return [];
  }

  const lines = content.split('\n');
  return lines.map((rawLine, lineIndex): Block => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    const checklistMatch = line.match(CHECKLIST_LINE_RE);
    if (checklistMatch) {
      const indent = checklistMatch[1] ?? '';
      const mark = checklistMatch[2] ?? ' ';
      const rawText = checklistMatch[3] ?? '';
      return {
        type: 'checklist',
        checked: mark === 'x' || mark === 'X',
        indent,
        lineIndex,
        rawText,
        tokens: tokenizeInline(rawText),
      };
    }
    return {
      type: 'line',
      lineIndex,
      tokens: tokenizeInline(line),
    };
  });
}

export function toggleChecklistLine(content: string, targetLineIndex: number): string {
  if (typeof content !== 'string' || content.length === 0) {
    return content;
  }
  const lines = content.split('\n');
  if (targetLineIndex < 0 || targetLineIndex >= lines.length) {
    return content;
  }

  const rawLine = lines[targetLineIndex];
  const hasCR = rawLine.endsWith('\r');
  const lineBody = hasCR ? rawLine.slice(0, -1) : rawLine;

  const updatedBody = lineBody.replace(
    CHECKLIST_TOGGLE_RE,
    (_match, prefix: string, mark: string) => `${prefix}[${mark === ' ' ? 'x' : ' '}]`
  );

  if (updatedBody === lineBody) {
    return content;
  }

  const nextLines = [...lines];
  nextLines[targetLineIndex] = hasCR ? `${updatedBody}\r` : updatedBody;
  return nextLines.join('\n');
}

export function getChecklistStats(contentOrBlocks: string | Block[]): ChecklistStats {
  const blocks =
    typeof contentOrBlocks === 'string' ? parseNoteContent(contentOrBlocks) : contentOrBlocks;
  let total = 0;
  let done = 0;
  for (const block of blocks) {
    if (block.type === 'checklist') {
      total += 1;
      if (block.checked) {
        done += 1;
      }
    }
  }
  return { total, done };
}

export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

/**
 * Extracts unique #tags from note content without persisting a separate field.
 * Uses the exact pattern /(^|\s)#([\p{L}\p{N}_-]{1,24})/gu on a fresh RegExp instance.
 */
export function extractTags(content: string): string[] {
  if (typeof content !== 'string' || content.length === 0) {
    return [];
  }
  const tagRegex = /(^|\s)#([\p{L}\p{N}_-]{1,24})/gu;
  const tags: string[] = [];
  const seenLower = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(content)) !== null) {
    const tag = match[2];
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (!seenLower.has(key)) {
      seenLower.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

/**
 * Normalizes text for case-insensitive and accent-insensitive (NFD) search matching.
 */
export function normalizeForSearch(text: string): string {
  if (typeof text !== 'string' || text.length === 0) return '';
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Splits `text` into highlighted and non-highlighted React-safe text segments.
 * Handles NFD accent equivalence (e.g. "café" matched by "cafe") and arbitrary
 * regex metacharacters (e.g. "(", "[") without constructing a RegExp.
 */
export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  if (!text) return [];
  const normQuery = normalizeForSearch(query.trim());
  if (!normQuery) {
    return [{ text, highlight: false }];
  }

  let normStr = '';
  const charOrigStart: number[] = [];
  const charOrigEnd: number[] = [];

  let origCursor = 0;
  for (const ch of text) {
    const nextOrig = origCursor + ch.length;
    const normCh = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (normCh.length === 0) {
      if (charOrigEnd.length > 0) {
        charOrigEnd[charOrigEnd.length - 1] = nextOrig;
      }
    } else {
      for (const nc of normCh) {
        normStr += nc;
        charOrigStart.push(origCursor);
        charOrigEnd.push(nextOrig);
      }
    }
    origCursor = nextOrig;
  }

  const segments: HighlightSegment[] = [];
  let searchPos = 0;
  let lastOrigPos = 0;

  while (searchPos <= normStr.length - normQuery.length) {
    const matchIdx = normStr.indexOf(normQuery, searchPos);
    if (matchIdx === -1) break;

    const matchEndIdx = matchIdx + normQuery.length - 1;
    const origStart = charOrigStart[matchIdx];
    const origEnd = charOrigEnd[matchEndIdx];

    if (origStart > lastOrigPos) {
      segments.push({ text: text.slice(lastOrigPos, origStart), highlight: false });
    }
    if (origEnd > origStart) {
      segments.push({ text: text.slice(origStart, origEnd), highlight: true });
    }
    lastOrigPos = origEnd;
    searchPos = matchIdx + normQuery.length;
  }

  if (lastOrigPos < text.length) {
    segments.push({ text: text.slice(lastOrigPos), highlight: false });
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }];
}
