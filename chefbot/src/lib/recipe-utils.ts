export function hasIngredients(content: string): boolean {
  return /##\s*[🥗]*\s*Ingredientes/i.test(content);
}

export function hasSteps(content: string): boolean {
  return /##\s*[👨‍🍳]*\s*Preparación/i.test(content);
}

interface ShoppingItem {
  text: string;
  checked: boolean;
  category: string;
}

function categorize(line: string): string {
  const l = line.toLowerCase();
  if (/carne|pollo|res|cerdo|cordero|pavo|pescado|salmón|atún|camarón|marisco|gambas/.test(l))
    return "🥩 Carnes y proteínas";
  if (/leche|queso|mantequilla|crema|yogur|nata|lácteo/.test(l))
    return "🧀 Lácteos";
  if (/aceite|sal|pimienta|ajo|cebolla|vinagre|salsa|soja|mostaza|mayonesa|ketchup/.test(l))
    return "🧂 Especias y condimentos";
  if (/harina|arroz|pasta|fideos|pan|avena|quinoa|lenteja|garbanzo|frijol|alubia|maíz/.test(l))
    return "🌾 Despensa";
  if (/huevo/.test(l))
    return "🥚 Huevos";
  if (/vino|cerveza|licor|ron|whisky|vodka/.test(l))
    return "🍷 Bebidas";
  return "🥦 Verduras y frutas";
}

export { categorize };

export function extractIngredients(content: string): ShoppingItem[] {
  const match = content.match(
    /##\s*[🥗]*\s*Ingredientes\s*\n([\s\S]*?)(?=\n##|\n---|\n###|$)/i
  );
  if (!match) return [];

  const lines = match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.replace(/^-\s*/, "").replace(/\[[ x]\]\s*/, "").trim())
    .filter((l) => l.length > 0);

  return lines.map((text) => ({
    text,
    checked: false,
    category: categorize(text),
  }));
}

interface Step {
  number: number;
  text: string;
  hasTimer: boolean;
  timerMinutes: number;
}

export function extractSteps(content: string): Step[] {
  const match = content.match(
    /##\s*[👨‍🍳]*\s*Preparación\s*\n([\s\S]*?)(?=\n##|\n---|\n###|$)/i
  );
  if (!match) return [];

  const lines = match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+\./.test(l))
    .map((l) => l.replace(/^\d+\.\s*/, "").trim());

  return lines.map((text, i) => {
    const timeMatch = text.match(/(\d+)\s*(?:minuto|min|segundo|seg)/i);
    const timerMinutes = timeMatch
      ? text.match(/segundo|seg/i)
        ? Math.ceil(parseInt(timeMatch[1]) / 60)
        : parseInt(timeMatch[1])
      : 0;
    return {
      number: i + 1,
      text,
      hasTimer: timerMinutes > 0,
      timerMinutes,
    };
  });
}

export function extractRecipeTitle(content: string): string {
  const match = content.match(/###\s*[🍽️]*\s*(.+)/);
  return match?.[1]?.trim() ?? "Receta";
}
