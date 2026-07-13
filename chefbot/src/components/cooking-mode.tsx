"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Timer, Play, Pause, RotateCcw, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractSteps, extractRecipeTitle } from "@/lib/recipe-utils";
import type { StructuredRecipe } from "@/lib/structured-recipe";
import { asStepText, stepTimerMinutes } from "@/lib/structured-recipe";

interface CookingModeProps {
  isOpen: boolean;
  onClose: () => void;
  recipeContent: string;
  structuredRecipe?: StructuredRecipe | null;
}

interface CookingStep {
  number: number;
  text: string;
  hasTimer: boolean;
  timerMinutes: number;
}

function fromStructured(recipe: StructuredRecipe): CookingStep[] {
  return recipe.pasos.map((step, i) => {
    const minutos = stepTimerMinutes(step);
    return {
      number: i + 1,
      text: asStepText(step),
      hasTimer: minutos > 0,
      timerMinutes: minutos,
    };
  });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CookingMode({
  isOpen,
  onClose,
  recipeContent,
  structuredRecipe,
}: CookingModeProps) {
  const steps = structuredRecipe ? fromStructured(structuredRecipe) : extractSteps(recipeContent);
  const title = structuredRecipe?.titulo ?? extractRecipeTitle(recipeContent);

  const [currentStep, setCurrentStep] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDone, setTimerDone] = useState(false);

  const step = steps[currentStep];

  // Reset timer when step changes
  useEffect(() => {
    setTimerRunning(false);
    setTimerDone(false);
    if (step?.hasTimer) {
      setTimerSeconds(step.timerMinutes * 60);
    } else {
      setTimerSeconds(0);
    }
  }, [currentStep, step]);

  // Timer countdown
  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((s) => {
        if (s <= 1) {
          setTimerRunning(false);
          setTimerDone(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds]);

  const goNext = useCallback(() => {
    if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1);
  }, [currentStep, steps.length]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerDone(false);
    if (step?.hasTimer) setTimerSeconds(step.timerMinutes * 60);
  };

  if (!isOpen) return null;
  if (steps.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-background border border-border rounded-2xl p-6 max-w-sm text-center">
          <p className="text-muted-foreground text-sm mb-4">
            No se encontraron pasos de preparación en esta receta.
          </p>
          <Button onClick={onClose} variant="outline">Cerrar</Button>
        </div>
      </div>
    );
  }

  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Modo cocina</p>
              <p className="font-bold text-sm truncate max-w-[200px]">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Step counter */}
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-xs text-muted-foreground">
            Paso {currentStep + 1} de {steps.length}
          </span>
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === currentStep
                    ? "w-6 bg-amber-500"
                    : i < currentStep
                    ? "w-1.5 bg-amber-500/40"
                    : "w-1.5 bg-border"
                )}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 px-5 py-4 min-h-[120px]">
          <p className="text-base leading-relaxed text-foreground">{step?.text}</p>
        </div>

        {/* Timer (if step has one) */}
        {step?.hasTimer && (
          <div className={cn(
            "mx-5 mb-4 rounded-xl p-4 flex flex-col items-center gap-3",
            timerDone ? "bg-green-500/20 border border-green-500/40" : "bg-amber-500/10 border border-amber-500/20"
          )}>
            <div className="flex items-center gap-2">
              <Timer className={cn("h-4 w-4", timerDone ? "text-green-400" : "text-amber-400")} />
              <span className={cn("text-2xl font-mono font-bold", timerDone ? "text-green-400" : "text-amber-400")}>
                {timerDone ? "¡Listo! ✅" : formatTime(timerSeconds)}
              </span>
            </div>
            <div className="flex gap-2">
              {!timerDone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTimerRunning((r) => !r)}
                  className="h-8 px-4 text-xs gap-1"
                >
                  {timerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {timerRunning ? "Pausar" : "Iniciar"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={resetTimer}
                className="h-8 px-3 text-xs gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reiniciar
              </Button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={currentStep === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>

          {isLast ? (
            <Button
              size="sm"
              onClick={onClose}
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
            >
              ¡Buen provecho! 🍽️
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={goNext}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export for backwards compatibility
export { hasSteps } from "@/lib/recipe-utils";
