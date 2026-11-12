"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface Topic {
  id: number;
  major_topic: string;
  subtopic: string;
  questions_planned: number;
  questions_generated: number;
  status: string;
}

const subjects = [
  {
    id: "Biochemistry",
    name: "Biochemistry",
    icon: "🧪",
    description: "480 questions",
  },
  {
    id: "Immunology",
    name: "Immunology",
    icon: "🛡️",
    description: "Coming soon",
  },
  {
    id: "Microbiology",
    name: "Microbiology",
    icon: "🦠",
    description: "Coming soon",
  },
  {
    id: "Pathology",
    name: "Pathology",
    icon: "🔬",
    description: "Coming soon",
  },
  {
    id: "Pharmacology",
    name: "Pharmacology",
    icon: "💊",
    description: "Coming soon",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // Загружаем подтемы при выборе режима "topic"
  useEffect(() => {
    if (selectedMode === "topic" && selectedSubject) {
      loadTopics();
    }
  }, [selectedMode, selectedSubject]);

  const loadTopics = async () => {
    setLoadingTopics(true);
    try {
      const { data, error } = await supabase
        .from("topic_coverage")
        .select("*")
        .eq("subject", selectedSubject)
        .order("major_topic", { ascending: true })
        .order("subtopic", { ascending: true });

      if (error) throw error;
      setTopics(data || []);
    } catch (error) {
      console.error("Error loading topics:", error);
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleStartQuiz = (mode: string, subtopic?: string) => {
    if (!selectedSubject) return;

    let url = `/quiz?subject=${selectedSubject}&mode=${mode}`;
    if (subtopic) {
      url += `&subtopic=${encodeURIComponent(subtopic)}`;
    }
    router.push(url);
  };

  // Группируем подтемы по major_topic
  const groupedTopics = topics.reduce((acc, topic) => {
    if (!acc[topic.major_topic]) {
      acc[topic.major_topic] = [];
    }
    acc[topic.major_topic].push(topic);
    return acc;
  }, {} as Record<string, Topic[]>);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">U</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">USMLE Prep</h1>
                <p className="text-sm text-gray-500">
                  Step 1 • Choose your subject
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push("/stats")}
                variant="outline"
                className="flex items-center gap-2"
              >
                📊 Statistics
              </Button>
              <Button
                onClick={() => router.push("/bookmarks")}
                variant="outline"
                className="flex items-center gap-2"
              >
                ⭐ Bookmarks
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-8">
        {/* Subject Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Select Subject
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subject) => (
              <Card
                key={subject.id}
                className={`cursor-pointer transition-all ${
                  selectedSubject === subject.id
                    ? "ring-2 ring-blue-600 shadow-lg"
                    : "hover:shadow-md"
                } ${subject.id === "Biochemistry" ? "" : "opacity-50 cursor-not-allowed"}`}
                onClick={() => {
                  if (subject.id === "Biochemistry") {
                    setSelectedSubject(subject.id);
                    setSelectedMode(null);
                  }
                }}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{subject.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{subject.name}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {subject.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Mode Selection */}
        {selectedSubject && !selectedMode && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Select Mode
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-all">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📚</div>
                    <h3 className="font-semibold text-lg mb-2">By Topic</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Focus on specific topics
                    </p>
                    <Button
                      onClick={() => setSelectedMode("topic")}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Choose
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-all">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">🎲</div>
                    <h3 className="font-semibold text-lg mb-2">Mixed</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      All questions in random order
                    </p>
                    <Button
                      onClick={() => handleStartQuiz("mixed")}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      Start
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-all">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">🏆</div>
                    <h3 className="font-semibold text-lg mb-2">Exam Mode</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Timed test with results at the end
                    </p>
                    <Button
                      onClick={() => handleStartQuiz("exam")}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      Start Exam
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Topic Selection */}
        {selectedMode === "topic" && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Select Topic
              </h2>
              <Button
                variant="outline"
                onClick={() => setSelectedMode(null)}
              >
                ← Back to Modes
              </Button>
            </div>

            {loadingTopics ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading topics...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedTopics).map(
                  ([majorTopic, subtopics]) => (
                    <div key={majorTopic}>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        {majorTopic}
                        <span className="text-sm font-normal text-gray-500">
                          ({subtopics.length} subtopics)
                        </span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {subtopics.map((topic) => {
                          const progress =
                            topic.questions_planned > 0
                              ? Math.round(
                                  (topic.questions_generated /
                                    topic.questions_planned) *
                                    100
                                )
                              : 0;
                          const isReady = topic.questions_generated > 0;

                          return (
                            <Card
                              key={topic.id}
                              className={`cursor-pointer transition-all ${
                                isReady
                                  ? "hover:shadow-md hover:border-blue-300"
                                  : "opacity-50 cursor-not-allowed"
                              }`}
                              onClick={() => {
                                if (isReady) {
                                  handleStartQuiz("topic", topic.subtopic);
                                }
                              }}
                            >
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-medium text-gray-900 text-sm">
                                    {topic.subtopic}
                                  </h4>
                                  <span
                                    className={`text-xs px-2 py-1 rounded ${
                                      isReady
                                        ? "bg-green-100 text-green-700"
                                        : "bg-gray-100 text-gray-500"
                                    }`}
                                  >
                                    {topic.questions_generated}/
                                    {topic.questions_planned}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                                {!isReady && (
                                  <p className="text-xs text-gray-500 mt-2">
                                    Questions coming soon
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}