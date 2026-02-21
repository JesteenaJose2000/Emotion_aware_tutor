"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, RotateCcw, TrendingUp, TrendingDown, Target, Brain } from "lucide-react";
import { useSessionStore } from "@/store/session";
import { toCSV, downloadCSV } from "@/lib/csv";
import { getDifficultyLabel } from "@/lib/utils";

interface SummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SummaryDialog({ open, onOpenChange }: SummaryDialogProps) {
  const { summary, resetSession, sessionId } = useSessionStore();

  if (!summary) return null;

  // Debug: Log summary values
  console.log('Summary values:', summary);

  // Ensure we have fallback values
  const safeSummary = {
    turns: summary.turns || 0,
    accuracyMean: summary.accuracyMean || 0,
    engagementMean: summary.engagementMean || 0,
    cumulativeReward: summary.cumulativeReward || 0,
    perConceptMastery: summary.perConceptMastery || {},
  };

  const handleDownloadCSV = () => {
    if (!sessionId) return;
    
    // Build CSV rows from session history
    const history = useSessionStore.getState().history;
    const rows = history.map((entry) => {
      const isCorrect = entry.userAnswer === entry.correctAnswer.toString();
      const timestamp = new Date(entry.timestamp).toISOString();
      
      return {
        timestamp: timestamp,
        question_id: entry.questionId,
        topic: entry.concept,
        difficulty_level: getDifficultyLabel(entry.difficulty),
        answer_correct: isCorrect ? "Yes" : "No",
        time_spent_sec: (entry.responseTime / 1000).toFixed(2),
        current_mastery_pct: Math.round(entry.mastery * 100),
      };
    });

    const csv = toCSV(rows);
    downloadCSV(`session_${sessionId.slice(0, 8)}.csv`, csv);
  };

  const handleNewSession = () => {
    resetSession();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Session Summary
          </DialogTitle>
          <DialogDescription>
            Your learning session results and performance metrics
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Big Numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{safeSummary.turns}</div>
                <div className="text-sm text-muted-foreground">Turns</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">
                  {(safeSummary.accuracyMean * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Accuracy</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">
                  {safeSummary.engagementMean.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Engagement</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${
                  safeSummary.cumulativeReward >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {safeSummary.cumulativeReward >= 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  {safeSummary.cumulativeReward >= 0 ? '+' : ''}{safeSummary.cumulativeReward.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Total Reward</div>
              </CardContent>
            </Card>
          </div>

          {/* Per-Concept Mastery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Concept Mastery
              </CardTitle>
              <CardDescription>
                Your progress across different learning concepts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(safeSummary.perConceptMastery).map(([concept, mastery]) => (
                <div key={concept} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium capitalize text-foreground">{concept.replace('_', ' ')}</span>
                    <Badge variant="outline" className="text-foreground">{Math.round(mastery * 100)}%</Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${mastery * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleDownloadCSV}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
            <Button
              onClick={handleNewSession}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              New Session
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
