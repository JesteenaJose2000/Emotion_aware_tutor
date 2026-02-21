"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Play, Clock, Target, Brain, Camera, Circle, Mic, Info } from "lucide-react";
import { useSessionStore } from "@/store/session";
import { EmotionGauge } from "./EmotionGauge";
import { formatTime } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { computeMasteryGain } from "@/src/lib/reward";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SessionSidebarProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  mediaStreamRef?: React.RefObject<MediaStream | null>;
  cameraEnabled?: boolean;
}

export function SessionSidebar({ videoRef, canvasRef, mediaStreamRef, cameraEnabled }: SessionSidebarProps) {
  const sessionId = useSessionStore(s => s.sessionId);
  const isActive = useSessionStore(s => s.isActive);
  const fer = useSessionStore(s => s.fer);
  const mastery = useSessionStore(s => s.mastery);
  const totalReward = useSessionStore(s => s.totalReward);
  const startSession = useSessionStore(s => s.startSession);
  const endSession = useSessionStore(s => s.endSession);
  const sessionStartTime = useSessionStore(s => s.sessionStartTime);
  const turn = useSessionStore(s => s.turn);
  const currentDifficulty = useSessionStore(s => s.currentDifficulty);
  const micEnabled = useSessionStore(s => s.micEnabled);
  const minVadToUse = useSessionStore(s => s.minVadToUse);
  const voiceFer = useSessionStore(s => s.voiceFer);
  const fusedFer = useSessionStore(s => s.fusedFer);
  const setMicEnabled = useSessionStore(s => s.setMicEnabled);
  const setMinVadToUse = useSessionStore(s => s.setMinVadToUse);
  
  // Use fused FER when mic is enabled (SER mode), otherwise use face FER
  const displayFer = micEnabled ? { positive: fusedFer.pos, neutral: fusedFer.neu, frustrated: fusedFer.fru } : fer;
  
  // Determine actual camera status
  const isCameraActive = cameraEnabled && mediaStreamRef?.current;
  
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const prevMasteryRef = useRef(mastery);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  // Sync video stream when preview is enabled - use continuous stream
  useEffect(() => {
    if (!videoRef?.current || !mediaStreamRef?.current) return;

    if (showPreview) {
      // Assign the continuous stream to the preview video
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(() => {});
    } else {
      // Clear the preview video when disabled
      videoRef.current.srcObject = null;
    }
  }, [showPreview, mediaStreamRef]);

  // Track mastery delta
  useEffect(() => {
    const delta = computeMasteryGain(prevMasteryRef.current, mastery);
    prevMasteryRef.current = mastery;
  }, [mastery]);

  const handleStartSession = () => {
    startSession('bandit'); // Always use bandit mode (the agent)
    setElapsedTime(0);
  };

  const handleEndSession = () => {
    endSession();
    setElapsedTime(0);
  };

  return (
    <div className="space-y-6">
      {/* Session Card */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isActive ? (
            <div className="space-y-3">
              <Button 
                onClick={handleStartSession}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Session
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Session ID</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {sessionId?.slice(0, 8)}...
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Elapsed:</span>
                <span className="font-mono">{formatTime(elapsedTime)}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Turn:</span>
                <span className="font-medium">{turn}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Difficulty:</span>
                <Badge variant="outline">{currentDifficulty}</Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Camera</span>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Circle className={`h-2 w-2 ${isActive ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
                  {isActive ? 'On' : 'Off'}
                </Badge>
              </div>
              
              <Button 
                onClick={handleEndSession}
                variant="destructive"
                size="sm"
                className="w-full"
              >
                End Session
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User State Card */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            User State
            {isActive && (
              <span className="inline-flex items-center ml-1">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Real-time emotion detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmotionGauge fer={displayFer} />
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Show video preview</span>
              <Badge 
                variant={isCameraActive ? "default" : "secondary"} 
                className="text-xs"
              >
                Camera: {isCameraActive ? "On" : "Off"}
              </Badge>
            </div>
            <Switch checked={showPreview} onCheckedChange={setShowPreview} />
          </div>
          {showPreview && videoRef && canvasRef && (
            <div className="mt-3 relative rounded-xl overflow-hidden border bg-black/50 shadow">
              <video 
                ref={videoRef} 
                muted 
                playsInline 
                className="w-full aspect-video object-cover"
                style={{ transform: 'scaleX(-1)' }}
                autoPlay
              />
              <canvas 
                ref={canvasRef} 
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>
          )}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Microphone</span>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Circle className={`h-2 w-2 ${micEnabled ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
                {micEnabled ? 'On' : 'Off'}
              </Badge>
            </div>
            <Switch checked={micEnabled} onCheckedChange={(v) => setMicEnabled(v)} />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="vad-thresh" className="text-sm">Voice sensitivity (VAD threshold)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button aria-label="What is VAD?" className="text-muted-foreground hover:text-foreground">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-sm max-w-xs">
                      <div className="text-muted-foreground">If your room is noisy, increase this value.</div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Slider id="vad-thresh" value={[minVadToUse]} onValueChange={(v)=> setMinVadToUse(v[0])} min={0} max={1} step={0.05} />
              <div className="text-xs text-muted-foreground">Current: {minVadToUse.toFixed(2)} | VAD now: {Math.round((voiceFer?.vad ?? 0) * 100)}%</div>
              <div className="text-xs text-muted-foreground">We only store probabilities; raw audio is not saved.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mastery Card */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Mastery
          </CardTitle>
          <CardDescription>
            Current concept progress
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{Math.round(mastery * 100)}%</span>
            </div>
            <Progress value={mastery * 100} className="h-2" />
            {turn > 0 && (
              <div className="text-xs text-muted-foreground">
                Δ: {computeMasteryGain(prevMasteryRef.current, mastery).toFixed(3)}
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Reward</span>
            <Badge 
              variant={totalReward >= 0 ? "success" : "destructive"}
              className="font-mono"
            >
              {totalReward >= 0 ? "+" : ""}{totalReward.toFixed(1)}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
