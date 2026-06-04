/**
 * API endpoint para Yenny
 * Maneja las conversaciones y actualiza el perfil del usuario
 */

import { getYennyAI } from "@/lib/yenny-ai";
import type { UserProfile } from "@/lib/yenny-prompt";

export const runtime = "nodejs";

interface RequestBody {
  message: string;
  userProfile?: UserProfile;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();

    if (!body.message?.trim()) {
      return new Response(JSON.stringify({ error: "Mensaje vacío" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Obtener cliente de IA
    const yennyAI = getYennyAI();

    // Generar respuesta
    const assistantMessage = await yennyAI.chat(
      body.message,
      body.userProfile,
      body.conversationHistory
    );

    // Actualizar perfil del usuario si es necesario
    const updatedProfile = updateUserProfile(body.userProfile, body.message);

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        updatedProfile,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Yenny API Error]", error);

    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor";

    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Actualiza el perfil del usuario basado en la conversación
 */
function updateUserProfile(
  profile: UserProfile | undefined,
  userMessage: string
): UserProfile | undefined {
  if (!profile) return undefined;

  const updated = { ...profile };

  // Detectar estado emocional
  const emotionalKeywords: Record<string, string> = {
    triste: "triste",
    deprimido: "deprimido",
    ansioso: "ansioso",
    estresado: "estresado",
    feliz: "feliz",
    bien: "bien",
    mal: "mal",
    cansado: "cansado",
  };

  for (const [keyword, mood] of Object.entries(emotionalKeywords)) {
    if (userMessage.toLowerCase().includes(keyword)) {
      updated.mood = mood;
      break;
    }
  }

  // Agregar tópico a historial
  if (!updated.previousTopics) {
    updated.previousTopics = [];
  }

  const firstWords = userMessage.split(" ").slice(0, 5).join(" ");
  if (!updated.previousTopics.includes(firstWords)) {
    updated.previousTopics.push(firstWords);
    if (updated.previousTopics.length > 20) {
      updated.previousTopics = updated.previousTopics.slice(-20);
    }
  }

  return updated;
}
