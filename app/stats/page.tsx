"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";

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

function StatsContent() {
  const router = useRouter();
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [topicStats, setTopicStats] = useState<TopicStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState("Biochemistry");

  useEffect(() => {
    loadStats();
  }, [selectedSubject]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // 1. Получаем все вопросы по предмету
      const { data: questions, error: qError } = await supabase
        .from("questions")
        .select("id, subject, major_topic, subtopic")
        .ilike("subject", selectedSubject);

      if (qError) throw qError;

      // 2. Получаем весь прогресс
      const { data: progress, error: pError } = await supabase
        .from("user_progress")
        .select("*");

      if (pError) throw pError;

      // 3. Создаём мапу прогресса по question_id
      const progressMap = new Map();
      (progress || []).forEach((p) => {
        progressMap.set(p.question_id, p);
      });

      // 4. Считаем статистику по предмету
      let totalAnswered = 0;
      let totalCorrect = 0;

      const topicMap = new Map<string, TopicStats>();

      (questions || []).forEach((q) => {
        const p = progressMap.get(q.id);
        const isAnswered = !!p;
        const isCorrect = p?.is_correct || false;

        if (isAnswered) {
          totalAnswered++;
          if (isCorrect) totalCorrect++;
        }

        // Группируем по подтемам
        const key = `${q.major_topic}|||${q.subtopic}`;
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

      const subjectAccuracy =
        totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

      setSubjectStats([
        {
          subject: selectedSubject,
          total_questions: questions?.length || 0,
          answered: totalAnswered,
          correct: totalCorrect,
          accuracy: subjectAccuracy,
        },
      ]);

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

  const overallStats = subjectStats[0] || {
    total_questions: 0,
    answered: 0,
    correct: 0,
    accuracy: 0,
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
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
                <h1 className="text-2xl font-bold text-gray-900">
                  📊 Your Statistics
                </h1>
                <p className="text-sm text-gray-500">
                  Track your progress and identify weak areas
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading statistics...</p>
          </div>
        ) : (
          <>
            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {overallStats.total_questions}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Total Questions
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {overallStats.answered}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Answered</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {overallStats.correct}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Correct</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div
                    className={`text-3xl font-bold ${
                      overallStats.accuracy >= 70
                        ? "text-green-600"
                        : overallStats.accuracy >= 50
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {overallStats.accuracy}%
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Accuracy</div>
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
                  <span className="text-sm text-gray-600">
                    {overallStats.answered} of {overallStats.total_questions}{" "}
                    questions answered
                  </span>
                  <span className="text-sm font-semibold">
                    {overallStats.total_questions > 0
                      ? Math.round(
                          (overallStats.answered /
                            overallStats.total_questions) *
                            100
                        )
                      : 0}
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

            {/* Topic Breakdown */}
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Performance by Topic
            </h2>

            {Object.keys(groupedTopics).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="text-5xl mb-4">📝</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No data yet
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Start answering questions to see your statistics here.
                  </p>
                  <Button
                    onClick={() => router.push("/dashboard")}
                    className="bg-blue-600 hover:bg-blue-700"
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
                          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                            {majorTopic}
                          </h3>
                          <div className="text-sm text-gray-600">
                            {groupAnswered > 0 ? (
                              <span
                                className={`font-semibold ${
                                  groupAccuracy >= 70
                                    ? "text-green-600"
                                    : groupAccuracy >= 50
                                    ? "text-yellow-600"
                                    : "text-red-600"
                                }`}
                              >
                                {groupAccuracy}% accuracy
                              </span>
                            ) : (
                              <span className="text-gray-400">
                                Not started
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {topics.map((topic) => {
                            const accuracyColor =
                              topic.accuracy >= 70
                                ? "text-green-600"
                                : topic.accuracy >= 50
                                ? "text-yellow-600"
                                : topic.answered > 0
                                ? "text-red-600"
                                : "text-gray-400";

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
                                    <h4 className="font-medium text-gray-900 text-sm flex-1">
                                      {topic.subtopic}
                                    </h4>
                                    <span
                                      className={`text-xs font-semibold px-2 py-1 rounded ${
                                        topic.accuracy >= 70
                                          ? "bg-green-100 text-green-700"
                                          : topic.accuracy >= 50
                                          ? "bg-yellow-100 text-yellow-700"
                                          : topic.answered > 0
                                          ? "bg-red-100 text-red-700"
                                          : "bg-gray-100 text-gray-500"
                                      }`}
                                    >
                                      {topic.answered > 0
                                        ? `${topic.accuracy}%`
                                        : "—"}
                                    </span>
                                  </div>

                                  <div className="flex justify-between text-xs text-gray-500 mb-1">
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
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <StatsContent />
    </Suspense>
  );
}