import React from 'react';
import { Block, InlineToken, isSafeHttpUrl } from '../../lib/noteFormat.ts';
import { HighlightedText } from './HighlightedText.tsx';

interface NoteFormattedContentProps {
  blocks: Block[];
  onToggleChecklistLine?: (lineIndex: number) => void;
  compact?: boolean;
  stopClickPropagation?: boolean;
  highlightQuery?: string;
}

function renderInlineTokens(
  tokens: InlineToken[],
  stopClickPropagation: boolean,
  highlightQuery: string
): React.ReactNode {
  return tokens.map((token, idx) => {
    switch (token.type) {
      case 'bold':
        return (
          <strong key={idx} className="font-bold text-slate-900">
            <HighlightedText text={token.text} query={highlightQuery} />
          </strong>
        );
      case 'italic':
        return (
          <em key={idx} className="italic">
            <HighlightedText text={token.text} query={highlightQuery} />
          </em>
        );
      case 'code':
        return (
          <code
            key={idx}
            className="font-mono text-[0.85em] bg-slate-200/75 text-slate-900 px-1 py-0.5 rounded"
          >
            <HighlightedText text={token.text} query={highlightQuery} />
          </code>
        );
      case 'link':
        if (!isSafeHttpUrl(token.url)) {
          return (
            <React.Fragment key={idx}>
              <HighlightedText text={token.label} query={highlightQuery} />
            </React.Fragment>
          );
        }
        return (
          <a
            key={idx}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stopClickPropagation ? (e) => e.stopPropagation() : undefined}
            className="text-indigo-600 hover:text-indigo-800 underline break-all"
          >
            <HighlightedText text={token.label} query={highlightQuery} />
          </a>
        );
      case 'text':
      default:
        return (
          <React.Fragment key={idx}>
            <HighlightedText text={token.text} query={highlightQuery} />
          </React.Fragment>
        );
    }
  });
}

export const NoteFormattedContent: React.FC<NoteFormattedContentProps> = ({
  blocks,
  onToggleChecklistLine,
  compact = false,
  stopClickPropagation = false,
  highlightQuery = '',
}) => {
  if (blocks.length === 0) return null;

  const rowLeadingClass = compact ? 'leading-5' : 'leading-relaxed';

  return (
    <>
      {blocks.map((block) => {
        if (block.type === 'checklist') {
          return (
            <div
              key={block.lineIndex}
              className={`flex items-start gap-1.5 ${rowLeadingClass}`}
            >
              {block.indent && (
                <span className="whitespace-pre shrink-0" aria-hidden="true">
                  {block.indent}
                </span>
              )}
              <input
                type="checkbox"
                checked={block.checked}
                disabled={!onToggleChecklistLine}
                onChange={() => onToggleChecklistLine?.(block.lineIndex)}
                onClick={stopClickPropagation ? (e) => e.stopPropagation() : undefined}
                aria-label={`Checklist item: ${block.rawText || 'empty item'}`}
                className={`${
                  compact ? 'mt-[3px]' : 'mt-[5px]'
                } h-3.5 w-3.5 rounded border-slate-300 text-slate-900 accent-slate-900 shrink-0 cursor-pointer disabled:cursor-default`}
              />
              <span
                className={`min-w-0 break-words ${
                  block.checked ? 'line-through text-slate-400' : ''
                }`}
              >
                {block.tokens.length > 0
                  ? renderInlineTokens(block.tokens, stopClickPropagation, highlightQuery)
                  : '\u00A0'}
              </span>
            </div>
          );
        }

        if (block.tokens.length === 0) {
          return (
            <div key={block.lineIndex} className={rowLeadingClass} aria-hidden="true">
              {'\u00A0'}
            </div>
          );
        }

        return (
          <div key={block.lineIndex} className={`${rowLeadingClass} break-words`}>
            {renderInlineTokens(block.tokens, stopClickPropagation, highlightQuery)}
          </div>
        );
      })}
    </>
  );
};
