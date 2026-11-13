"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/lib/supabase";
import {
  readFlags,
  removeFlag,
  updateFlagNote,
  type FlagRecord,
} from "@/lib/progress";

interface FullQuestion {
  id: number;
  major_topic: string;
  subtopic: string;
  vignette: string;
  question: string;
  options: { id: string; text: string }[];
  correct_answer: string;
  explanation_correct: string;
  explanation_incorrect: Record<string, string>;
}

/**
 * "Difficult questions" review list.
 *
 * A place to come back to the questions that were marked during practice or an
 * exam, re-read the explanation, and write a discussion note. The list itself is
 * stored in the browser (see lib/progress.ts); the full question text and
 * explanations are fetched fresh from the bank so the notes always match the
 * current wording.
 */
export default function ReviewPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<FlagRecord[]>([]);
  const [questions, setQuestions] = useState<Map<number, FullQuestion>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const list = readFlags();
    setFlags(list);
    if (list.length > 0) {
      const ids = list.map((f) => f.questionId);
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .in("id", ids);
      if (error) {
        console.error("Could not load flagged questions:", error.message);
      }
      const map = new Map<number, FullQuestion>();
      for (const q of (data as FullQuestion[]) ?? []) map.set(q.id, q);
      setQuestions(map);
    }
    setLoading(false);
  };

  const handleRemove = (questionId: number) => {
    removeFlag(questionId);
    setFlags(readFlags());
    if (expanded === questionId) setExpanded(null);
  };

  const handleSaveNote = (questionId: number) => {
    updateFlagNote(questionId, noteDraft);
    setFlags(readFlags());
  };

  const handlePracticeAll = () => {
    const subtopics = Array.from(
      new Set(flags.map((f) => f.subtopic).filter(Boolean))
    );
    if (subtopics.length === 0) return;
    const subject = flags[0]?.subject || "Immunology";
    router.push(
      `/quiz?subject=${encodeURIComponent(
        subject
      )}&mode=weak&subtopics=${subtopics.map(encodeURIComponent).join(",")}`
    );
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              size="sm"
            >
              ← Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                🚩 Difficult Questions
              </h1>
              <p className="text-sm text-muted-foreground">
                Questions marked for review and discussion
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-8">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : flags.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mb-4 text-5xl">🚩</div>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                No questions marked yet
              </h2>
              <p className="mb-4 text-muted-foreground">
                While practising, press &ldquo;Mark as hard&rdquo; on any question
                you want to come back to. It will show up here with space for your
                own notes.
              </p>
              <Button onClick={() => router.push("/dashboard")}>
                Start practising
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {flags.length} question{flags.length === 1 ? "" : "s"} saved
              </p>
              <Button onClick={handlePracticeAll} variant="outline" size="sm">
                Practise these topics again
              </Button>
            </div>

            <div className="space-y-4">
              {flags.map((flag) => {
                const q = questions.get(flag.questionId);
                const isOpen = expanded === flag.questionId;
                return (
                  <Card key={flag.questionId}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 text-xs text-muted-foreground">
                            {flag.majorTopic}
                            {flag.subtopic ? ` • ${flag.subtopic}` : ""}
                          </div>
                          <CardTitle className="text-base">
                            {q?.question ?? flag.questionText}
                          </CardTitle>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (isOpen) {
                                setExpanded(null);
                              } else {
                                setExpanded(flag.questionId);
                                setNoteDraft(flag.note);
                              }
                            }}
                          >
                            {isOpen ? "Hide" : "Review"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemove(flag.questionId)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {isOpen && (
                      <CardContent className="space-y-4">
                        {q ? (
                          <>
                            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/40">
                              <p className="text-foreground/90">{q.vignette}</p>
                            </div>

                            <div className="space-y-2">
                              {q.options.map((o) => {
                                const isCorrect = o.id === q.correct_answer;
                                const wasPicked = o.id === flag.selectedAnswer;
                                return (
                                  <div
                                    key={o.id}
                                    className={`flex items-start gap-2 rounded-lg border-2 p-3 text-sm ${
                                      isCorrect
                                        ? "border-green-500 bg-green-50 dark:bg-green-950/40"
                                        : wasPicked
                                        ? "border-red-500 bg-red-50 dark:bg-red-950/40"
                                        : "border-border"
                                    }`}
                                  >
                                    <span className="font-semibold">{o.id}.</span>
                                    <span className="flex-1">{o.text}</span>
                                    {isCorrect && (
                                      <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                                        Correct
                                      </span>
                                    )}
                                    {wasPicked && !isCorrect && (
                                      <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                                        You chose
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950/40">
                              <h3 className="mb-1 font-semibold text-green-900 dark:text-green-200">
                                ✓ Why {q.correct_answer} is correct
                              </h3>
                              <p className="text-sm text-green-800 dark:text-green-300">
                                {q.explanation_correct}
                              </p>
                            </div>

                            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950/40">
                              <h3 className="mb-2 font-semibold text-red-900 dark:text-red-200">
                                ✗ Why the others are wrong
                              </h3>
                              <div className="space-y-1 text-sm">
                                {Object.entries(q.explanation_incorrect ?? {}).map(
                                  ([key, text]) => (
                                    <div key={key}>
                                      <span className="font-semibold text-red-700 dark:text-red-300">
                                        {key}:
                                      </span>{" "}
                                      <span className="text-red-800 dark:text-red-300">
                                        {text}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            This question is not in the bank any more, so only your
                            note is available.
                          </p>
                        )}

                        <div>
                          <h3 className="mb-2 font-semibold text-foreground">
                            📝 Discussion note
                          </h3>
                          <Textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Why was this hard? Which concept should you review?"
                            className="bg-card"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => handleSaveNote(flag.questionId)}
                          >
                            Save note
                          </Button>
                        </div>
                      </CardContent>
                    )}

                    {!isOpen && flag.note && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground">
                          📝 {flag.note}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
