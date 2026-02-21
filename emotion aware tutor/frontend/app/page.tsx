"use client";

import { useState, useEffect } from "react";
import { HeaderBar } from "@/app/(components)/HeaderBar";
import { SessionSidebar } from "@/app/(components)/SessionSidebar";
import { QuestionCard } from "@/app/(components)/QuestionCard";
import { InsightsPanel } from "@/app/(components)/InsightsPanel";
import { FooterBar } from "@/app/(components)/FooterBar";
import { StartSessionDialog } from "@/app/(components)/StartSessionDialog";
import { SummaryDialog } from "@/app/(components)/SummaryDialog";
import { Mastery100Dialog } from "@/app/(components)/Mastery100Dialog";
import { useSessionStore } from "@/store/session";
import { useToast } from "@/lib/hooks/use-toast";
import { PrivacyBanner } from "@/app/(components)/PrivacyBanner";
import { DebugPanel } from "@/app/(components)/DebugPanel";
import { useWebcamFer } from "@/src/hooks/useWebcamFer";
import { useVoiceEmotion } from "@/src/hooks/useVoiceEmotion";
 

export default function HomePage() {
  const { 
    sessionId, 
    isActive, 
    currentQuestion, 
    isLoadingQuestion,
    isSubmitting,
    startSession, 
    endSession,
    submitAnswer,
    mode,
    setMode,
    summary
  } = useSessionStore();
  
  const { toast } = useToast();
  const { fer, enable, disable, ready, error, videoRef, previewVideoRef, canvasRef, enabled, mediaStreamRef } = useWebcamFer();
  const micEnabled = useSessionStore(s => s.micEnabled);
  const minVadToUse = useSessionStore(s => s.minVadToUse);
  const fusedFer = useSessionStore(s => s.fusedFer);
  const updateFER = useSessionStore(s => s.updateFER);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [showMastery100Dialog, setShowMastery100Dialog] = useState(false);
  const [hasShownMastery100, setHasShownMastery100] = useState(false);
  const mastery = useSessionStore(s => s.mastery);
  const [feedback, setFeedback] = useState<{
    type: "encourage" | "hint" | "neutral";
    message: string;
  } | null>(null);

  // Update FER in store (smoothed comes from hook already)
  useEffect(() => {
    updateFER({
      positive: fer.pos,
      neutral: fer.neu,
      frustrated: fer.fru,
    } as any);
  }, [fer.pos, fer.neu, fer.fru, updateFER]);

  // Start voice emotion fusion
  useVoiceEmotion({
    enabled: micEnabled,
    faceFer: { pos: fer.pos, neu: fer.neu, fru: fer.fru },
    minVad: minVadToUse,
  });

  // Start/stop camera on session lifecycle
  useEffect(() => {
    if (isActive) {
      enable().catch(() => {});
    } else {
      disable();
    }
  }, [isActive, enable, disable]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Camera unavailable",
        description: "Falling back to pseudo emotion estimates.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Show summary dialog when summary exists
  useEffect(() => {
    if (summary) {
      setShowSummaryDialog(true);
    }
  }, [summary]);

  // Show congratulations dialog when mastery reaches 100%
  useEffect(() => {
    if (isActive && mastery >= 1.0 && !hasShownMastery100) {
      console.log('[MASTERY 100] Congratulations! Mastery reached 100%');
      setShowMastery100Dialog(true);
      setHasShownMastery100(true);
      
      // Also show a toast notification
      toast({
        title: "🎉 100% Mastery Achieved!",
        description: "Congratulations! You've mastered this concept completely!",
        duration: 5000,
      });
    }
  }, [mastery, isActive, hasShownMastery100, toast]);

  // Reset the flag when starting a new session
  useEffect(() => {
    if (!isActive) {
      setHasShownMastery100(false);
    }
  }, [isActive]);

  const handleStartSession = () => {
    setShowStartDialog(true);
  };

  const handleConfirmStart = async () => {
    try {
      await startSession(mode);
      setShowStartDialog(false);
      toast({
        title: "Session Started",
        description: "Your learning session has begun!",
      });
    } catch (error) {
      toast({
        title: "Backend Unreachable",
        description: "Check that the FastAPI server is running.",
        variant: "destructive",
      });
    }
  };

  const handleSubmitAnswer = async (answer: string, responseTime: number) => {
    try {
      // Pass raw FER values (not fusedFer) so backend can fuse with SER
      const response = await submitAnswer(
        answer,
        { positive: fer.pos, neutral: fer.neu, frustrated: fer.fru } as any,
        responseTime
      );
      
      // Show feedback based on backend response
      const feedbackMessages = {
        encourage: response.next_action.feedback === "encourage" 
          ? "It's Okay! Its just a matter of practice!" 
          : "You're doing well! Keep learning and you'll get it!",
        hint: response.next_action.feedback === "hint" 
          ? "Here's a hint to help you: " + (currentQuestion?.hint || "Try breaking it down step by step")
          : "Consider this approach: " + (currentQuestion?.hint || "Think about the key concepts"),
        neutral: response.next_action.feedback === "neutral" 
          ? "Good attempt. Let's continue learning."
          : "Let's move on to the next question.",
      };

      const feedbackType = response.next_action.feedback;
      setFeedback({
        type: feedbackType,
        message: feedbackMessages[feedbackType as keyof typeof feedbackMessages]
      });

      toast({
        title: response.reward > 0 ? "Correct!" : "Incorrect",
        description: `You earned ${response.reward > 0 ? "+" : ""}${response.reward.toFixed(1)} points`,
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit answer. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <HeaderBar 
        videoRef={previewVideoRef} 
        canvasRef={canvasRef} 
        mediaStreamRef={mediaStreamRef}
        cameraEnabled={enabled}
      />
      
      <PrivacyBanner />
      
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
          {/* Sidebar - Hidden on mobile, shown on xl+ */}
          <aside className="hidden xl:block xl:col-span-3">
            <SessionSidebar 
              videoRef={previewVideoRef} 
              canvasRef={canvasRef} 
              mediaStreamRef={mediaStreamRef}
              cameraEnabled={enabled}
            />
          </aside>

          {/* Main Content */}
          <div className="xl:col-span-6 space-y-6">
            {!isActive ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-6 max-w-md">
                  <div className="text-6xl">🎓</div>
                  <h2 className="text-3xl font-bold text-foreground">Welcome to Your AI Tutor</h2>
                  <p className="text-muted-foreground text-lg">
                    Start a session to begin your personalized learning journey with emotion-aware adaptation.
                  </p>
                  <button
                    onClick={handleStartSession}
                    className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-medium hover:bg-primary/90 transition-colors shadow-lg"
                  >
                    Start Learning Session
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-foreground">Learning Session</h2>
                </div>
                
                <QuestionCard
                  question={currentQuestion}
                  onSubmit={handleSubmitAnswer}
                  feedback={feedback || undefined}
                  isSubmitting={isSubmitting}
                  isLoading={isLoadingQuestion}
                />
              </div>
            )}
          </div>

          {/* Insights Panel - Hidden on mobile, shown on xl+ */}
          <aside className="hidden xl:block xl:col-span-3">
            <InsightsPanel />
          </aside>
        </div>
      </main>

      <FooterBar />

      {/* Hidden video element for FER processing only */}
      <div className="fixed -left-[9999px] -top-[9999px]">
        <video ref={videoRef} muted playsInline />
        <canvas ref={canvasRef} />
      </div>

      <StartSessionDialog
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        onConfirm={handleConfirmStart}
      />

      <SummaryDialog 
        open={showSummaryDialog} 
        onOpenChange={setShowSummaryDialog} 
      />

      <Mastery100Dialog
        open={showMastery100Dialog}
        onOpenChange={setShowMastery100Dialog}
      />
      
      <DebugPanel />
    </div>
  );
}
