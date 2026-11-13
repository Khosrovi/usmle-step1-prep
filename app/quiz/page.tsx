"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QuestionCard } from "@/components/ui/QuestionCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/theme-toggle";
import { QuizSummary } from "@/components/QuizSummary";
import { saveProgressLocally, markSynced } from "@/lib/progress";

interface Question {
  id: number;
  subject: string;
  major_topic: string;
  subtopic: string;
  vignette: string;
  question: string;
  options: { id: string; text: string }[];
  correct_answer: string;
  explanation_correct: string;
  explanation_incorrect: Record<string, string>;
}

/** One graded answer, kept in memory so the summary can be shown at the end. */
interface Attempt {
  question: Question;
  selectedAnswer: string;
  isCorrect: boolean;
}

/** Length of a timed exam sitting, matching the "20 questions in 10 minutes" goal. */
const EXAM_LENGTH = 40;

/** Fisher-Yates: an unbiased shuffle, unlike sort(() => Math.random() - 0.5). */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function QuizContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subject = searchParams.get("subject") || "Biochemistry";
  const mode = searchParams.get("mode") || "mixed";
  const subtopic = searchParams.get("subtopic") || "";
  // "Practice weakest topics" passes a comma-separated set of subtopics.
  const subtopicsParam = searchParams.get("subtopics") || "";
  const isExam = mode === "exam";

  // Every exam attempt gets its own id so /exam-results can regroup the
  // answers later. Generated once per mounted quiz, not per render.
  const [examId] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `exam-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  });
  const examStartedAt = useRef<number>(0);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [progressSaveFailed, setProgressSaveFailed] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  // Wall-clock length of the sitting, captured when it is finished.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log("🔍 Loading questions...");
    loadQuestions();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [subject, mode, subtopic]);

  // Таймер
  useEffect(() => {
    if (timerEnabled && !loading && questions.length > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerEnabled, loading, questions.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const loadQuestions = async () => {
    try {
      let query = supabase
        .from("questions")
        .select("*")
        .ilike("subject", subject);

      if (subtopic && mode === "topic") {
        query = query.eq("subtopic", subtopic);
      }

      // Weak-area practice: a set of subtopics chosen from /stats.
      const weakTopics = subtopicsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (mode === "weak" && weakTopics.length > 0) {
        query = query.in("subtopic", weakTopics);
      }

      // PostgREST caps a response at 1000 rows unless a range is explicit, so
      // biology-sized banks stay intact regardless of how big a subject grows.
      const { data, error } = await query
        .order("id", { ascending: true })
        .range(0, 4999);

      if (error) throw error;

      let loadedQuestions = data || [];
      if (mode === "mixed" || isExam || mode === "weak") {
        loadedQuestions = shuffle(loadedQuestions);
      }
      // An exam is a fixed-length sitting; mixed practice can run the whole bank.
      if (isExam) {
        loadedQuestions = loadedQuestions.slice(0, EXAM_LENGTH);
      }
      // A weak-area drill stays in one short sitting.
      if (mode === "weak") {
        loadedQuestions = loadedQuestions.slice(0, EXAM_LENGTH);
      }

      setQuestions(loadedQuestions);
      setTimer(0);
      setTimerEnabled(isExam);
      examStartedAt.current = Date.now();
    } catch (error) {
      console.error("Error loading questions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (isCorrect: boolean, selectedAnswer: string) => {
    setAnsweredCount((prev) => prev + 1);
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
    }

    const currentQuestion = questions[currentIndex];
    const answeredAt = new Date().toISOString();

    setAttempts((prev) => [
      ...prev.filter((a) => a.question.id !== currentQuestion.id),
      { question: currentQuestion, selectedAnswer, isCorrect },
    ]);

    // 1. Local first: this always succeeds, so the session summary and the
    //    difficult-questions list are never lost.
    saveProgressLocally({
      questionId: currentQuestion.id,
      isCorrect,
      selectedAnswer,
      examId: isExam ? examId : null,
      answeredAt,
      pending: true,
    });

    // 2. Then mirror to the database. A rejection here (for example the anon
    //    INSERT policy on user_progress not being configured) must not break
    //    the session - the answer is already safely stored locally.
    const { error } = await supabase.from("user_progress").insert({
      question_id: currentQuestion.id,
      is_correct: isCorrect,
      selected_answer: selectedAnswer,
      exam_id: isExam ? examId : null,
    });
    if (error) {
      console.warn("Could not save progress to the database:", error.message);
      setProgressSaveFailed(true);
    } else {
      markSynced([currentQuestion.id]);
      setProgressSaveFailed(false);
    }
  };

  /** Ends the sitting and opens the in-page summary of this test. */
  const handleFinishExam = () => {
    setElapsedSeconds(
      examStartedAt.current
        ? Math.round((Date.now() - examStartedAt.current) / 1000)
        : 0
    );
    setShowSummary(true);
    if (timerRef.current) clearInterval(timerRef.current);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrevious = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBackToDashboard = () => {
    router.push("/dashboard");
  };

  const accuracy =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading questions...</p>
      </div>
    );
  }

  if (showSummary) {
    return (
      <QuizSummary
        attempts={attempts}
        totalQuestions={questions.length}
        subject={subject}
        elapsedSeconds={elapsedSeconds}
        progressSaveFailed={progressSaveFailed}
        onGoToResults={() => {
          const params = new URLSearchParams({
            examId,
            subject,
            total: String(questions.length),
            answered: String(answeredCount),
            correct: String(correctCount),
            duration: String(elapsedSeconds),
          });
          router.push(`/exam-results?${params.toString()}`);
        }}
        onReviewDifficult={() => router.push("/review")}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">
            No questions found for {subject}
            {subtopic && ` • ${subtopic}`}
          </p>
          <Button onClick={handleBackToDashboard} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleBackToDashboard}
                variant="outline"
                size="sm"
              >
                ← Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">{subject}</h1>
                <p className="text-xs text-muted-foreground">
                  Mode: {mode}
                  {subtopic && ` • ${subtopic}`}
                  {" • "}
                  {currentQuestion.major_topic}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Таймер */}
              <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg">
                <span className="text-sm text-muted-foreground">⏱️</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatTime(timer)}
                </span>
                <button
                  onClick={() => setTimerEnabled(!timerEnabled)}
                  className={`text-xs px-2 py-0.5 rounded ${
                    timerEnabled
                      ? "bg-green-200 text-green-800 dark:text-green-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {timerEnabled ? "ON" : "OFF"}
                </button>
              </div>

              <div className="text-sm text-muted-foreground">
                Accuracy:{" "}
                <span className="font-semibold text-primary">
                  {accuracy}%
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {correctCount}
                </span>{" "}
                / {answeredCount} correct
              </div>
              <ThemeToggle />
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-muted-foreground mt-1 text-right">
            Question {currentIndex + 1} of {totalQuestions}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-8">
        {progressSaveFailed && (
          <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-200">
            Your answers are being graded, but progress could not be saved, so
            statistics and exam review will be empty. The database needs the
            anonymous access policies from{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0001_anonymous_progress_policies.sql
            </code>
            .
          </div>
        )}
        <QuestionCard
          key={currentQuestion.id}
          question={{
            id: currentQuestion.id,
            subject: currentQuestion.subject,
            topic: `${currentQuestion.major_topic} • ${currentQuestion.subtopic}`,
            majorTopic: currentQuestion.major_topic,
            subtopic: currentQuestion.subtopic,
            vignette: currentQuestion.vignette,
            question: currentQuestion.question,
            options: currentQuestion.options,
            correctAnswer: currentQuestion.correct_answer,
            explanation: {
              correct: currentQuestion.explanation_correct,
              incorrect: currentQuestion.explanation_incorrect,
            },
          }}
          onAnswer={handleAnswer}
        />

        <div className="flex justify-between mt-6 gap-4">
          <Button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            variant="outline"
            className="flex-1"
          >
            ← Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentIndex === totalQuestions - 1}
            className="flex-1 bg-primary hover:bg-primary/90 text-white"
          >
            Next →
          </Button>
          {isExam && (
            <Button
              onClick={handleFinishExam}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              Finish Exam ({answeredCount}/{totalQuestions})
            </Button>
          )}
        </div>

        {/* A practice session can also be ended early to see the summary; an
            exam already exposes Finish Exam above. */}
        {!isExam && answeredCount > 0 && (
          <div className="mt-4 text-center">
            <Button
              onClick={handleFinishExam}
              variant="outline"
              size="sm"
              className="text-muted-foreground"
            >
              Finish session and see summary ({answeredCount} answered)
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <QuizContent />
    </Suspense>
  );
}