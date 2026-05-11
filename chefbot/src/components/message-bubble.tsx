"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy, Check, Heart, Printer, Minus, Plus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  isLoading?: boolean;
  onSuggest?: (text: string) => void;
}

// Parse suggestion block from markdown: <!-- SUGERENCIAS: [...] -->
function parseSuggestions(content: string): string[] {
  const match = content.match(/<!--\s*SUGERENCIAS:\s*(\[[\s\S]*?\])\s*-->/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as string[];
  } catch {
    return [];
  }
}

// Remove suggestion comment from displayed content
function stripSuggestions(content: string): string {
  return content.replace(/<!--\s*SUGERENCIAS:[\s\S]*?-->/g, "").trimEnd();
}

// Extract servings from metadata line: 👥 **Porciones:** N
function parseServings(content: string): number | null {
  const match = content.match(/Porciones:\*\*\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Scale ingredient quantities in content based on ratio
function scaleIngredients(content: string, ratio: number): string {
  if (ratio === 1) return content;
  // Match numbers (including decimals and fractions like 1/2) before ingredient words
  return content.replace(
    /(\d+(?:[.,]\d+)?(?:\/\d+)?)\s*(g|kg|ml|l|L|taza|tazas|cucharada|cucharadas|cucharadita|cucharaditas|unidad|unidades|diente|dientes|rama|ramas|hoja|hojas|rodaja|rodajas)?/g,
    (match, num, unit) => {
      const parsed = eval(num.replace(",", ".")); // handles "1/2" etc
      if (isNaN(parsed) || parsed === 0) return match;
      const scaled = parsed * ratio;
      const display = Number.isInteger(scaled) ? scaled : parseFloat(scaled.toFixed(1));
      return unit ? `${display} ${unit}` : `${display}`;
    }
  );
}

export function MessageBubble({ message, isLoading, onSuggest }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [servings, setServings] = useState<number | null>(null);
  const supabase = createClient();

  const baseServings = useMemo(() => parseServings(message.content), [message.content]);
  const suggestions = useMemo(() => parseSuggestions(message.content), [message.content]);
  const cleanContent = useMemo(() => stripSuggestions(message.content), [message.content]);

  // Load favorite state from Supabase on mount (only for saved assistant messages)
  useEffect(() => {
    if (isUser || !message.id) return;
    // Only query if it looks like a real UUID (not an optimistic temp ID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(message.id)) return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("message_id", message.id)
        .maybeSingle();
      if (!cancelled) setFavorited(!!data);
    })();
    return () => { cancelled = true; };
  }, [message.id, isUser, supabase]);

  const handleToggleFavorite = useCallback(async () => {
    if (favLoading) return;
    setFavLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setFavLoading(false); return; }

    if (favorited) {
      await supabase
        .from("favorites")
        .delete()
        .eq("message_id", message.id)
        .eq("user_id", user.id);
      setFavorited(false);
    } else {
      await supabase
        .from("favorites")
        .insert({ message_id: message.id, user_id: user.id });
      setFavorited(true);
    }
    setFavLoading(false);
  }, [favorited, favLoading, message.id, supabase]);

  const currentServings = servings ?? baseServings;
  const ratio = baseServings && currentServings ? currentServings / baseServings : 1;
  const displayContent = ratio !== 1 ? scaleIngredients(cleanContent, ratio) : cleanContent;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Receta - ChefBot</title>
        <style>
          body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; line-height: 1.6; }
          h1,h2,h3 { color: #c05c00; }
          ul, ol { padding-left: 1.5em; }
          blockquote { border-left: 4px solid #c05c00; margin: 1em 0; padding: 0.5em 1em; background: #fff8f0; }
          hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
          p { margin: 0.5em 0; }
        </style>
      </head>
      <body>${cleanContent
        .replace(/^### (.+)$/gm, "<h1>$1</h1>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/^- (.+)$/gm, "<li>$1</li>")
        .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
        .replace(/---/g, "<hr/>")
        .replace(/\n/g, "<br/>")
      }</body></html>
    `);
    win.document.close();
    win.print();
  };

  const adjustServings = (delta: number) => {
    const base = currentServings ?? 1;
    const next = Math.max(1, base + delta);
    setServings(next);
  };

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
          {isLoading && message.content === "" ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-40 bg-muted-foreground/20" />
              <Skeleton className="h-3 w-56 bg-muted-foreground/20" />
              <Skeleton className="h-3 w-32 bg-muted-foreground/20" />
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none
              dark:prose-invert
              prose-headings:text-amber-700 dark:prose-headings:text-amber-400
              prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
              prose-h2:text-base prose-h3:text-base
              prose-strong:text-foreground
              prose-ul:my-2 prose-ol:my-2
              prose-li:my-0.5
              prose-blockquote:border-amber-500 prose-blockquote:bg-amber-100/60 dark:prose-blockquote:bg-amber-950/30
              prose-blockquote:rounded-r-lg prose-blockquote:py-1
              prose-blockquote:text-amber-800 dark:prose-blockquote:text-amber-200
              prose-hr:border-border prose-hr:my-3
              prose-p:my-1
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {displayContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Servings scaler — only for assistant messages with detected servings */}
        {!isUser && baseServings && !isLoading && message.content.length > 50 && (
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

        {/* Action buttons — only for non-empty assistant messages */}
        {!isUser && message.content.length > 50 && !isLoading && (
          <div className="flex items-center gap-1 px-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFavorite}
              disabled={favLoading}
              className={cn(
                "h-7 px-2 text-xs gap-1",
                favorited ? "text-red-500 hover:text-red-400" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {favLoading
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Heart className={cn("h-3 w-3", favorited && "fill-current")} />
              }
              {favorited ? "Guardado" : "Guardar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <Printer className="h-3 w-3" />
              PDF
            </Button>
          </div>
        )}

        {/* Quick reply suggestions */}
        {!isUser && suggestions.length > 0 && !isLoading && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggest?.(s)}
                className="text-xs bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 px-3 py-1 rounded-full transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
