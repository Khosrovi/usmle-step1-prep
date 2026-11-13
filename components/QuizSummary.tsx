"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { toggleFlag, isFlagged } from "@/lib/progress";

interface AttemptSummary {
  question: {
    id: number;
    major_topic: string;
    subtopic: string;
    question: string;
    correct_answer: string;
  };
  selectedAnswer: string;
  isCorrect: boolean;
}

interface QuizSummaryProps {
  attempts: AttemptSummary[];
  totalQuestions: number;
  subject: string;
  elapsedSeconds: number;
  progressSaveFailed: boolean;
  onGoToResults: () => void;
  onReviewDifficult: () => void;
  onBackToDashboard: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

/**
 * End-of-test summary.
 *
 * Shows the headline score of the sitting just finished, breaks it down by
 * major topic so the weak areas are obvious, and offers a one-click way to
 * carry the missed questions over to the "difficult questions" list for later
 * review and discussion.
 */
export function QuizSummary({
  attempts,
  totalQuestions,
  subject,
  elapsedSeconds,
  progressSaveFailed,
  onGoToResults,
  onReviewDifficult,
  onBackToDashboard,
}: QuizSummaryProps) {
  const answered = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const missed = attempts.filter((a) => !a.isCorrect);
  const unanswered = totalQuestions - answered;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  // Group by major topic so the breakdown reads like a score report.
  const byTopic = useMemo(() => {
    const map = new Map<string, { total: number; correct: number }>();
    for (const a of attempts) {
      const key = a.question.major_topic || "Uncategorized";
      const entry = map.get(key) ?? { total: 0, correct: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([topic, s]) => ({
        topic,
        ...s,
        accuracy: Math.round((s.correct / s.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [attempts]);

  const saveMissedToReview = () => {
    for (const a of missed) {
      if (isFlagged(a.question.id)) continue;
      toggleFlag({
        questionId: a.question.id,
        subject,
        majorTopic: a.question.major_topic ?? "",
        subtopic: a.question.subtopic ?? "",
        questionText: a.question.question,
        selectedAnswer: a.selectedAnswer,
        note: "",
        flaggedAt: new Date().toISOString(),
      });
    }
  };

  const verdict =
    accuracy >= 80
      ? { emoji: "🏆", title: "Excellent Work!", body: "You're well prepared on this material." }
      : accuracy >= 60
      ? { emoji: "👍", title: "Good Job!", body: "Solid base. Review the topics below to tighten it up." }
      : accuracy >= 40
      ? { emoji: "📚", title: "Keep Studying!", body: "Focus on the weakest topics below, then retake." }
      : { emoji: "💪", title: "Don't Give Up!", body: "Go back over the fundamentals for these topics before retrying." };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Test complete — {subject}
            </h1>
            <p className="text-sm text-muted-foreground">
              Summary of this sitting
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-8">
        {progressSaveFailed && (
          <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-200">
            Your answers are saved in this browser. Cloud statistics are
            unavailable until the database grants anonymous write access to{" "}
            <code className="font-mono text-xs">user_progress</code> — see{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0001_anonymous_progress_policies.sql
            </code>
            .
          </div>
        )}

        {/* Headline numbers */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {answered}
                <span className="text-lg text-muted-foreground">
                  /{totalQuestions}
                </span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Answered</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {correct}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Correct</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div
                className={`text-3xl font-bold ${
                  accuracy >= 70
                    ? "text-green-600 dark:text-green-400"
                    : accuracy >= 50
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {accuracy}%
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Accuracy</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {formatDuration(elapsedSeconds)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Time spent</div>
            </CardContent>
          </Card>
        </div>

        {/* Verdict */}
        <Card className="mb-8">
          <CardContent className="p-6 text-center">
            <div className="mb-3 text-5xl">{verdict.emoji}</div>
            <h2 className="mb-1 text-2xl font-bold text-foreground">
              {verdict.title}
            </h2>
            <p className="text-muted-foreground">{verdict.body}</p>
            {unanswered > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {unanswered} question{unanswered === 1 ? "" : "s"} left
                unanswered.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Breakdown by major topic */}
        {byTopic.length > 0 && (
          <>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Results by topic
            </h2>
            <div className="mb-8 space-y-3">
              {byTopic.map((t) => (
                <Card key={t.topic}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">{t.topic}</h3>
                      <span
                        className={`text-sm font-semibold ${
                          t.accuracy >= 70
                            ? "text-green-600 dark:text-green-400"
                            : t.accuracy >= 50
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {t.accuracy}% ({t.correct}/{t.total})
                      </span>
                    </div>
                    <Progress value={t.accuracy} className="h-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Missed questions */}
        {missed.length > 0 && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                Missed questions ({missed.length})
              </h2>
              <Button onClick={saveMissedToReview} variant="outline" size="sm">
                🚩 Add all to review list
              </Button>
            </div>
            <div className="mb-8 space-y-2">
              {missed.map((a) => (
                <Card
                  key={a.question.id}
                  className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                >
                  <CardContent className="p-4 text-sm">
                    <div className="mb-1 text-xs text-muted-foreground">
                      {a.question.major_topic}
                      {a.question.subtopic ? ` • ${a.question.subtopic}` : ""}
                    </div>
                    <p className="mb-1 text-foreground">{a.question.question}</p>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Your answer: </span>
                      <span className="font-semibold text-red-700 dark:text-red-300">
                        {a.selectedAnswer}
                      </span>
                      <span className="ml-3 text-muted-foreground">Correct: </span>
                      <span className="font-semibold text-green-700 dark:text-green-300">
                        {a.question.correct_answer}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={onBackToDashboard} variant="outline" className="flex-1">
            Back to Dashboard
          </Button>
          <Button onClick={onReviewDifficult} variant="outline" className="flex-1">
            🚩 Review difficult questions
          </Button>
          <Button
            onClick={onGoToResults}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            Full exam report
          </Button>
        </div>
      </div>
    </main>
  );
}
