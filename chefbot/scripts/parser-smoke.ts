// Smoke test for parseStream / parseEnvelope.
// Run with: npx tsx scripts/parser-smoke.ts (or node --loader ts-node/esm).
// We use plain Node + tsx-style via `npx tsc --noEmit`-style: instead just
// compile a temp JS via ts-node-less path: we'll use the bundled transformer
// by writing the file with .ts extension and running via `node --import tsx`.
import { parseStream } from "../src/lib/structured-recipe";

const recipeEnvelope = JSON.stringify({
  answer:
    "### 🍽️ Pasta Bolognesa\n\n> ⏱️ Tiempo: 30 min\n\n## 🥗 Ingredientes\n- 400 g pasta",
  intent: "recipe",
  recipe: {
    titulo: "Pasta Bolognesa",
    porciones: 4,
    tiempo: "30 min",
    dificultad: "Fácil",
    calorias: "450 kcal/porción",
    ingredientes: [
      { cantidad: "400 g", item: "pasta" },
      { cantidad: "2 unidades", item: "tomate" },
    ],
    pasos: [
      "Hervir la pasta",
      { texto: "Cocinar la salsa 10 min", timer: { minutos: 10 } },
    ],
    sustituciones: [
      { original: "carne", alternativa: "lentejas", razon: "versión veggie" },
    ],
    tips: ["Usa pasta fresca"],
    maridaje: "Vino tinto",
  },
  sugerencias: ["Versión vegana", "Lista de compras"],
});

const chatEnvelope = JSON.stringify({
  answer: "¡Hola! Soy ChefBot, ¿qué te gustaría cocinar?",
  intent: "chat",
  recipe: null,
  sugerencias: [],
});

const samples: Array<[string, string]> = [
  ["recipe JSON", recipeEnvelope],
  ["chat JSON", chatEnvelope],
  ["plain text fallback", "Esto es texto markdown normal sin envelope."],
  ["truncated JSON", '{"answer": "ok", "intent": "chat"'],
];

let pass = 0;
let fail = 0;

function expect(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${label}  ${detail}`);
  }
}

for (const [label, raw] of samples) {
  console.log(`\n[${label}]`);
  const r = parseStream(raw);
  if (label === "recipe JSON") {
    expect("envelope parsed", r.envelope !== null);
    expect("intent = recipe", r.envelope?.intent === "recipe");
    expect("display is markdown", r.display.startsWith("### 🍽️"));
    expect(
      "recipe has 2 ingredientes",
      r.envelope?.recipe?.ingredientes.length === 2
    );
    expect(
      "first step is plain string",
      r.envelope?.recipe?.pasos[0] === "Hervir la pasta"
    );
    expect(
      "second step has timer",
      typeof r.envelope?.recipe?.pasos[1] === "object" &&
        (r.envelope.recipe.pasos[1] as { timer?: { minutos: number } }).timer
          ?.minutos === 10
    );
    expect("sugerencias preserved", r.envelope?.sugerencias.length === 2);
  } else if (label === "chat JSON") {
    expect("envelope parsed", r.envelope !== null);
    expect("intent = chat", r.envelope?.intent === "chat");
    expect("recipe is null", r.envelope?.recipe === null);
    expect(
      "display equals answer",
      r.display === "¡Hola! Soy ChefBot, ¿qué te gustaría cocinar?"
    );
  } else if (label === "plain text fallback") {
    expect("envelope is null", r.envelope === null);
    expect("display equals raw", r.display === raw);
  } else if (label === "truncated JSON") {
    expect("envelope is null on bad JSON", r.envelope === null);
    expect("display equals raw on bad JSON", r.display === raw);
  }
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);