# ChefBot

Asistente culinario con IA conversacional, construido con **Next.js 14**, **TypeScript**, **TailwindCSS** y **Supabase**. Potenciado por **Llama 3.1** vía **Groq**.

## Descripción

ChefBot te ayuda a cocinar mejor: sugiere recetas adaptadas a tu perfil culinario, mantiene un historial de conversaciones, permite guardar favoritas, generar listas de compras, navegar paso a paso en modo cocina y compartir recetas con un enlace.

## Stack

- **Frontend:** Next.js 14 (App Router) + React 18 + TypeScript
- **UI:** TailwindCSS + Radix UI + Lucide icons + react-markdown
- **Backend / Auth:** Supabase (Postgres, Auth, RLS)
- **IA:** Groq SDK (Llama 3.1)
- **Estado / datos:** Hooks propios (`use-chat`, `use-sidebar-data`, `use-favorite`, etc.)

## Funcionalidades

- Chat conversacional con streaming y memoria por conversación.
- Perfil culinario con onboarding inicial (nivel, preferencias, alergias).
- Historial agrupado por fecha (Hoy / Ayer / Esta semana / Anteriores) con búsqueda.
- Favoritos con filtro por dificultad (Fácil / Media / Difícil).
- Modo cocina paso a paso para recetas.
- Lista de compras generada desde una receta.
- Compartir conversación con enlace público (`/share/[token]`).
- Tema claro / oscuro.
- Acciones de mensaje: copiar, regenerar, feedback (like / dislike).
- Botón para eliminar todas las conversaciones de un grupo desde el sidebar.

## Estructura

```
src/
├── app/
│   ├── api/chat/         # Endpoint streaming de chat
│   ├── auth/             # Login / signup
│   ├── chat/             # Pantalla principal
│   └── share/[token]/    # Vista pública de receta compartida
├── components/
│   ├── sidebar/          # ContextMenu, DeleteDialog, ShareToast, ConversationItem
│   ├── ui/               # Button, Input, Card, ScrollArea, Avatar, Skeleton
│   └── *.tsx             # chat-window, input-bar, message-bubble, etc.
├── hooks/                # use-chat, use-sidebar-data, use-favorite, ...
├── lib/                  # supabase client, prompts, cache, group-conversations
└── types/                # Tipos compartidos
```

## Variables de entorno

Crea un archivo `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GROQ_API_KEY=...
```

## Comandos

```bash
npm install
npm run dev        # desarrollo en http://localhost:3000
npm run build      # build de producción
npm run start      # servidor de producción
npm run lint       # ESLint
```

## Base de datos

Ejecuta `supabase-setup.sql` para crear el esquema inicial y `supabase-migrations.sql` para las migraciones posteriores (favoritos, perfil culinario, tokens de compartido, etc.).

## Licencia

MIT
