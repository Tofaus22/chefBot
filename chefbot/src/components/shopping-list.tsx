"use client";

import { useState, useMemo, useEffect } from "react";
import { X, ShoppingCart, Check, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractIngredients, categorize } from "@/lib/recipe-utils";
import type { StructuredRecipe } from "@/lib/structured-recipe";

interface ShoppingListProps {
  isOpen: boolean;
  onClose: () => void;
  recipeContent: string;
  recipeTitle?: string;
  structuredRecipe?: StructuredRecipe | null;
  servingsRatio?: number;
}

interface ShoppingItem {
  text: string;
  checked: boolean;
  category: string;
}

function fromStructured(recipe: StructuredRecipe, ratio: number): ShoppingItem[] {
  return recipe.ingredientes.map((ing) => {
    const scaledQty = scaleQuantity(ing.cantidad, ratio);
    const text = scaledQty ? `${scaledQty} ${ing.item}`.trim() : `${ing.cantidad} ${ing.item}`.trim();
    return {
      text: text.replace(/\s+/g, " "),
      checked: false,
      category: categorize(text),
    };
  });
}

function scaleQuantity(cantidad: string, ratio: number): string | null {
  if (ratio === 1) return cantidad;
  const trimmed = cantidad.trim();
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)(.*)$/);
  if (!match) return null;
  const value = parseFractionToken(match[1]);
  if (!Number.isFinite(value)) return null;
  const scaled = value * ratio;
  const display = Number.isInteger(scaled) ? scaled.toString() : scaled.toFixed(1).replace(/\.0$/, "");
  return `${display}${match[2]}`;
}

function parseFractionToken(token: string): number {
  const cleaned = token.replace(",", ".");
  if (cleaned.includes("/")) {
    const [num, den] = cleaned.split(/\s+/).flatMap((p) => p.split("/")).map(Number);
    if (!den || !Number.isFinite(num) || !Number.isFinite(den)) return NaN;
    return num / den;
  }
  return parseFloat(cleaned);
}

export function ShoppingListModal({
  isOpen,
  onClose,
  recipeContent,
  recipeTitle,
  structuredRecipe,
  servingsRatio = 1,
}: ShoppingListProps) {
  const initialItems = useMemo(() => {
    if (structuredRecipe) return fromStructured(structuredRecipe, servingsRatio);
    return extractIngredients(recipeContent);
  }, [structuredRecipe, recipeContent, servingsRatio]);
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const toggleItem = (idx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const checkedCount = items.filter((i) => i.checked).length;

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, ShoppingItem[]> = {};
    items.forEach((item) => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    });
    return map;
  }, [items]);

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = items
      .map((i) => `<li style="text-decoration:${i.checked ? "line-through" : "none"}">${i.text}</li>`)
      .join("\n");
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
      <title>Lista de compras</title>
      <style>body{font-family:sans-serif;max-width:500px;margin:40px auto}h1{color:#c05c00}li{margin:4px 0}</style>
      </head><body><h1>🛒 Lista de compras${recipeTitle ? ` — ${recipeTitle}` : ""}</h1><ul>${rows}</ul></body></html>`);
    win.document.close();
    win.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-amber-500" />
            <h2 className="font-bold text-sm">Lista de compras</h2>
            {items.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {checkedCount}/{items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handlePrint} className="h-7 w-7 text-muted-foreground">
              <Printer className="h-4 w-4" />
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No se encontraron ingredientes en esta receta.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {Object.entries(grouped).map(([cat, catItems]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">{cat}</p>
                  <div className="flex flex-col gap-1">
                    {catItems.map((item) => {
                      const globalIdx = items.indexOf(item);
                      return (
                        <button
                          key={globalIdx}
                          onClick={() => toggleItem(globalIdx)}
                          className={cn(
                            "flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg transition-colors text-sm",
                            item.checked
                              ? "bg-green-500/10 text-muted-foreground line-through"
                              : "bg-secondary hover:bg-accent"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                            item.checked
                              ? "bg-green-500 border-green-500"
                              : "border-border"
                          )}>
                            {item.checked && <Check className="h-3 w-3 text-white" />}
                          </div>
                          {item.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {checkedCount === items.length && items.length > 0 && (
          <div className="px-5 py-3 border-t border-border text-center">
            <p className="text-sm text-green-500 font-semibold">
              ✅ ¡Lista completa! A cocinar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export for backwards compatibility
export { hasIngredients } from "@/lib/recipe-utils";
