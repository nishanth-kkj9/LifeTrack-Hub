import React from 'react';
import { splitHighlightSegments } from '../../lib/noteFormat.ts';

interface HighlightedTextProps {
  text: string;
  query?: string;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({ text, query = '' }) => {
  if (!text) return null;
  if (!query || !query.trim()) {
    return <>{text}</>;
  }

  const segments = splitHighlightSegments(text, query);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.highlight ? (
          <mark
            key={idx}
            className="bg-amber-200/80 text-slate-900 rounded-xs px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
};
