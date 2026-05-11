import { NextRequest, NextResponse } from "next/server";
import { groqClient, GROQ_MODEL } from "@/lib/groq";
import { CHEFBOT_SYSTEM_PROMPT } from "@/lib/prompts";
import type { ChatMessage } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { messages } = (await request.json()) as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Convert to Groq message format
    const groqMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: CHEFBOT_SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.parts.map((p) => p.text).join(""),
      })),
    ];

    // Streaming response
    const stream = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages: groqMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Groq API error:", errMsg);
    return NextResponse.json(
      { error: "Error al conectar con ChefBot. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
