"use client";

import { memo, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { hasIngredients, hasSteps } from "@/lib/recipe-utils";
import { MarkdownBody } from "@/components/markdown-body";
import { MessageActions } from "@/components/message-actions";
import { SuggestionsList } from "@/components/suggestions-list";
import { Minus, Plus } from "lucide-react";
import { useFavorite } from "@/hooks/use-favorite";
import { useFeedback } from "@/hooks/use-feedback";
import type { Message } from "@/types";

const ShoppingListModal = dynamic(
  () => import("@/components/shopping-list").then((m) => m.ShoppingListModal),
  { ssr: false }
);

const CookingMode = dynamic(
  () => import("@/components/cooking-mode").then((m) => m.CookingMode),
  { ssr: false }
);

const SUGGESTION_RE = /<!--\s*SUGERENCIAS:\s*(\[[\s\S]*?\])\s*-->/;
const STRIP_RE = /<!--\s*SUGERENCIAS:[\s\S]*?-->/g;
const SERVINGS_RE = /Porciones:\*\*\s*(\d+)/;
const TITLE_RE = /###\s*[🍽️]*\s*(.+)/;
const FRACTION_RE = /(\d+(?:[.,]\d+)?(?:\/\d+)?)\s*(g|kg|ml|l|L|taza|tazas|cucharada|cucharadas|cucharadita|cucharaditas|unidad|unidades|diente|dientes|rama|ramas|hoja|hojas|rodaja|rodajas)?/g;

function parseSuggestions(content: string): string[] {
  const match = content.match(SUGGESTION_RE);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as string[];
  } catch {
    return [];
  }
}

function stripSuggestions(content: string): string {
  return content.replace(STRIP_RE, "").trimEnd();
}

function parseServings(content: string): number | null {
  const match = content.match(SERVINGS_RE);
  return match ? parseInt(match[1], 10) : null;
}

function parseFraction(str: string): number {
  const s = str.replace(",", ".");
  if (s.includes("/")) {
    const [num, den] = s.split("/").map(Number);
    if (!den || isNaN(num) || isNaN(den)) return NaN;
    return num / den;
  }
  return parseFloat(s);
}

function scaleIngredients(content: string, ratio: number): string {
  if (ratio === 1) return content;
  return content.replace(
    FRACTION_RE,
    (match, num, unit) => {
      const parsed = parseFraction(num);
      if (isNaN(parsed) || parsed === 0) return match;
      const scaled = parsed * ratio;
      const display = Number.isInteger(scaled) ? scaled : parseFloat(scaled.toFixed(1));
      return unit ? `${display} ${unit}` : `${display}`;
    }
  );
}

function buildPrintHtml(cleanContent: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /><title>Receta - ChefBot</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#1a1a1a;line-height:1.6}h1,h2,h3{color:#c05c00}ul,ol{padding-left:1.5em}blockquote{border-left:4px solid #c05c00;margin:1em 0;padding:0.5em 1em;background:#fff8f0}hr{border:none;border-top:1px solid #ddd;margin:1.5em 0}p{margin:0.5em 0}</style></head><body>${cleanContent.replace(/^### (.+)$/gm, "<h1>$1</h1>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/^- (.+)$/gm, "<li>$1</li>").replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>").replace(/---/g, "<hr/>").replace(/\n/g, "<br/>")}</body></html>`;
}

interface MessageBubbleProps {
  message: Message;
  isLoading?: boolean;
  onSuggest?: (text: string) => void;
}

function MessageBubbleInner({ message, isLoading, onSuggest }: MessageBubbleProps) {
  const isUser = message.role === "user";

  const [copied, setCopied] = useState(false);
  const [servings, setServings] = useState<number | null>(null);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [showCookingMode, setShowCookingMode] = useState(false);

  const baseServings = useMemo(() => parseServings(message.content), [message.content]);
  const suggestions = useMemo(() => parseSuggestions(message.content), [message.content]);
  const cleanContent = useMemo(() => stripSuggestions(message.content), [message.content]);

  const { favorited, loading: favLoading, toggle: toggleFavorite } = useFavorite(message.id, isUser);
  const { feedback, vote } = useFeedback(message.id, isUser);

  const currentServings = servings ?? baseServings;
  const ratio = baseServings && currentServings ? currentServings / baseServings : 1;
  const displayContent = ratio !== 1 ? scaleIngredients(cleanContent, ratio) : cleanContent;
  const showActions = !isUser && message.content.length > 50 && !isLoading;
  const showServingsScaler = showActions && baseServings;
  const isStreaming = isLoading && message.content === "";

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [cleanContent]);

  const handlePrint = useCallback(() => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildPrintHtml(cleanContent));
    win.document.close();
    win.print();
  }, [cleanContent]);

  const adjustServings = useCallback(
    (delta: number) => {
      setServings((prev) => {
        const base = prev ?? baseServings ?? 1;
        return Math.max(1, base + delta);
      });
    },
    [baseServings]
  );

  const handleOpenShopping = useCallback(() => setShowShoppingList(true), []);
  const handleCloseShopping = useCallback(() => setShowShoppingList(false), []);
  const handleOpenCooking = useCallback(() => setShowCookingMode(true), []);
  const handleCloseCooking = useCallback(() => setShowCookingMode(false), []);

  const canShowShopping = showActions && hasIngredients(cleanContent);
  const canShowCooking = showActions && hasSteps(cleanContent);

  const recipeTitle = cleanContent.match(TITLE_RE)?.[1]?.trim();

  return (
    <div className={cn("flex gap-3 animate-fade-in", isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar className="h-8 w-8 shrink-0 mt-1">
        <AvatarFallback
          className={cn(
            "text-sm font-bold",
            isUser ? "bg-primary text-primary-foreground" : "bg-amber-600 text-white"
          )}
        >
          {isUser ? "Tú" : "🍳"}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start", "max-w-[80%] min-w-0")}>
        {/* Main bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed w-full",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-secondary text-secondary-foreground rounded-tl-sm"
          )}
        >
          {isStreaming ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-40 bg-muted-foreground/20" />
              <Skeleton className="h-3 w-56 bg-muted-foreground/20" />
              <Skeleton className="h-3 w-32 bg-muted-foreground/20" />
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownBody content={displayContent} />
          )}
        </div>

        {showServingsScaler && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <span>Porciones:</span>
            <button
              onClick={() => adjustServings(-1)}
              className="h-6 w-6 rounded-full bg-secondary hover:bg-accent flex items-center justify-center transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="font-bold text-foreground w-4 text-center">{currentServings}</span>
            <button
              onClick={() => adjustServings(1)}
              className="h-6 w-6 rounded-full bg-secondary hover:bg-accent flex items-center justify-center transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
            {ratio !== 1 && (
              <span className="text-amber-400 ml-1">(×{parseFloat(ratio.toFixed(2))})</span>
            )}
          </div>
        )}

        {showActions && (
          <MessageActions
            copied={copied}
            favorited={favorited}
            favLoading={favLoading}
            feedback={feedback}
            showShopping={canShowShopping}
            showCooking={canShowCooking}
            onCopy={handleCopy}
            onToggleFavorite={toggleFavorite}
            onPrint={handlePrint}
            onVote={vote}
            onOpenShopping={handleOpenShopping}
            onOpenCooking={handleOpenCooking}
          />
        )}

        {!isUser && suggestions.length > 0 && !isLoading && (
          <SuggestionsList suggestions={suggestions} onSelect={onSuggest} />
        )}
      </div>

      {showShoppingList && (
        <ShoppingListModal
          isOpen={showShoppingList}
          onClose={handleCloseShopping}
          recipeContent={cleanContent}
          recipeTitle={recipeTitle}
        />
      )}

      {showCookingMode && (
        <CookingMode
          isOpen={showCookingMode}
          onClose={handleCloseCooking}
          recipeContent={cleanContent}
        />
      )}
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleInner);
