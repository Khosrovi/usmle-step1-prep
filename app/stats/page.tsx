"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { readProgress } from "@/lib/progress";
import { ThemeToggle } from "@/components/theme-toggle";

interface TopicStats {
  major_topic: string;
  subtopic: string;
  total_questions: number;
  answered: number;
  correct: number;
  accuracy: number;
}

interface SubjectStats {
  subject: string;
  total_questions: number;
  answered: number;
  correct: number;
  accuracy: number;
}

/**
 * "Practice my weakest topics" - the roadmap item. Picks up to three subtopics
 * that were actually attempted and scored below the 70% target, worst first,
 * so the drill is always backed by real data rather than guesses.
 */
function WeakAreaCard({
  topicStats,
  disabled,
  onPractice,
}: {
  topicStats: TopicStats[];
  disabled: boolean;
  onPractice: (subtopics: string[]) => void;
}) {
  const weakest = topicStats
    .filter((t) => t.answered > 0 && t.total_questions > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered)
    .slice(0, 3);
  const hasWeak = weakest.length > 0 && weakest[0].accuracy < 70;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>🎯 Practice Your Weakest Topics</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasWeak ? (
          <p className="text-sm text-muted-foreground">
            {disabled
              ? "Loading…"
              : topicStats.some((t) => t.answered > 0)
              ? "No weak areas yet — everything you've attempted is at or above 70%. Keep going."
              : "Answer some questions first and your weakest sub-topics will show up here."}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Lowest accuracy among the topics you have attempted:
            </p>
            <ul className="mb-4 space-y-1">
              {weakest.map((t) => (
                <li
                  key={t.subtopic}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-foreground">{t.subtopic}</span>
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    {t.accuracy}% ({t.correct}/{t.answered})
                  </span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => onPractice(weakest.map((t) => t.subtopic))}
              className="bg-primary hover:bg-primary/90"
            >
              Practice These Topics
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatsContent() {
  const router = useRouter();
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [topicStats, setTopicStats] = useState<TopicStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState("All subjects");
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [usingLocalOnly, setUsingLocalOnly] = useState(false);

  // Subjects with at least one question, so the selector only offers real ones.
  // The selection is never forced here: "All subjects" is a real, stable choice
  // and switching the user away from it silently hid answered questions.
  useEffect(() => {
    supabase
      .from("questions")
      .select("subject")
      .then(({ data }) => {
        const subjects = Array.from(
          new Set((data || []).map((row: { subject: string }) => row.subject))
        ).sort();
        setAvailableSubjects(subjects);
      });
  }, []);

  useEffect(() => {
    loadStats();
  }, [selectedSubject]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // 1. Получаем все вопросы (все предметы, если выбрано "All subjects").
      //    PostgREST caps one response at 1000 rows regardless of .limit(), so
      //    the rows are paged until a short page arrives. Without this the
      //    statistics silently ignored every question past the first 1000.
      const PAGE = 1000;
      const questions: {
        id: number;
        subject: string;
        major_topic: string;
        subtopic: string;
      }[] = [];
      for (let from = 0; ; from += PAGE) {
        let query = supabase
          .from("questions")
          .select("id, subject, major_topic, subtopic")
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (selectedSubject !== "All subjects") {
          query = query.ilike("subject", selectedSubject);
        }
        const { data, error } = await query;
        if (error) throw error;
        const page = data ?? [];
        questions.push(...page);
        if (page.length < PAGE) break;
      }

      // 2. Получаем весь прогресс из базы. If the anon role is not allowed to
      //    insert into user_progress this comes back empty (it can still read),
      //    so the locally recorded answers are merged in below as a fallback.
      const { data: progress } = await supabase
        .from("user_progress")
        .select("*");

      // 3. Создаём мапу прогресса по question_id: local answers first, then
      //    anything the database knows about (database rows win on conflict).
      const progressMap = new Map<number, { is_correct: boolean }>();
      const localRecords = readProgress();
      for (const [key, rec] of Object.entries(localRecords)) {
        progressMap.set(Number(key), { is_correct: rec.isCorrect });
      }
      (progress || []).forEach((p: { question_id: number; is_correct: boolean }) => {
        progressMap.set(p.question_id, { is_correct: p.is_correct });
      });
      setUsingLocalOnly(Object.values(localRecords).some((r) => r.pending));

      // 4. Считаем статистику: по каждой теме и по каждому предмету.
      const topicMap = new Map<string, TopicStats>();
      const perSubject = new Map<string, SubjectStats>();

      (questions || []).forEach((q) => {
        const p = progressMap.get(q.id);
        const isAnswered = !!p;
        const isCorrect = p?.is_correct || false;

        // По предметам
        if (!perSubject.has(q.subject)) {
          perSubject.set(q.subject, {
            subject: q.subject,
            total_questions: 0,
            answered: 0,
            correct: 0,
            accuracy: 0,
          });
        }
        const s = perSubject.get(q.subject)!;
        s.total_questions++;
        if (isAnswered) {
          s.answered++;
          if (isCorrect) s.correct++;
        }

        // Группируем по подтемам. Ключ включает предмет, чтобы одинаковые
        // названия подтем в разных предметах не складывались в одну строку.
        const key = `${q.subject}|||${q.major_topic}|||${q.subtopic}`;
        if (!topicMap.has(key)) {
          topicMap.set(key, {
            major_topic: q.major_topic,
            subtopic: q.subtopic,
            total_questions: 0,
            answered: 0,
            correct: 0,
            accuracy: 0,
          });
        }
        const topic = topicMap.get(key)!;
        topic.total_questions++;
        if (isAnswered) {
          topic.answered++;
          if (isCorrect) topic.correct++;
          topic.accuracy = Math.round((topic.correct / topic.answered) * 100);
        }
      });

      const subjectList = Array.from(perSubject.values())
        .map((s) => ({
          ...s,
          accuracy: s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0,
        }))
        .sort((a, b) => b.total_questions - a.total_questions);

      setSubjectStats(subjectList);

      setTopicStats(
        Array.from(topicMap.values()).sort((a, b) => {
          if (a.major_topic !== b.major_topic) {
            return a.major_topic.localeCompare(b.major_topic);
          }
          return a.subtopic.localeCompare(b.subtopic);
        })
      );
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const groupedTopics = topicStats.reduce((acc, topic) => {
    if (!acc[topic.major_topic]) {
      acc[topic.major_topic] = [];
    }
    acc[topic.major_topic].push(topic);
    return acc;
  }, {} as Record<string, TopicStats[]>);

  // Headline numbers cover everything currently in scope ("All subjects" by
  // default), so a session in any subject is visible immediately.
  const overallStats = subjectStats.reduce(
    (acc, s) => ({
      total_questions: acc.total_questions + s.total_questions,
      answered: acc.answered + s.answered,
      correct: acc.correct + s.correct,
      accuracy: 0,
    }),
    { total_questions: 0, answered: 0, correct: 0, accuracy: 0 }
  );
  overallStats.accuracy =
    overallStats.answered > 0
      ? Math.round((overallStats.correct / overallStats.answered) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
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
                  📊 Your Statistics
                </h1>
                <p className="text-sm text-muted-foreground">
                  Track your progress and identify weak areas
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-8">
        {usingLocalOnly && (
          <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-200">
            Showing progress saved in this browser. Cloud sync is off because the
            database does not yet allow anonymous writes to{" "}
            <code className="font-mono text-xs">user_progress</code>.
          </div>
        )}
        {/* Subject selector */}
        {availableSubjects.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-sm text-muted-foreground mr-1">Subject:</span>
            <Button
              size="sm"
              variant={selectedSubject === "All subjects" ? "default" : "outline"}
              onClick={() => setSelectedSubject("All subjects")}
            >
              All subjects
            </Button>
            {availableSubjects.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === selectedSubject ? "default" : "outline"}
                onClick={() => setSelectedSubject(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        )}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading statistics...</p>
          </div>
        ) : (
          <>
            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-primary">
                    {overallStats.total_questions}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Total Questions
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {overallStats.answered}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Answered</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {overallStats.correct}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Correct</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div
                    className={`text-3xl font-bold ${
                      overallStats.accuracy >= 70
                        ? "text-green-600 dark:text-green-400"
                        : overallStats.accuracy >= 50
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {overallStats.accuracy}%
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Accuracy</div>
                </CardContent>
              </Card>
            </div>

            {/* Progress Bar */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Overall Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {overallStats.answered} of {overallStats.total_questions}{" "}
                    questions answered
                  </span>
                  <span className="text-sm font-semibold">
                    {overallStats.total_questions > 0
                      ? // One decimal place: the bank has 800+ questions, so a
                        // handful of answers would otherwise round down to 0%.
                        (
                          (overallStats.answered /
                            overallStats.total_questions) *
                          100
                        ).toFixed(1)
                      : "0"}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    overallStats.total_questions > 0
                      ? (overallStats.answered /
                          overallStats.total_questions) *
                        100
                      : 0
                  }
                  className="h-3"
                />
              </CardContent>
            </Card>

            {/* Per-subject breakdown, only meaningful across all subjects */}
            {subjectStats.length > 1 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Progress by Subject</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {subjectStats.map((s) => (
                    <button
                      key={s.subject}
                      onClick={() => setSelectedSubject(s.subject)}
                      className="w-full text-left group"
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-foreground group-hover:text-primary">
                          {s.subject}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {s.answered}/{s.total_questions} answered
                          {s.answered > 0 && (
                            <span className="ml-2 font-semibold text-foreground">
                              {s.accuracy}%
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress
                        value={
                          s.total_questions > 0
                            ? (s.answered / s.total_questions) * 100
                            : 0
                        }
                        className="h-2"
                      />
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Weak-area practice */}
            <WeakAreaCard
              topicStats={topicStats}
              disabled={loading}
              onPractice={(subtopics) =>
                router.push(
                  `/quiz?subject=${encodeURIComponent(selectedSubject)}&mode=weak&subtopics=${subtopics
                    .map(encodeURIComponent)
                    .join(",")}`
                )
              }
            />

            {/* Topic Breakdown */}
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Performance by Topic
            </h2>

            {Object.keys(groupedTopics).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="text-5xl mb-4">📝</div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No data yet
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Start answering questions to see your statistics here.
                  </p>
                  <Button
                    onClick={() => router.push("/dashboard")}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Start Practicing
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedTopics).map(
                  ([majorTopic, topics]) => {
                    const groupAnswered = topics.reduce(
                      (sum, t) => sum + t.answered,
                      0
                    );
                    const groupCorrect = topics.reduce(
                      (sum, t) => sum + t.correct,
                      0
                    );
                    const groupAccuracy =
                      groupAnswered > 0
                        ? Math.round((groupCorrect / groupAnswered) * 100)
                        : 0;

                    return (
                      <div key={majorTopic}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full"></span>
                            {majorTopic}
                          </h3>
                          <div className="text-sm text-muted-foreground">
                            {groupAnswered > 0 ? (
                              <span
                                className={`font-semibold ${
                                  groupAccuracy >= 70
                                    ? "text-green-600 dark:text-green-400"
                                    : groupAccuracy >= 50
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {groupAccuracy}% accuracy
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                Not started
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {topics.map((topic) => {
                            return (
                              <Card
                                key={topic.subtopic}
                                className="cursor-pointer hover:shadow-md transition-all"
                                onClick={() => {
                                  if (topic.total_questions > 0) {
                                    router.push(
                                      `/quiz?subject=${selectedSubject}&mode=topic&subtopic=${encodeURIComponent(
                                        topic.subtopic
                                      )}`
                                    );
                                  }
                                }}
                              >
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-medium text-foreground text-sm flex-1">
                                      {topic.subtopic}
                                    </h4>
                                    <span
                                      className={`text-xs font-semibold px-2 py-1 rounded ${
                                        topic.accuracy >= 70
                                          ? "bg-green-100 text-green-700 dark:text-green-300 dark:bg-green-950 dark:text-green-300"
                                          : topic.accuracy >= 50
                                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                                          : topic.answered > 0
                                          ? "bg-red-100 text-red-700 dark:text-red-300 dark:bg-red-950 dark:text-red-300"
                                          : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {topic.answered > 0
                                        ? `${topic.accuracy}%`
                                        : "—"}
                                    </span>
                                  </div>

                                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>
                                      {topic.answered}/{topic.total_questions}{" "}
                                      answered
                                    </span>
                                    <span>
                                      {topic.correct} correct
                                    </span>
                                  </div>

                                  <Progress
                                    value={
                                      topic.total_questions > 0
                                        ? (topic.answered /
                                            topic.total_questions) *
                                          100
                                        : 0
                                    }
                                    className="h-1.5"
                                  />
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function StatsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <StatsContent />
    </Suspense>
  );
}