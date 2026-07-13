import type { Conversation } from "@/types";

function dayStart(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function groupByDate(conversations: Conversation[]): Record<string, Conversation[]> {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterday = new Date(todayStart);
  yesterday.setDate(todayStart.getDate() - 1);
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(todayStart.getDate() - 7);

  const groups: Record<string, Conversation[]> = {
    Anclados: [],
    Hoy: [],
    Ayer: [],
    "Esta semana": [],
    Anteriores: [],
  };

  for (const conv of conversations) {
    if (conv.pinned) {
      groups.Anclados.push(conv);
      continue;
    }
    const day = dayStart(conv.created_at);
    if (day >= todayStart) groups.Hoy.push(conv);
    else if (day >= yesterday) groups.Ayer.push(conv);
    else if (day >= weekAgo) groups["Esta semana"].push(conv);
    else groups.Anteriores.push(conv);
  }

  for (const key of Object.keys(groups)) {
    if (groups[key].length === 0) delete groups[key];
  }
  return groups;
}
