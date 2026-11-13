"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import {
  isFlagged,
  removeFlag,
  toggleFlag,
  updateFlagNote,
} from "@/lib/progress";

interface Question {
  id: number;
  subject: string;
  topic: string;
  majorTopic?: string;
  subtopic?: string;
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
  // "Difficult" flag: kept locally so a question can be revisited and discussed
  // even while the progress table rejects anonymous writes.
  const [flagged, setFlagged] = useState(() => isFlagged(question.id));
  const [flagNote, setFlagNote] = useState("");
  const [showFlagNote, setShowFlagNote] = useState(false);

  const handleCheckAnswer = () => {
    if (!selectedAnswer) return;

    const isCorrect = selectedAnswer === question.correctAnswer;
    setShowExplanation(true);
    onAnswer(isCorrect, selectedAnswer);

    // Проверяем, есть ли закладка
    checkBookmark();
  };

  const handleToggleFlag = () => {
    const next = toggleFlag({
      questionId: question.id,
      subject: question.subject,
      majorTopic: question.majorTopic ?? "",
      subtopic: question.subtopic ?? "",
      questionText: question.question,
      selectedAnswer: selectedAnswer || null,
      note: flagNote,
      flaggedAt: new Date().toISOString(),
    });
    setFlagged(next);
    if (next) setShowFlagNote(true);
  };

  const handleSaveFlagNote = () => {
    updateFlagNote(question.id, flagNote);
    setShowFlagNote(false);
  };

  const handleDeleteFlag = () => {
    removeFlag(question.id);
    setFlagged(false);
    setFlagNote("");
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
          <div className="flex flex-col items-end gap-2">
            <Button
              variant={isBookmarked ? "default" : "outline"}
              size="sm"
              onClick={handleBookmark}
              className={isBookmarked ? "bg-yellow-500 text-yellow-950 hover:bg-yellow-400" : ""}
            >
              {isBookmarked ? "★ Bookmarked" : "☆ Bookmark"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleFlag}
              aria-pressed={flagged}
              title="Save this question for later review and discussion"
              className={
                flagged
                  ? "border-orange-400 bg-orange-100 text-orange-900 hover:bg-orange-200 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200"
                  : ""
              }
            >
              {flagged ? "🚩 Marked hard" : "⚑ Mark as hard"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Vignette */}
        <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-lg mb-6">
          <p className="text-foreground/90">{question.vignette}</p>
        </div>

        {/* Options.
            The whole row is the click target. Previously only the tiny radio
            input and the text label were interactive, so clicking the padding,
            the letter, or the empty space to the right of a short answer did
            nothing - the row looked clickable but was not. Making the row itself
            a <label> bound to the radio means every pixel of the card selects
            the answer, including the left and right edges. */}
        <RadioGroup
          value={selectedAnswer}
          onValueChange={setSelectedAnswer}
          disabled={showExplanation}
          className="gap-3"
        >
          {question.options.map((option) => {
            const isCorrectOption = option.id === question.correctAnswer;
            const isChosen = option.id === selectedAnswer;
            const stateClasses = showExplanation
              ? isCorrectOption
                ? "border-green-500 bg-green-50 dark:bg-green-950/40"
                : isChosen
                ? "border-red-500 bg-red-50 dark:bg-red-950/40"
                : "border-border"
              : isChosen
              ? "border-primary bg-blue-50 dark:bg-blue-950/40"
              : "border-border hover:border-primary/60 hover:bg-accent/60";

            return (
              <label
                key={option.id}
                htmlFor={`option-${option.id}`}
                className={`flex w-full cursor-pointer select-none items-center gap-3 rounded-lg border-2 p-3 transition-colors ${stateClasses} ${
                  showExplanation ? "cursor-default" : ""
                }`}
              >
                <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                <span className="flex-1 text-sm leading-relaxed">
                  <span className="mr-2 font-semibold">{option.id}.</span>
                  {option.text}
                </span>
                {showExplanation && isCorrectOption && (
                  <span className="shrink-0 text-sm font-semibold text-green-700 dark:text-green-300">
                    Correct
                  </span>
                )}
                {showExplanation && isChosen && !isCorrectOption && (
                  <span className="shrink-0 text-sm font-semibold text-red-700 dark:text-red-300">
                    Your answer
                  </span>
                )}
              </label>
            );
          })}
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

        {/* Difficult-question note. Available whether or not the answer was checked,
            so a question can be flagged before committing to an answer. */}
        {flagged && (
          <div className="mt-6 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/40">
            <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-2">
              🚩 Marked for review
            </h3>
            <p className="mb-2 text-sm text-orange-800 dark:text-orange-300">
              Saved to your &ldquo;Difficult questions&rdquo; list so you can come
              back to it and discuss it later.
            </p>
            {showFlagNote ? (
              <>
                <Textarea
                  value={flagNote}
                  onChange={(e) => setFlagNote(e.target.value)}
                  placeholder="What was confusing? Which concept needs review?"
                  className="bg-card"
                />
                <div className="mt-2 flex gap-2">
                  <Button onClick={handleSaveFlagNote} size="sm" variant="outline">
                    Save note
                  </Button>
                  <Button
                    onClick={() => setShowFlagNote(false)}
                    size="sm"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowFlagNote(true)}
                  size="sm"
                  variant="outline"
                >
                  {flagNote ? "Edit note" : "Add note"}
                </Button>
                <Button onClick={handleDeleteFlag} size="sm" variant="ghost">
                  Remove mark
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}