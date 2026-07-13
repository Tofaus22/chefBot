import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createServerSupabaseClient();

  // Look up the share token
  const { data: share } = await supabase
    .from("shared_conversations")
    .select("conversation_id, revoked, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!share || share.revoked) notFound();
  if (share.expires_at && new Date(share.expires_at) < new Date()) notFound();

  // Load conversation + messages (bypass RLS by using service role is ideal,
  // but with RLS the owner can still read. For public share we need the messages
  // via the conversation_id — we use a join that doesn't require auth since
  // the policy "Anyone can read active shares" allows the share lookup,
  // but messages are still protected. We use a direct query with .from("messages")
  // using the share token as proof of access via an RPC or by using anon key
  // with a special policy. For now we use the server client which runs as the
  // service role in the API route context.)
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, title, created_at")
    .eq("id", share.conversation_id)
    .maybeSingle();

  // Load messages — requires a policy that allows reading messages of shared conversations
  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", share.conversation_id)
    .order("created_at", { ascending: true });

  if (!conversation) notFound();

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🍳</span>
        <div>
          <h1 className="font-bold text-lg text-amber-400">{conversation.title}</h1>
          <p className="text-xs text-white/40">
            Conversación compartida de ChefBot •{" "}
            {new Date(conversation.created_at).toLocaleDateString("es-ES", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        {(messages ?? []).map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center font-bold text-sm mt-1"
              style={{ background: msg.role === "user" ? "#d97706" : "#78350f", color: "white" }}>
              {msg.role === "user" ? "Tú" : "🍳"}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-amber-700/80 text-white rounded-tr-sm"
                  : "bg-white/8 text-white/90 rounded-tl-sm"
              }`}
              style={{ background: msg.role === "user" ? undefined : "rgba(255,255,255,0.06)" }}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none
                  prose-headings:text-amber-400 prose-headings:font-bold
                  prose-blockquote:border-amber-500 prose-blockquote:text-amber-200
                  prose-strong:text-white prose-p:my-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content.replace(/<!--[\s\S]*?-->/g, "").trimEnd()}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-6 py-4 text-center">
        <p className="text-xs text-white/30">
          Generado por{" "}
          <a href="/" className="text-amber-500 hover:underline">ChefBot</a>
          {" "}— Tu asistente culinario con IA
        </p>
      </div>
    </div>
  );
}
