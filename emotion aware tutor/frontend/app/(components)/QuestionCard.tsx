"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FeedbackBubble } from "./FeedbackBubble";
import { useSessionStore } from "@/store/session";
import { getDifficultyColor, getDifficultyLabel } from "@/lib/utils";
import { Question } from "@/types/api";
import { Clock, Send } from "lucide-react";

interface QuestionCardProps {
  question: Question | null;
  onSubmit: (answer: string, responseTime: number) => void;
  feedback?: {
    type: "encourage" | "hint" | "neutral";
    message: string;
  };
  isSubmitting?: boolean;
  isLoading?: boolean;
}

export function QuestionCard({ 
  question, 
  onSubmit, 
  feedback, 
  isSubmitting = false,
  isLoading = false
}: QuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [responseTime, setResponseTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (question) {
      setAnswer("");
      setResponseTime(0);
      setStartTime(Date.now());
    }
  }, [question]);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      setResponseTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting && answer.trim() !== '') {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!answer.trim() || isSubmitting) return;
    
    const finalResponseTime = responseTime;
    onSubmit(answer, finalResponseTime);
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-t-4 border-t-primary">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="text-muted-foreground">Loading question...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!question) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center space-y-2">
            <div className="text-4xl">📚</div>
            <p className="text-muted-foreground">No question available</p>
            <p className="text-sm text-muted-foreground">Start a session to begin learning</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-t-4 border-t-primary">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{question.concept}</CardTitle>
            <Badge 
              className={getDifficultyColor(question.difficulty)}
              variant="outline"
            >
              {getDifficultyLabel(question.difficulty)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-lg leading-relaxed text-foreground">
              {question.question}
            </p>
            
            <div className="space-y-3">
              <label htmlFor="answer" className="text-sm font-medium">
                Your Answer
              </label>
              <div className="flex gap-3">
                <Input
                  id="answer"
                  type="number"
                  placeholder="Enter your answer..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting}
                  className="flex-1"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!answer.trim() || isSubmitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Response Time Display */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Response time: {Math.round(responseTime / 1000)}s</span>
      </div>

      {/* Feedback */}
      {feedback && (
        <FeedbackBubble
          type={feedback.type}
          message={feedback.message}
        />
      )}
    </div>
  );
}
