"use client";

import { memo } from "react";

interface SuggestionsListProps {
  suggestions: string[];
  onSelect?: (text: string) => void;
}

function SuggestionsListInner({ suggestions, onSelect }: SuggestionsListProps) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect?.(s)}
          className="text-xs bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 px-3 py-1 rounded-full transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export const SuggestionsList = memo(SuggestionsListInner);
