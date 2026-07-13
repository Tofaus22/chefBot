"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Copy, Check, Heart, Printer, ShoppingCart, UtensilsCrossed,
  Loader2, ThumbsUp, ThumbsDown,
} from "lucide-react";

interface MessageActionsProps {
  copied: boolean;
  favorited: boolean;
  favLoading: boolean;
  feedback: boolean | null;
  showShopping: boolean;
  showCooking: boolean;
  onCopy: () => void;
  onToggleFavorite: () => void;
  onPrint: () => void;
  onVote: (useful: boolean) => void;
  onOpenShopping: () => void;
  onOpenCooking: () => void;
}

function MessageActionsInner({
  copied, favorited, favLoading, feedback,
  showShopping, showCooking,
  onCopy, onToggleFavorite, onPrint,
  onVote, onOpenShopping, onOpenCooking,
}: MessageActionsProps) {
  return (
    <div className="flex items-center gap-1 px-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onCopy}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleFavorite}
        disabled={favLoading}
        className={cn(
          "h-7 px-2 text-xs gap-1",
          favorited ? "text-red-500 hover:text-red-400" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {favLoading
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <Heart className={cn("h-3 w-3", favorited && "fill-current")} />}
        {favorited ? "Guardado" : "Guardar"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onPrint}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
      >
        <Printer className="h-3 w-3" />
        PDF
      </Button>
      {showShopping && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenShopping}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-amber-500 gap-1"
        >
          <ShoppingCart className="h-3 w-3" />
          Compras
        </Button>
      )}
      {showCooking && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenCooking}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-green-500 gap-1"
        >
          <UtensilsCrossed className="h-3 w-3" />
          Cocinar
        </Button>
      )}
      <div className="ml-1 flex items-center gap-0.5 border-l border-border pl-2">
        <button
          onClick={() => onVote(true)}
          title="Útil"
          className={cn(
            "h-6 w-6 flex items-center justify-center rounded transition-colors",
            feedback === true
              ? "text-green-500"
              : "text-muted-foreground hover:text-green-500"
          )}
        >
          <ThumbsUp className="h-3 w-3" />
        </button>
        <button
          onClick={() => onVote(false)}
          title="No útil"
          className={cn(
            "h-6 w-6 flex items-center justify-center rounded transition-colors",
            feedback === false
              ? "text-red-500"
              : "text-muted-foreground hover:text-red-500"
          )}
        >
          <ThumbsDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export const MessageActions = memo(MessageActionsInner);
