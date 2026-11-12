"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/theme-toggle";

interface Topic {
  id: number;
  major_topic: string;
  subtopic: string;
  questions_planned: number;
  questions_generated: number;
  status: string;
}

// Subjects are progressively filled: a card becomes playable as soon as the
// questions table actually holds questions for it, so the UI never advertises
// an empty subject and never hides a ready one.
const subjects = [
  {
    id: "Biochemistry",
    name: "Biochemistry",
    icon: "🧪",
    blurb: "Metabolism, enzymes, molecular biology",
  },
  {
    id: "Immunology",
    name: "Immunology",
    icon: "🛡️",
    blurb: "Immunodeficiencies, hypersensitivity, complement",
  },
  {
    id: "Microbiology",
    name: "Microbiology",
    icon: "🦠",
    blurb: "Bacteriology, virology, mycology",
  },
  {
    id: "Pathology",
    name: "Pathology",
    icon: "🔬",
    blurb: "Cell injury, neoplasia, systemic pathology",
  },
  {
    id: "Pharmacology",
    name: "Pharmacology",
    icon: "💊",
    blurb: "Drug mechanisms, toxicities, antidotes",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>(
    {}
  );
  const [countsLoaded, setCountsLoaded] = useState(false);

  // Сколько вопросов реально есть в базе по каждому предмету
  useEffect(() => {
    supabase
      .from("questions")
      .select("subject")
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data || []).forEach((row: { subject: string }) => {
          counts[row.subject] = (counts[row.subject] ?? 0) + 1;
        });
        setQuestionCounts(counts);
        setCountsLoaded(true);
      });
  }, []);

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
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">U</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">USMLE Prep</h1>
                <p className="text-sm text-muted-foreground">
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
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-8">
        {/* Subject Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Select Subject
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subject) => {
              const count = questionCounts[subject.id] ?? 0;
              const isReady = count > 0;
              const isSelected = selectedSubject === subject.id;
              return (
                <Card
                  key={subject.id}
                  className={`transition-all ${
                    isSelected
                      ? "ring-2 ring-primary shadow-lg"
                      : isReady
                      ? "cursor-pointer hover:shadow-md hover:border-primary/60"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                  onClick={() => {
                    if (!isReady) return;
                    setSelectedSubject(subject.id);
                    setSelectedMode(null);
                  }}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{subject.icon}</span>
                      <div className="min-w-0">
                        <CardTitle className="text-lg">
                          {subject.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {!countsLoaded
                            ? "Loading…"
                            : isReady
                            ? `${count} questions`
                            : "Coming soon"}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {subject.blurb}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Mode Selection */}
        {selectedSubject && !selectedMode && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Select Mode
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-all">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📚</div>
                    <h3 className="font-semibold text-lg mb-2">By Topic</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Focus on specific topics
                    </p>
                    <Button
                      onClick={() => setSelectedMode("topic")}
                      className="w-full bg-primary hover:bg-primary/90"
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
                    <p className="text-sm text-muted-foreground mb-4">
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
                    <p className="text-sm text-muted-foreground mb-4">
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
              <h2 className="text-xl font-semibold text-foreground">
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
                <p className="text-muted-foreground">Loading topics...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedTopics).map(
                  ([majorTopic, subtopics]) => (
                    <div key={majorTopic}>
                      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                        {majorTopic}
                        <span className="text-sm font-normal text-muted-foreground">
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
                                  ? "hover:shadow-md hover:border-primary/60"
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
                                  <h4 className="font-medium text-foreground text-sm">
                                    {topic.subtopic}
                                  </h4>
                                  <span
                                    className={`text-xs px-2 py-1 rounded ${
                                      isReady
                                        ? "bg-green-100 text-green-700 dark:text-green-300 dark:bg-green-950 dark:text-green-300"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {topic.questions_generated}/
                                    {topic.questions_planned}
                                  </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-1.5">
                                  <div
                                    className="bg-primary h-1.5 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                                {!isReady && (
                                  <p className="text-xs text-muted-foreground mt-2">
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