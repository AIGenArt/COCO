'use client';

import { useCallback, useState } from 'react';

/**
 * COCO AI Streaming Hook
 * React hook for streaming AI responses with tool calling
 */

export interface UseAIStreamOptions {
  workspaceId: string;
  model?: string;
  temperature?: number;
  onToolCall?: (toolName: string, args: any, result: any) => void;
  onError?: (error: Error) => void;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
}

export function useAIStream(options: UseAIStreamOptions) {
  const {
    workspaceId,
    model = 'deepseek/deepseek-chat',
    temperature = 0.7,
    onError,
  } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const sendMessage = useCallback(
    async (content: string, role: 'user' | 'assistant' | 'system' = 'user') => {
      const userMessage: Message = {
        role,
        content,
        id: Date.now().toString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setIsStreaming(true);
      setError(null);

      const controller = new AbortController();
      setAbortController(controller);

      try {
        const response = await fetch('/api/ai/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId,
            model,
            temperature,
            messages: [...messages, userMessage].map(m => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let accumulatedText = '';
        const assistantMessageId = Date.now().toString();

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          const chunk = decoder.decode(value);
          accumulatedText += chunk;

          setMessages((prev) => {
            const existing = prev.find(m => m.id === assistantMessageId);
            if (existing) {
              return prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: accumulatedText }
                  : m
              );
            } else {
              return [
                ...prev,
                {
                  role: 'assistant' as const,
                  content: accumulatedText,
                  id: assistantMessageId,
                },
              ];
            }
          });
        }

        setIsLoading(false);
        setIsStreaming(false);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted
          setIsLoading(false);
          setIsStreaming(false);
          return;
        }

        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setIsLoading(false);
        setIsStreaming(false);
        
        if (onError) {
          onError(error);
        }
      } finally {
        setAbortController(null);
      }
    },
    [workspaceId, model, temperature, messages, onError]
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent<HTMLFormElement>) => {
      if (e) {
        e.preventDefault();
      }
      if (!input.trim()) return;
      
      sendMessage(input, 'user');
      setInput('');
    },
    [input, sendMessage]
  );

  const stop = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [abortController]);

  const reload = useCallback(() => {
    if (messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMessage) {
        // Remove last assistant message and resend
        setMessages(prev => prev.filter(m => m.role !== 'assistant' || m.id !== messages[messages.length - 1]?.id));
        sendMessage(lastUserMessage.content, 'user');
      }
    }
  }, [messages, sendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setInput('');
    setError(null);
  }, []);

  return {
    // Messages
    messages,
    
    // Input handling
    input,
    handleInputChange,
    handleSubmit,
    
    // Actions
    sendMessage,
    reload,
    stop,
    clearMessages,
    
    // State
    isLoading,
    isStreaming,
    error,
  };
}

/**
 * Hook for streaming AI responses without chat history
 * Useful for one-off AI requests
 */
export function useAICompletion(options: UseAIStreamOptions) {
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const complete = useCallback(
    async (prompt: string) => {
      setIsLoading(true);
      setError(null);
      setCompletion('');

      try {
        const response = await fetch('/api/ai/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId: options.workspaceId,
            model: options.model || 'deepseek/deepseek-chat',
            temperature: options.temperature || 0.7,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let accumulatedText = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          const chunk = decoder.decode(value);
          accumulatedText += chunk;
          setCompletion(accumulatedText);
        }

        setIsLoading(false);
        return accumulatedText;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setIsLoading(false);
        if (options.onError) {
          options.onError(error);
        }
        throw error;
      }
    },
    [options]
  );

  return {
    completion,
    complete,
    isLoading,
    error,
  };
}
