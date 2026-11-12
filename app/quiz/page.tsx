"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QuestionCard } from "@/components/ui/QuestionCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";

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

function QuizContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subject = searchParams.get("subject") || "Biochemistry";
  const mode = searchParams.get("mode") || "mixed";
  const subtopic = searchParams.get("subtopic") || "";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [timerEnabled, setTimerEnabled] = useState(false);
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

      const { data, error } = await query.order("id", { ascending: true });

      if (error) throw error;

      let loadedQuestions = data || [];
      if (mode === "mixed" && loadedQuestions.length > 0) {
        loadedQuestions = loadedQuestions.sort(() => Math.random() - 0.5);
      }

      setQuestions(loadedQuestions);
      setTimer(0);
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
    await supabase.from("user_progress").insert({
      question_id: currentQuestion.id,
      is_correct: isCorrect,
      selected_answer: selectedAnswer,
    });
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
        <p className="text-gray-600">Loading questions...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-2">
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
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
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
                <h1 className="text-xl font-bold text-gray-900">{subject}</h1>
                <p className="text-xs text-gray-500">
                  Mode: {mode}
                  {subtopic && ` • ${subtopic}`}
                  {" • "}
                  {currentQuestion.major_topic}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Таймер */}
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg">
                <span className="text-sm text-gray-600">⏱️</span>
                <span className="font-mono font-semibold text-gray-900">
                  {formatTime(timer)}
                </span>
                <button
                  onClick={() => setTimerEnabled(!timerEnabled)}
                  className={`text-xs px-2 py-0.5 rounded ${
                    timerEnabled
                      ? "bg-green-200 text-green-800"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {timerEnabled ? "ON" : "OFF"}
                </button>
              </div>

              <div className="text-sm text-gray-600">
                Accuracy:{" "}
                <span className="font-semibold text-blue-600">
                  {accuracy}%
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  {correctCount}
                </span>{" "}
                / {answeredCount} correct
              </div>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-gray-500 mt-1 text-right">
            Question {currentIndex + 1} of {totalQuestions}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-8">
        <QuestionCard
          key={currentQuestion.id}
          question={{
            id: currentQuestion.id,
            subject: currentQuestion.subject,
            topic: `${currentQuestion.major_topic} • ${currentQuestion.subtopic}`,
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
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Next →
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <QuizContent />
    </Suspense>
  );
}