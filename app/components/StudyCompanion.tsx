// src/components/StudyCompanion.tsx
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function StudyCompanion() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const searchKnowledge = useQuery(api.searchKnowledge, { query: question });
  const generateAnswer = useMutation(api.generateAnswer);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    try {
      const context = await searchKnowledge;
      const result = await generateAnswer({ question, context });
      setAnswer(result);
    } catch (error) {
      setAnswer("Error generating answer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Ask Your Study Companion</h2>
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What would you like to know?"
          className="w-full p-2 border rounded"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {answer && (
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">Answer:</h3>
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}