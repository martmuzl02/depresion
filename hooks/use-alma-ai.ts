/**
 * Hook para usar Yenny AI en componentes React
 */

import { useState, useCallback } from "react";
import { useAppStore } from "./store";
import type { UserProfile } from "./yenny-prompt";

interface UseAlmaReturn {
  sendMessage: (text: string) => Promise<void>;
  isThinking: boolean;
  error: string | null;
  isLoadingHistory: boolean;
  clearError: () => void;
}

export function useAlma(): UseAlmaReturn {
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory] = useState(false);
  const { addAlmaMessage, almaMessages, userProfile } = useAppStore();

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMsg = {
        id: `user-${Date.now()}`,
        role: "user" as const,
        content: text,
      };
      addAlmaMessage(userMsg);
      setError(null);
      setIsThinking(true);

      try {
        const response = await fetch("/api/yenny", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            userProfile: userProfile,
            conversationHistory: almaMessages.slice(-10),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error al comunicarse con Yenny");
        }

        const data = await response.json();

        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: "assistant" as const,
          content: data.message,
        };
        addAlmaMessage(assistantMsg);

        if (data.updatedProfile) {
          useAppStore.setState({ userProfile: data.updatedProfile });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Error desconocido";
        setError(errorMsg);
        console.error("[Yenny Error]", err);
      } finally {
        setIsThinking(false);
      }
    },
    [addAlmaMessage, almaMessages, userProfile]
  );

  return {
    sendMessage,
    isThinking,
    error,
    isLoadingHistory,
    clearError: () => setError(null),
  };
}
