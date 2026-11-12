"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface Bookmark {
  id: number;
  question_id: number;
  note: string;
  created_at: string;
  questions: {
    id: number;
    subject: string;
    major_topic: string;
    subtopic: string;
    vignette: string;
    question: string;
    options: { id: string; text: string }[];
    correct_answer: string;
  };
}

function BookmarksContent() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const { data, error } = await supabase
        .from("bookmarks")
        .select(`
          *,
          questions (
            id,
            subject,
            major_topic,
            subtopic,
            vignette,
            question,
            options,
            correct_answer
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookmarks(data || []);
    } catch (error) {
      console.error("Error loading bookmarks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBookmark = async (questionId: number) => {
    await supabase.from("bookmarks").delete().eq("question_id", questionId);
    setBookmarks(bookmarks.filter((b) => b.question_id !== questionId));
  };

  const handlePractice = (question: Bookmark["questions"]) => {
    router.push(
      `/quiz?subject=${question.subject}&mode=topic&subtopic=${encodeURIComponent(
        question.subtopic
      )}`
    );
  };

  return (
    <main className="min-h-screen bg-gray-50">
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
                  ⭐ Your Bookmarks
                </h1>
                <p className="text-sm text-gray-500">
                  {bookmarks.length} saved questions
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading bookmarks...</p>
          </div>
        ) : bookmarks.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-5xl mb-4">📚</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No bookmarks yet
              </h3>
              <p className="text-gray-500 mb-4">
                Bookmark difficult questions while practicing to review them
                later.
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
          <div className="space-y-4">
            {bookmarks.map((bookmark) => (
              <Card
                key={bookmark.id}
                className="hover:shadow-md transition-all"
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="text-sm text-blue-600 font-medium mb-1">
                        {bookmark.questions.subject} •{" "}
                        {bookmark.questions.major_topic}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        {bookmark.questions.question}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {bookmark.questions.vignette}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        onClick={() => handlePractice(bookmark.questions)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Practice
                      </Button>
                      <Button
                        onClick={() =>
                          handleRemoveBookmark(bookmark.question_id)
                        }
                        variant="outline"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>

                  {bookmark.note && (
                    <div className="bg-yellow-50 p-3 rounded-lg mt-3">
                      <p className="text-sm text-yellow-900">
                        📝 <strong>Note:</strong> {bookmark.note}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function BookmarksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <BookmarksContent />
    </Suspense>
  );
}