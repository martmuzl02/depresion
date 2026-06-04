/**
 * Cliente de IA para Yenny
 * Soporta OpenAI y Anthropic Claude
 */

import { buildYennyPrompt, parseYennyResponse, type UserProfile } from "./yenny-prompt";

export type AIProvider = "openai" | "anthropic";

interface AIClientConfig {
  provider: AIProvider;
  apiKey: string;
}

class YennyAIClient {
  private config: AIClientConfig;

  constructor(config: AIClientConfig) {
    this.config = config;
  }

  async chat(
    userMessage: string,
    userProfile?: UserProfile,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<string> {
    if (this.config.provider === "openai") {
      return this.chatWithOpenAI(userMessage, userProfile, conversationHistory);
    } else if (this.config.provider === "anthropic") {
      return this.chatWithAnthropic(userMessage, userProfile, conversationHistory);
    }

    throw new Error("Proveedor de IA no configurado");
  }

  private async chatWithOpenAI(
    userMessage: string,
    userProfile?: UserProfile,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<string> {
    const systemPrompt = buildYennyPrompt(userProfile);

    const messages = [
      ...(conversationHistory || []).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI error: ${error.error?.message}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error("No response from OpenAI");
    }

    return parseYennyResponse(assistantMessage);
  }

  private async chatWithAnthropic(
    userMessage: string,
    userProfile?: UserProfile,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<string> {
    const systemPrompt = buildYennyPrompt(userProfile);

    const messages = [
      ...(conversationHistory || []).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: userMessage },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 500,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic error: ${error.error?.message}`);
    }

    const data = await response.json();
    const assistantMessage = data.content[0]?.text;

    if (!assistantMessage) {
      throw new Error("No response from Anthropic");
    }

    return parseYennyResponse(assistantMessage);
  }
}

export function initializeYennyAI(): YennyAIClient {
  const provider = (process.env.NEXT_PUBLIC_AI_PROVIDER || "openai") as AIProvider;
  const apiKey = process.env.NEXT_PUBLIC_AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      `API key no configurada para ${provider}. Añade NEXT_PUBLIC_AI_API_KEY a .env.local`
    );
  }

  return new YennyAIClient({ provider, apiKey });
}

let yennyAIInstance: YennyAIClient | null = null;

export function getYennyAI(): YennyAIClient {
  if (!yennyAIInstance) {
    yennyAIInstance = initializeYennyAI();
  }
  return yennyAIInstance;
}
