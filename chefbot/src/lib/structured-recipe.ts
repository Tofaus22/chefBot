export type Difficulty = "Fácil" | "Media" | "Difícil";
export type ChatIntent = "recipe" | "shopping_list" | "weekly_plan" | "chat";

export interface StructuredIngredient {
  cantidad: string;
  item: string;
}

export interface StructuredStepTimer {
  minutos: number;
}

export interface StructuredStep {
  texto: string;
  timer?: StructuredStepTimer;
}

export interface StructuredSubstitution {
  original: string;
  alternativa: string;
  razon: string;
}

export interface StructuredRecipe {
  titulo: string;
  porciones: number;
  tiempo: string;
  dificultad: Difficulty;
  calorias?: string;
  ingredientes: StructuredIngredient[];
  pasos: (string | StructuredStep)[];
  sustituciones: StructuredSubstitution[];
  tips: string[];
  maridaje?: string;
}

export interface ChatEnvelope {
  answer: string;
  intent: ChatIntent;
  recipe: StructuredRecipe | null;
  sugerencias: string[];
}

export interface ParsedStream {
  envelope: ChatEnvelope | null;
  display: string;
}

const VALID_INTENTS: ChatIntent[] = ["recipe", "shopping_list", "weekly_plan", "chat"];
const VALID_DIFFICULTIES: Difficulty[] = ["Fácil", "Media", "Difícil"];

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function parseIngredient(value: unknown): StructuredIngredient | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const cantidad = asString(v.cantidad)?.trim() ?? "";
  const item = asString(v.item)?.trim() ?? "";
  if (!cantidad && !item) return null;
  return { cantidad, item };
}

function parseStep(value: unknown): string | StructuredStep | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    const texto = asString(v.texto)?.trim();
    if (!texto) return null;
    const timerObj =
      v.timer && typeof v.timer === "object"
        ? (v.timer as Record<string, unknown>)
        : null;
    const minutos = asNumber(timerObj?.minutos ?? v.timerMinutos);
    if (minutos !== null && minutos > 0) {
      return { texto, timer: { minutos } };
    }
    return texto;
  }
  return null;
}

function parseSubstitution(value: unknown): StructuredSubstitution | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const original = asString(v.original)?.trim();
  const alternativa = asString(v.alternativa)?.trim();
  if (!original || !alternativa) return null;
  return {
    original,
    alternativa,
    razon: asString(v.razon)?.trim() ?? "",
  };
}

function parseRecipe(value: unknown): StructuredRecipe | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const titulo = asString(v.titulo)?.trim();
  const porciones = asNumber(v.porciones);
  const tiempo = asString(v.tiempo)?.trim();
  const dificultadRaw = asString(v.dificultad);
  const dificultad =
    dificultadRaw && VALID_DIFFICULTIES.includes(dificultadRaw as Difficulty)
      ? (dificultadRaw as Difficulty)
      : "Media";
  if (!titulo || porciones === null || !tiempo) return null;

  const ingredientes = Array.isArray(v.ingredientes)
    ? v.ingredientes.map(parseIngredient).filter((x): x is StructuredIngredient => x !== null)
    : [];
  const pasos = Array.isArray(v.pasos)
    ? v.pasos.map(parseStep).filter((x): x is string | StructuredStep => x !== null)
    : [];
  const sustituciones = Array.isArray(v.sustituciones)
    ? v.sustituciones
        .map(parseSubstitution)
        .filter((x): x is StructuredSubstitution => x !== null)
    : [];
  const tips = asStringArray(v.tips).map((t) => t.trim()).filter(Boolean);
  const maridaje = asString(v.maridaje)?.trim();

  return {
    titulo,
    porciones,
    tiempo,
    dificultad,
    calorias: asString(v.calorias)?.trim() || undefined,
    ingredientes,
    pasos,
    sustituciones,
    tips,
    maridaje: maridaje || undefined,
  };
}

export function parseEnvelope(raw: string): ChatEnvelope | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const v = parsed as Record<string, unknown>;
  const answer = asString(v.answer);
  if (answer === null) return null;

  const intentRaw = asString(v.intent);
  const intent: ChatIntent =
    intentRaw && VALID_INTENTS.includes(intentRaw as ChatIntent)
      ? (intentRaw as ChatIntent)
      : "chat";

  return {
    answer,
    intent,
    recipe: intent === "recipe" ? parseRecipe(v.recipe) : null,
    sugerencias: asStringArray(v.sugerencias).map((s) => s.trim()).filter(Boolean),
  };
}

export function parseStream(raw: string): ParsedStream {
  const envelope = parseEnvelope(raw);
  if (!envelope) return { envelope: null, display: raw };
  return { envelope, display: envelope.answer };
}

export function isStructuredRecipe(message: { structured?: ChatEnvelope | null }): boolean {
  return !!message.structured?.recipe;
}

export function asStepText(step: string | StructuredStep): string {
  return typeof step === "string" ? step : step.texto;
}

export function stepTimerMinutes(step: string | StructuredStep): number {
  if (typeof step === "string") return 0;
  return step.timer?.minutos ?? 0;
}