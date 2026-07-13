"use client";

import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { X, ChefHat, Check, Loader2 } from "lucide-react";
import { useCulinaryProfile, type CulinaryProfileData } from "@/hooks/use-culinary-profile";

const DIETAS = [
  "Sin restricciones", "Vegetariana", "Vegana", "Sin gluten",
  "Sin lactosa", "Keto", "Paleo", "Mediterránea", "Halal", "Kosher",
];
const NIVELES = ["Principiante", "Intermedio", "Avanzado", "Chef profesional"];
const PRESUPUESTOS = ["Bajo (económico)", "Medio", "Alto (sin límite)"];
const TIEMPOS = ["Menos de 15 min", "15-30 min", "30-60 min", "Más de 1 hora", "No importa"];
const ALERGIAS_COMUNES = ["Gluten", "Lactosa", "Huevos", "Frutos secos", "Mariscos", "Pescado", "Soja", "Sésamo"];

interface CulinaryProfileProps {
  isOpen: boolean;
  onClose: () => void;
  isOnboarding?: boolean;
  onOnboardingComplete?: () => void;
}

function CulinaryProfileInner({
  isOpen, onClose, isOnboarding = false, onOnboardingComplete,
}: CulinaryProfileProps) {
  const { profile, setProfile, loading, saveProfile } = useCulinaryProfile(isOpen);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [alergiasInput, setAlergiasInput] = useState("");
  const [ingredientesInput, setIngredientesInput] = useState("");

  const setField = useCallback(
    <K extends keyof CulinaryProfileData>(key: K, value: CulinaryProfileData[K]) => {
      setProfile((p) => ({ ...p, [key]: value }));
    },
    [setProfile]
  );

  const toggleAlergia = useCallback((a: string) => {
    setProfile((p) => ({
      ...p,
      alergias: p.alergias.includes(a)
        ? p.alergias.filter((x) => x !== a)
        : [...p.alergias, a],
    }));
  }, [setProfile]);

  const addAlergia = useCallback(() => {
    const val = alergiasInput.trim();
    if (!val) return;
    setProfile((p) =>
      val && !p.alergias.includes(val)
        ? { ...p, alergias: [...p.alergias, val] }
        : p
    );
    setAlergiasInput("");
  }, [alergiasInput, setProfile]);

  const removeAlergia = useCallback((a: string) => {
    setProfile((p) => ({ ...p, alergias: p.alergias.filter((x) => x !== a) }));
  }, [setProfile]);

  const addIngrediente = useCallback(() => {
    const val = ingredientesInput.trim();
    if (!val) return;
    setProfile((p) =>
      val && !p.ingredientes_frecuentes.includes(val)
        ? { ...p, ingredientes_frecuentes: [...p.ingredientes_frecuentes, val] }
        : p
    );
    setIngredientesInput("");
  }, [ingredientesInput, setProfile]);

  const removeIngrediente = useCallback((i: string) => {
    setProfile((p) => ({
      ...p,
      ingredientes_frecuentes: p.ingredientes_frecuentes.filter((x) => x !== i),
    }));
  }, [setProfile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await saveProfile(profile);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (isOnboarding) onOnboardingComplete?.();
    }
  }, [profile, isOnboarding, saveProfile, onOnboardingComplete]);

  if (!isOpen) return null;

  const customAlergias = profile.alergias.filter((a) => !ALERGIAS_COMUNES.includes(a));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-amber-500" />
            <h2 className="font-bold text-lg">
              {isOnboarding ? "¡Bienvenido a ChefBot! 👨‍🍳" : "Tu perfil culinario"}
            </h2>
          </div>
          {!isOnboarding && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-6">
            {isOnboarding && (
              <p className="text-sm text-muted-foreground">
                Cuéntame un poco sobre ti para que pueda personalizar mis recetas. Puedes omitir lo que no quieras.
              </p>
            )}

            <PillSelect
              label="🥗 Tipo de dieta"
              options={DIETAS}
              selected={profile.dieta}
              onChange={(v) => setField("dieta", v)}
            />

            <div>
              <label className="block text-sm font-semibold mb-2">⚠️ Alergias e intolerancias</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {ALERGIAS_COMUNES.map((a) => (
                  <button
                    key={a}
                    onClick={() => toggleAlergia(a)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors",
                      profile.alergias.includes(a)
                        ? "bg-red-500/80 text-white border-red-500"
                        : "border-border text-muted-foreground hover:border-red-400 hover:text-foreground"
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Otra alergia..."
                  value={alergiasInput}
                  onChange={(e) => setAlergiasInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addAlergia()}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" onClick={addAlergia} className="h-8 text-xs">
                  Añadir
                </Button>
              </div>
              {customAlergias.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {customAlergias.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full"
                    >
                      {a}
                      <button onClick={() => removeAlergia(a)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <PillSelect
              label="👨‍🍳 Nivel de cocina"
              options={NIVELES}
              selected={profile.nivel}
              onChange={(v) => setField("nivel", v)}
            />
            <PillSelect
              label="💰 Presupuesto habitual"
              options={PRESUPUESTOS}
              selected={profile.presupuesto}
              onChange={(v) => setField("presupuesto", v)}
            />
            <PillSelect
              label="⏱️ Tiempo disponible para cocinar"
              options={TIEMPOS}
              selected={profile.tiempo_disponible}
              onChange={(v) => setField("tiempo_disponible", v)}
            />

            <div>
              <label className="block text-sm font-semibold mb-2">👥 Porciones habituales</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setField("porciones_habituales", Math.max(1, profile.porciones_habituales - 1))}
                  className="h-8 w-8 rounded-full bg-secondary hover:bg-accent flex items-center justify-center transition-colors"
                >
                  <span className="text-sm font-bold">−</span>
                </button>
                <span className="font-bold text-lg w-8 text-center">{profile.porciones_habituales}</span>
                <button
                  onClick={() => setField("porciones_habituales", Math.min(20, profile.porciones_habituales + 1))}
                  className="h-8 w-8 rounded-full bg-secondary hover:bg-accent flex items-center justify-center transition-colors"
                >
                  <span className="text-sm font-bold">+</span>
                </button>
                <span className="text-sm text-muted-foreground">personas</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">🛒 Ingredientes que siempre tienes en casa</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: aceite de oliva, ajo, sal..."
                  value={ingredientesInput}
                  onChange={(e) => setIngredientesInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addIngrediente()}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" onClick={addIngrediente} className="h-8 text-xs">
                  Añadir
                </Button>
              </div>
              {profile.ingredientes_frecuentes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.ingredientes_frecuentes.map((ing) => (
                    <span
                      key={ing}
                      className="inline-flex items-center gap-1 text-xs bg-amber-950/40 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded-full"
                    >
                      {ing}
                      <button onClick={() => removeIngrediente(ing)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 pb-1">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : saved ? (
                  <Check className="h-4 w-4 mr-2 text-green-300" />
                ) : null}
                {saving ? "Guardando..." : saved ? "¡Guardado!" : isOnboarding ? "Empezar a cocinar 🍳" : "Guardar perfil"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PillSelectProps {
  label: string;
  options: readonly string[];
  selected: string | null;
  onChange: (value: string | null) => void;
}

function PillSelect({ label, options, selected, onChange }: PillSelectProps) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(selected === opt ? null : opt)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              selected === opt
                ? "bg-amber-500 text-white border-amber-500"
                : "border-border text-muted-foreground hover:border-amber-500 hover:text-foreground"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export const CulinaryProfile = memo(CulinaryProfileInner);
