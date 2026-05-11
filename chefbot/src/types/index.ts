export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
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
