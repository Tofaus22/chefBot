export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  structured?: import("@/lib/structured-recipe").ChatEnvelope | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  pinned: boolean;
  messages?: Message[];
}

export interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface RecipeProfile {
  user_id?: string;
  alergias: string[] | null;
  dieta: string | null;
  nivel: string | null;
  presupuesto: string | null;
  tiempo_disponible: string | null;
  ingredientes_frecuentes: string[] | null;
  porciones_habituales: number | null;
  onboarding_done: boolean | null;
  updated_at?: string | null;
}
