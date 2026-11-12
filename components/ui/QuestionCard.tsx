"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

interface Question {
  id: number;
  subject: string;
  topic: string;
  vignette: string;
  question: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation: {
    correct: string;
    incorrect: Record<string, string>;
  };
}

interface QuestionCardProps {
  question: Question;
  onAnswer: (isCorrect: boolean, selectedAnswer: string) => void;
}

export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState("");

  const handleCheckAnswer = () => {
    if (!selectedAnswer) return;

    const isCorrect = selectedAnswer === question.correctAnswer;
    setShowExplanation(true);
    onAnswer(isCorrect, selectedAnswer);

    // Проверяем, есть ли закладка
    checkBookmark();
  };

  const checkBookmark = async () => {
    const { data } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("question_id", question.id)
      .maybeSingle();

    if (data) {
      setIsBookmarked(true);
      setBookmarkNote(data.note || "");
    }
  };

  const handleBookmark = async () => {
    if (isBookmarked) {
      // Удаляем закладку
      await supabase
        .from("bookmarks")
        .delete()
        .eq("question_id", question.id);
      setIsBookmarked(false);
      setBookmarkNote("");
    } else {
      // Создаём закладку
      await supabase.from("bookmarks").insert({
        question_id: question.id,
        note: bookmarkNote,
      });
      setIsBookmarked(true);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="text-sm text-primary font-medium mb-2">
              {question.topic}
            </div>
            <CardTitle className="text-lg mb-4">{question.question}</CardTitle>
          </div>
          <Button
            variant={isBookmarked ? "default" : "outline"}
            size="sm"
            onClick={handleBookmark}
            className={isBookmarked ? "bg-yellow-500 text-yellow-950 hover:bg-yellow-400" : ""}
          >
            {isBookmarked ? "★ Bookmarked" : "☆ Bookmark"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Vignette */}
        <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-lg mb-6">
          <p className="text-foreground/90">{question.vignette}</p>
        </div>

        {/* Options */}
        <RadioGroup
          value={selectedAnswer}
          onValueChange={setSelectedAnswer}
          disabled={showExplanation}
        >
          {question.options.map((option) => (
            <div
              key={option.id}
              className={`flex items-center space-x-2 p-3 rounded-lg border-2 transition-all ${
                showExplanation
                  ? option.id === question.correctAnswer
                    ? "border-green-500 bg-green-50 dark:bg-green-950/40"
                    : option.id === selectedAnswer
                    ? "border-red-500 bg-red-50 dark:bg-red-950/40"
                    : "border-border"
                  : selectedAnswer === option.id
                  ? "border-primary bg-blue-50 dark:bg-blue-950/40"
                  : "border-border hover:border-primary/60"
              }`}
            >
              <RadioGroupItem value={option.id} id={`option-${option.id}`} />
              <Label
                htmlFor={`option-${option.id}`}
                className="flex-1 cursor-pointer"
              >
                <span className="font-semibold mr-2">{option.id}.</span>
                {option.text}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {/* Check Answer Button */}
        {!showExplanation && (
          <Button
            onClick={handleCheckAnswer}
            disabled={!selectedAnswer}
            className="w-full mt-6 bg-primary hover:bg-primary/90 text-white"
          >
            Check Answer
          </Button>
        )}

        {/* Explanation */}
        {showExplanation && (
          <div className="mt-6 space-y-4">
            <Separator />
            <div className="bg-green-50 dark:bg-green-950/40 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 dark:text-green-200 mb-2">
                ✓ Correct Answer: {question.correctAnswer}
              </h3>
              <p className="text-green-800 dark:text-green-300">{question.explanation.correct}</p>
            </div>

            <div className="bg-red-50 dark:bg-red-950/40 p-4 rounded-lg">
              <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2">
                ✗ Why other options are wrong:
              </h3>
              <div className="space-y-2">
                {Object.entries(question.explanation.incorrect).map(
                  ([key, explanation]) => (
                    <div key={key} className="text-sm">
                      <span className="font-semibold text-red-700 dark:text-red-300">
                        {key}:
                      </span>{" "}
                      <span className="text-red-800 dark:text-red-300">{explanation}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Bookmark Note */}
            {isBookmarked && (
              <div className="bg-yellow-50 dark:bg-yellow-950/40 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                  📝 Your Note:
                </h3>
                <Textarea
                  value={bookmarkNote}
                  onChange={(e) => setBookmarkNote(e.target.value)}
                  placeholder="Add a note about this question..."
                  className="bg-card"
                />
                <Button
                  onClick={handleBookmark}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Save Note
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}