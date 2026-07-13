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

Copia `.env.example` a `.env.local` para desarrollo:

```bash
cp .env.example .env.local
# edita .env.local con tus claves reales
```

Variables necesarias:

| Variable | Tipo | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | pública | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | pública | Clave anónima de Supabase |
| `GROQ_API_KEY` | servidor | API key de [Groq](https://console.groq.com) |

Opcional:

| Variable | Default | Descripción |
| --- | --- | --- |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Modelo Groq a usar |

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

## Deploy en Netlify

1. Sube el repositorio a GitHub/GitLab.
2. En Netlify, **Add new site → Import an existing project** y elige el repo.
3. Netlify detecta Next.js automáticamente. `netlify.toml` ya define:
   - Build command: `npm run build`
   - Publish: `.next`
   - Plugin `@netlify/plugin-nextjs`
   - Node 20
4. En **Site settings → Environment variables**, agrega las mismas claves de `.env.local`.
5. En **Site settings → Build & deploy → Post processing**, asegúrate de que "Bundle dependencies" está activo si quieres cold-start más rápidos.
6. Deploy.

### Limitaciones serverless

- **Rate limit en memoria:** el contador por usuario vive dentro de una sola instancia de la función serverless. En Netlify con varias instancias simultáneas el límite real es `20 req/min × N instancias`. Para producción real, mover a Upstash Redis o Vercel KV.
- **Cache de perfil culinario en memoria:** idem, vive solo dentro de la instancia. TTL de 60 s, así que el impacto es bajo (consultas a Supabase, no a Groq).
- **`runtime = "nodejs"`** en `/api/chat`: necesario porque Groq SDK y Supabase SSR usan APIs de Node. Netlify lo soporta en su runtime Node.

### Dominio y Supabase

Si usas dominio propio en Netlify, agrégalo a **Supabase → Authentication → URL Configuration** (Site URL + Redirect URLs) para que el login OAuth funcione.

## Licencia

MIT
