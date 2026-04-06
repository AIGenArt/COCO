"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

export default function E2BAITestPage() {
  const [prompt, setPrompt] = useState("Create a simple counter component with increment and decrement buttons");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const runTest = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setTesting(true);
    setResult(null);
    setError(null);

    try {
      console.log('[Test] Sending request...');
      
      const response = await fetch('/api/ai/e2b-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to test E2B AI integration');
      }

      console.log('[Test] Success:', data);
      setResult(data);
    } catch (err) {
      console.error('[Test] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">E2B AI Integration Test</h1>
            <p className="text-gray-400 mt-2">
              Test AI with direct sandbox access via E2B tools
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Back to Dashboard
          </Button>
        </div>

        <Card className="bg-[#111827] border-[#1F2937] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Test Prompt</h2>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter what you want the AI to build..."
            className="bg-[#1F2937] border-[#374151] min-h-[100px] mb-4"
          />
          <Button
            onClick={runTest}
            disabled={testing}
            className="w-full"
          >
            {testing ? 'Testing... (This may take 1-2 minutes)' : 'Run Test'}
          </Button>
        </Card>

        {error && (
          <Card className="bg-red-900/20 border-red-500/50 p-6 mb-6">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Error</h2>
            <p className="text-red-300">{error}</p>
          </Card>
        )}

        {result && (
          <div className="space-y-6">
            <Card className="bg-[#111827] border-[#1F2937] p-6">
              <h2 className="text-lg font-semibold mb-4">Result</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Success:</span>{' '}
                  <span className={result.result.success ? 'text-green-400' : 'text-red-400'}>
                    {result.result.success ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Message:</span>{' '}
                  <span className="text-gray-300">{result.result.message}</span>
                </div>
                {result.result.files && (
                  <div>
                    <span className="text-gray-500">Files Created:</span>
                    <ul className="list-disc list-inside ml-4 text-gray-300">
                      {result.result.files.map((file: string, i: number) => (
                        <li key={i}>{file}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Sandbox ID:</span>{' '}
                  <span className="text-gray-300 font-mono text-xs">{result.sandboxId}</span>
                </div>
                <div>
                  <span className="text-gray-500">Sandbox URL:</span>{' '}
                  <a 
                    href={result.sandboxUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {result.sandboxUrl}
                  </a>
                </div>
              </div>
            </Card>

            <Card className="bg-[#111827] border-[#1F2937] p-6">
              <h2 className="text-lg font-semibold mb-4">Conversation History</h2>
              <div className="space-y-4">
                {result.messages.map((msg: any, i: number) => (
                  <div key={i} className="border-l-2 border-gray-700 pl-4">
                    <div className="text-xs text-gray-500 mb-1">
                      {msg.role.toUpperCase()}
                      {msg.name && ` (${msg.name})`}
                    </div>
                    <div className="text-sm text-gray-300 whitespace-pre-wrap">
                      {msg.content || '(tool call)'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        <Card className="bg-[#111827] border-[#1F2937] p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
            <li>Creates an E2B sandbox</li>
            <li>Gives AI direct access to the sandbox via tools</li>
            <li>AI writes files using write_file tool</li>
            <li>AI runs commands using execute_bash tool</li>
            <li>AI tests code and fixes errors</li>
            <li>AI iterates until everything works</li>
            <li>Returns success when code is validated</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
