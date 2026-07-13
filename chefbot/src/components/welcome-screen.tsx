"use client";

import { memo } from "react";
import { STARTER_SUGGESTIONS, QUICK_ACTIONS } from "@/components/chat-suggestions";

interface WelcomeScreenProps {
  onSuggest?: (text: string) => void;
}

function WelcomeScreenInner({ onSuggest }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-8">
      <span className="text-6xl">👨‍🍳</span>
      <h2 className="text-xl font-semibold text-foreground">¡Hola! Soy ChefBot</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        Tu asistente culinario personal. Pregúntame sobre recetas, técnicas de cocina, ingredientes o planificación de menús.
      </p>

      <div className="grid grid-cols-2 gap-2 w-full max-w-sm mt-1">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onSuggest?.(action.prompt)}
            className="flex flex-col items-start gap-1 bg-secondary hover:bg-accent border border-border hover:border-amber-500/40 rounded-xl p-3 text-left transition-colors group"
          >
            <span className="text-xl">{action.icon}</span>
            <span className="text-sm font-semibold text-foreground group-hover:text-amber-500 transition-colors">
              {action.label}
            </span>
            <span className="text-xs text-muted-foreground">{action.desc}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {STARTER_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggest?.(suggestion)}
            className="text-xs bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground px-3 py-1.5 rounded-full border border-border transition-colors cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

export const WelcomeScreen = memo(WelcomeScreenInner);
