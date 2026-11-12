"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/theme-toggle";

interface ExamResult {
  question_id: number;
  is_correct: boolean;
  selected_answer: string;
  questions: {
    subject: string;
    major_topic: string;
    subtopic: string;
    question: string;
    correct_answer: string;
  };
}

function ExamResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get("examId");

  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalTime, setTotalTime] = useState(0);

  useEffect(() => {
    if (examId) {
      loadResults();
    }
  }, [examId]);

  const loadResults = async () => {
    try {
      const { data, error } = await supabase
        .from("user_progress")
        .select(`
          *,
          questions (
            subject,
            major_topic,
            subtopic,
            question,
            correct_answer
          )
        `)
        .eq("exam_id", examId)
        .order("answered_at", { ascending: true });

      if (error) throw error;

      setResults(data || []);

      // Считаем общее время
      if (data && data.length > 0) {
        const firstAnswer = new Date(data[0].answered_at).getTime();
        const lastAnswer = new Date(
          data[data.length - 1].answered_at
        ).getTime();
        setTotalTime(Math.round((lastAnswer - firstAnswer) / 1000));
      }
    } catch (error) {
      console.error("Error loading results:", error);
    } finally {
      setLoading(false);
    }
  };

  const correctCount = results.filter((r) => r.is_correct).length;
  const totalCount = results.length;
  const accuracy =
    totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const groupedResults = results.reduce((acc, result) => {
    const topic = result.questions.major_topic;
    if (!acc[topic]) {
      acc[topic] = { total: 0, correct: 0 };
    }
    acc[topic].total++;
    if (result.is_correct) acc[topic].correct++;
    return acc;
  }, {} as Record<string, { total: number; correct: number }>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              🎯 Exam Results
            </h1>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-8">
        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {totalCount}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Total Questions</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {correctCount}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Correct</div>
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
              <div className="text-sm text-muted-foreground mt-1">Accuracy</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {formatTime(totalTime)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Time Spent</div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Message */}
        <Card className="mb-8">
          <CardContent className="p-6 text-center">
            <div className="text-5xl mb-4">
              {accuracy >= 80
                ? "🏆"
                : accuracy >= 60
                ? "👍"
                : accuracy >= 40
                ? "📚"
                : "💪"}
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {accuracy >= 80
                ? "Excellent Work!"
                : accuracy >= 60
                ? "Good Job!"
                : accuracy >= 40
                ? "Keep Studying!"
                : "Don't Give Up!"}
            </h2>
            <p className="text-muted-foreground">
              {accuracy >= 80
                ? "You're well prepared for this topic."
                : accuracy >= 60
                ? "You're on the right track. Review the topics below."
                : accuracy >= 40
                ? "Focus on weak areas and try again."
                : "Consider reviewing the fundamentals before retrying."}
            </p>
          </CardContent>
        </Card>

        {/* Breakdown by Topic */}
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Performance by Topic
        </h2>

        <div className="space-y-4 mb-8">
          {Object.entries(groupedResults).map(([topic, stats]) => {
            const topicAccuracy = Math.round(
              (stats.correct / stats.total) * 100
            );
            return (
              <Card key={topic}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-foreground">{topic}</h3>
                    <span
                      className={`text-sm font-semibold ${
                        topicAccuracy >= 70
                          ? "text-green-600 dark:text-green-400"
                          : topicAccuracy >= 50
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {topicAccuracy}% ({stats.correct}/{stats.total})
                    </span>
                  </div>
                  <Progress value={topicAccuracy} className="h-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Detailed Results */}
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Question Review
        </h2>

        <div className="space-y-3">
          {results.map((result, index) => (
            <Card
              key={result.question_id}
              className={
                result.is_correct
                  ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40"
                  : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
              }
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`text-2xl ${
                      result.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {result.is_correct ? "✓" : "✗"}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">
                      Question {index + 1} •{" "}
                      {result.questions.major_topic}
                    </div>
                    <p className="text-sm text-foreground mb-2">
                      {result.questions.question}
                    </p>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Your answer: </span>
                      <span
                        className={
                          result.is_correct
                            ? "text-green-700 dark:text-green-300 font-semibold"
                            : "text-red-700 dark:text-red-300 font-semibold"
                        }
                      >
                        {result.selected_answer}
                      </span>
                      {!result.is_correct && (
                        <>
                          <span className="text-muted-foreground ml-3">
                            Correct:{" "}
                          </span>
                          <span className="text-green-700 dark:text-green-300 font-semibold">
                            {result.questions.correct_answer}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-8">
          <Button
            onClick={() => router.push("/dashboard")}
            variant="outline"
            className="flex-1"
          >
            Back to Dashboard
          </Button>
          <Button
            onClick={() => router.push("/stats")}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            View Statistics
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function ExamResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ExamResultsContent />
    </Suspense>
  );
}