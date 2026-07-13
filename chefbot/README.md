# 🍳 ChefBot

> Asistente culinario con IA conversacional. Recetas adaptadas a tu perfil, modo cocina paso a paso, lista de compras y compartir con un enlace.

Construido con **Next.js 14**, **TypeScript**, **TailwindCSS** y **Supabase**, potenciado por **Llama 3.1** vía **Groq**.

---

## ✨ Qué hace

ChefBot es un chat especializado en cocina que entiende contexto del usuario y convierte cada respuesta en algo accionable:

- **Recetas estructuradas** — el modelo devuelve un envelope JSON con `titulo`, `porciones`, `tiempo`, `dificultad`, `ingredientes`, `pasos` (con temporizadores explícitos), `sustituciones`, `tips` y `maridaje`. La UI renderiza el markdown y además consume los campos estructurados para lista de compras y modo cocina.
- **Perfil culinario** — onboarding ligero (alergias, dieta, nivel, presupuesto, tiempo, porciones habituales) que se inyecta en cada prompt para que el modelo adapte las sugerencias.
- **Historial agrupado** — Hoy / Ayer / Esta semana / Anteriores, con búsqueda, pinned y borrar por grupo.
- **Favoritos** — guarda respuestas concretas con snippet y filtro por dificultad.
- **Modo cocina paso a paso** — avance por pasos, barra de progreso, temporizador por paso con play/pause/reset, "¡Buen provecho!" al terminar.
- **Lista de compras** — ingredientes categorizados (carnes, lácteos, verduras, despensa, especias, huevos, bebidas), marcar comprado, imprimir, escalado por porción cuando hay receta estructurada.
- **Compartir conversación** — enlace público opaco (`/share/[token]`) sin login, revocable, con expiración opcional.
- **Edición y regeneración** — editar tu último mensaje regenera la respuesta; regenerar pide una nueva variante; reintentar tras error de stream.
- **Feedback** — 👍 / 👎 por respuesta; persistido en `recipe_feedback`.
- **Tema claro / oscuro** persistente.

---

## 🧱 Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript |
| UI | TailwindCSS + Radix UI + Lucide icons + react-markdown + remark-gfm |
| Auth + DB | Supabase (Postgres + Auth + RLS) |
| IA | Groq SDK (Llama 3.1) |
| Cliente HTTP | fetch streaming nativo + AbortController |
| Deploy | Netlify (`@netlify/plugin-nextjs`) |

---

## 🏗️ Arquitectura

```
src/
├── app/
│   ├── api/chat/route.ts          # POST streaming; auth server-side, rate limit por userId,
│   │                              # carga perfil culinario, inyecta en system prompt, llama Groq
│   ├── auth/page.tsx              # Login / signup con Supabase
│   ├── chat/page.tsx              # Pantalla principal (sidebar + chat + input)
│   └── share/[token]/page.tsx     # Server Component: vista pública de receta compartida
├── components/
│   ├── sidebar/                   # ContextMenu, ConversationItem, DeleteDialog, ShareToast
│   ├── ui/                        # Button, Input, Card, ScrollArea, Avatar, Skeleton
│   ├── chat-window.tsx            # Lista de mensajes + auto-scroll
│   ├── message-bubble.tsx         # Burbuja con escalado de porciones, modal shopping/cooking
│   ├── input-bar.tsx              # Modo normal + modo edición (Escape / Enter)
│   ├── message-actions.tsx        # Copiar, guardar, PDF, compras, cocinar, regenerar, feedback
│   ├── shopping-list.tsx          # Modal categorizado con escalado numérico estructurado
│   ├── cooking-mode.tsx           # Wizard paso a paso con temporizadores
│   ├── culinary-profile.tsx       # Onboarding + edición de perfil (alergias, dieta, etc.)
│   ├── suggestions-list.tsx       # Sugerencias de seguimiento (del envelope.sugerencias)
│   ├── markdown-body.tsx          # Render seguro de markdown + GFM
│   ├── welcome-screen.tsx         # Sugerencias rápidas iniciales
│   └── chat-suggestions.ts        # Texto de las sugerencias rápidas
├── hooks/
│   ├── use-chat.ts                # Mensajes + streaming + regenerate/retry/edit
│   ├── use-sidebar-data.ts        # Conversaciones + favoritos + shares
│   ├── use-share-conversation.ts  # Generar / revocar token, callbacks UI
│   ├── use-culinary-profile.ts    # Carga / guarda perfil (con cache 30 s)
│   ├── use-favorite.ts            # Toggle de favorito por mensaje
│   ├── use-feedback.ts            # Voto útil / no útil
│   └── use-theme.ts               # Dark / light mode persistente
├── lib/
│   ├── prompts.ts                 # System prompt + inyección de perfil
│   ├── structured-recipe.ts       # Tipos y parser del envelope JSON con fallback a markdown
│   ├── recipe-utils.ts            # Extractores legacy (regex) para mensajes antiguos
│   ├── supabase.ts                # Cliente browser (singleton)
│   ├── supabase-server.ts         # Cliente server con cookies (Next App Router)
│   ├── cache.ts                   # Cache en memoria de userId y perfil
│   ├── group-conversations.ts     # Agrupar conversaciones por fecha
│   └── groq.ts                    # Singleton del cliente Groq + modelo por defecto
├── middleware.ts                  # Protege /chat/* y /auth (anon → /auth, auth → /chat)
└── types/index.ts                 # Message, Conversation, ChatMessage, ChatEnvelope, RecipeProfile
```

### Flujo de una petición de chat

```
1. Usuario envía mensaje en el cliente
   useChat.sendMessage(text)
     ├─ getUserId() (cache 30 s)
     ├─ ensureConversation(userId, title)
     ├─ persistMessage(convId, "user", text, uuid)         ← INSERT en Supabase
     └─ streamAssistant(convId, history)
         │
         ▼
2. POST /api/chat (Server)
     ├─ supabase.auth.getUser()                            ← 401 si no hay sesión
     ├─ rateLimitMap.get(userId)                           ← 429 si > 20 req / 60 s
     ├─ loadProfile(userId) (cache 60 s)
     ├─ buildSystemPrompt(profile)                         ← inyecta contexto culinario
     └─ groqClient.chat.completions.create({ stream: true })
         │
         ▼
3. Stream de chunks (text/plain)
     Cliente usa TextDecoder + requestAnimationFrame
     para evitar re-renders por chunk
         │
         ▼
4. Al cerrar el stream
     fullContent → parseStream(raw)
       ├─ válido: { envelope, display: envelope.answer }
       └─ inválido: { envelope: null, display: raw }
     Se guarda `display` en Supabase (markdown limpio)
     y `structured` en memoria para que la UI lo consuma
         │
         ▼
5. MessageBubble renderiza
     ├─ recipe.titulo (de structured si existe)
     ├─ recipe.porciones → scaler +/-
     ├─ hasIngredients / hasSteps (fallback regex)
     └─ onClick "Compras" → ShoppingListModal(structuredRecipe, ratio)
       onClick "Cocinar" → CookingMode(structuredRecipe)
```

### Por qué envelope JSON en vez de markdown puro

El sistema pide al modelo que envuelva cada respuesta en `{ answer, intent, recipe, sugerencias }`. Beneficios:

- **Estabilidad**: el campo `recipe` se valida con tipos antes de llegar a la UI; el escalado de porciones usa números exactos, no heurísticas regex sobre `"200 g"`.
- **Fallback seguro**: si el modelo no produce JSON válido, `parseStream()` devuelve el texto crudo y la UI cae a los extractores regex de `recipe-utils.ts`. Los mensajes antiguos en la BD siguen funcionando.
- **Temporizadores reales**: `pasos: [{ texto, timer: { minutos: 10 } }]` da temporizadores exactos en modo cocina en lugar de parsear `"10 min"` con regex.

---

## 🗄️ Esquema de datos

Tablas principales (ver `supabase-setup.sql` y `supabase-migrations.sql`):

| Tabla | Para qué |
| --- | --- |
| `users` | Gestionada por Supabase Auth |
| `conversations` | id, user_id, title, pinned, created_at |
| `messages` | id (uuid determinístico), conversation_id, role, content, created_at |
| `culinary_profiles` | user_id, alergias, dieta, nivel, presupuesto, tiempo_disponible, ingredientes_frecuentes, porciones_habituales, onboarding_done |
| `favorites` | user_id, message_id |
| `recipe_feedback` | user_id, message_id, useful |
| `shared_conversations` | conversation_id, owner_id, token (24 chars base36), revoked, expires_at |

Políticas RLS clave:
- `Users manage own data` — cada usuario solo ve/edita sus filas
- `Anyone can read active shares` + `Anyone can read messages of active shared conversations` + `Anyone can read active shared conversation info` — la ruta pública `/share/[token]` solo expone conversaciones con token válido y no revocado

---

## 🚀 Setup local

```bash
cd chefbot
npm install
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

```bash
npm run dev        # desarrollo en http://localhost:3000
npm run build      # build de producción
npm run start      # servidor de producción
npm run lint       # ESLint
npx tsx scripts/parser-smoke.ts   # smoke test del parser del envelope
```

### Base de datos

```bash
# En el SQL editor de Supabase, ejecuta en este orden:
supabase-setup.sql          # esquema inicial + RLS
supabase-migrations.sql     # tablas y políticas adicionales
```

---

## 🌐 Deploy en Netlify

1. Sube el repo a GitHub/GitLab.
2. **Add new site → Import an existing project** en Netlify.
3. Netlify detecta Next.js. `netlify.toml` ya define:
   - Build command: `npm run build`
   - Publish: `.next`
   - Plugin: `@netlify/plugin-nextjs`
   - Node 20
4. **Site settings → Environment variables**: agrega `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`.
5. Deploy.

### Limitaciones serverless a tener en cuenta

- **Rate limit en memoria** (`rateLimitMap` en `route.ts`): vive dentro de una sola instancia. En Netlify con N instancias simultáneas el límite real es `20 req/min × N`. Para producción real migrar a Upstash Redis o Vercel KV.
- **Cache de perfil culinario en memoria** (`profileCache` en `route.ts`): idem, vive por instancia. TTL de 60 s, impacto bajo.
- **`runtime = "nodejs"`** en `/api/chat`: necesario porque Groq SDK y Supabase SSR usan APIs de Node. Netlify lo soporta.

### Dominio propio

Si usas dominio propio, agrégalo a **Supabase → Authentication → URL Configuration** (Site URL + Redirect URLs) para que el login OAuth funcione.

---

## 📋 Roadmap

Las prioridades viven en `mejoras-roadmap.txt`. Resumen del estado actual:

| Item | Estado |
| --- | --- |
| Perfil culinario persistente | ✅ |
| Hardening (auth server-side + rate limit) | ✅ |
| Compartir conversaciones real | ✅ |
| Recetas estructuradas (envelope JSON) | ✅ |
| Lista de compras | ✅ |
| Modo cocina paso a paso | ✅ |
| Plan semanal (UI dedicada) | ⏳ |
| Búsqueda semántica + filtros | ⏳ |
| Métricas y feedback avanzado | ⏳ |

---

## 📄 Licencia

MIT