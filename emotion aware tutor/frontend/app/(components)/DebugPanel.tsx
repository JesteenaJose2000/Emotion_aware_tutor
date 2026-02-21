"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Eye, EyeOff, Mic, FlaskConical } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useSessionStore } from "@/store/session";
import { useRewardWeightsStore } from "@/src/store/reward";
import { runLinucbSelfCheck } from "@/src/lib/policy/__tests__/linucb.selfcheck";
import { FUSION_LAMBDA } from "@/src/lib/fusion";
import { postSER } from "@/src/lib/serClient";
import { useSerDebugStore } from "@/src/store/serDebug";

export function DebugPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  const { toast } = useToast();
  
  const {
    accuracyHistory,
    engagementHistory,
    rewardHistory,
    fer,
    mastery,
    currentConcept,
    currentDifficulty,
    mode,
    turn,
    rewardPrev,
    cumulativeReward,
    accuracyMean,
    engagementMean,
    micEnabled,
    voiceFer,
    fusedFer,
    minVadToUse,
  } = useSessionStore();
  const { recentChunks, duplicateCount, sentCount } = useSerDebugStore();
  
  const { alpha, beta, gamma } = useRewardWeightsStore();

  const handleLinucbCheck = () => {
    const result = runLinucbSelfCheck();
    toast({
      title: result.passed ? "LinUCB Check Passed" : "LinUCB Check Failed",
      description: result.note,
      variant: result.passed ? "default" : "destructive",
    });
  };

  const handleTestSER = async () => {
    try {
      // Create a simple test audio blob (1 second of silence)
      const sampleRate = 16000;
      const duration = 1.0;
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = new ArrayBuffer(44 + numSamples * 4);
      const view = new DataView(buffer);
      
      // Write WAV header
      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numSamples * 4, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 3, true); // IEEE float
      view.setUint16(22, 1, true); // mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 4, true);
      view.setUint16(32, 4, true);
      view.setUint16(34, 32, true);
      writeString(36, 'data');
      view.setUint32(40, numSamples * 4, true);
      
      // Write silence (zeros)
      for (let i = 0; i < numSamples; i++) {
        view.setFloat32(44 + i * 4, 0, true);
      }
      
      const blob = new Blob([buffer], { type: 'audio/wav' });
      const result = await postSER(blob);
      
      toast({
        title: "SER Test Successful",
        description: `Pos: ${result.pos.toFixed(3)}, Neu: ${result.neu.toFixed(3)}, Fru: ${result.fru.toFixed(3)}, VAD: ${result.vad.toFixed(3)}`,
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "SER Test Failed",
        description: error?.message || "Could not connect to SER service. Make sure it's running on port 8000.",
        variant: "destructive",
      });
    }
  };

  // Only show if debug mode is enabled
  if (process.env.NEXT_PUBLIC_DEBUG !== "1") {
    return null;
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsVisible(true)}
          className="rounded-full w-8 h-8 p-0"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="bg-background/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-mono">Debug Panel</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsVisible(false)}
                className="h-6 w-6 p-0"
              >
                <EyeOff className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-2 text-xs font-mono">
            {/* Basic Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Turn:</span>
                <span className="ml-1 font-bold">{turn}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Mode:</span>
                <Badge variant="outline" className="ml-1 text-xs">
                  {mode}
                </Badge>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-1">
              <div>
                <span className="text-muted-foreground">Accuracy:</span>
                <span className="ml-1 font-bold">
                  {(accuracyMean * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Engagement:</span>
                <span className="ml-1 font-bold">
                  {engagementMean.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Reward:</span>
                <span className="ml-1 font-bold">
                  {cumulativeReward.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Current State */}
            <div className="space-y-1">
              <div>
                <span className="text-muted-foreground">Concept:</span>
                <span className="ml-1 font-bold">{currentConcept}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Difficulty:</span>
                <span className="ml-1 font-bold">{currentDifficulty}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Mastery:</span>
                <span className="ml-1 font-bold">
                  {(mastery * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="space-y-2 pt-2 border-t">
                {/* FER Values */}
                <div>
                  <div className="text-muted-foreground mb-1">FER (EMA):</div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div>
                      <span className="text-green-600">Pos:</span>
                      <span className="ml-1">{fer.positive.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="text-blue-600">Neu:</span>
                      <span className="ml-1">{fer.neutral.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="text-red-600">Fru:</span>
                      <span className="ml-1">{fer.frustrated.toFixed(3)}</span>
                    </div>
                  </div>
                </div>

                {/* SER Status */}
                <div>
                  <div className="text-muted-foreground mb-1 flex items-center gap-1">
                    <Mic className="h-3 w-3" />
                    SER Status:
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Mic:</span>
                      <Badge variant={micEnabled ? "default" : "secondary"} className="text-xs">
                        {micEnabled ? "On" : "Off"}
                      </Badge>
                    </div>
                    {micEnabled && voiceFer && (
                      <>
                        <div className="grid grid-cols-3 gap-1">
                          <div>
                            <span className="text-green-600">Pos:</span>
                            <span className="ml-1">{voiceFer.pos.toFixed(3)}</span>
                          </div>
                          <div>
                            <span className="text-blue-600">Neu:</span>
                            <span className="ml-1">{voiceFer.neu.toFixed(3)}</span>
                          </div>
                          <div>
                            <span className="text-red-600">Fru:</span>
                            <span className="ml-1">{voiceFer.fru.toFixed(3)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">VAD:</span>
                          <span>{Math.round((voiceFer.vad ?? 0) * 100)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">VAD Threshold:</span>
                          <span>{minVadToUse.toFixed(2)}</span>
                        </div>
                        {recentChunks.length > 0 && (
                          <div className="space-y-1 pt-2 border-t">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Chunk #{recentChunks[0].seq}</span>
                              <Badge variant={recentChunks[0].duplicate ? "secondary" : "default"} className="text-[10px]">
                                {recentChunks[0].duplicate ? "Duplicate" : "Sent"}
                              </Badge>
                            </div>
                            <div className="text-[10px] font-mono">
                              RMS {recentChunks[0].rms.toFixed(4)} • Peak {recentChunks[0].peak.toFixed(4)} • Mean {recentChunks[0].mean.toFixed(4)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Duration {(recentChunks[0].durationSec).toFixed(2)}s • Bytes ~{recentChunks[0].approxBytes}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Sent {sentCount} • Duplicates {duplicateCount}
                            </div>
                            <div className="space-y-0.5">
                              {recentChunks.slice(0, 3).map((chunk) => (
                                <div key={chunk.seq} className="flex items-center justify-between text-[10px] font-mono">
                                  <span>#{chunk.seq} {chunk.duplicate ? "dup" : "sent"}</span>
                                  <span>{chunk.rms.toFixed(3)} / {chunk.peak.toFixed(3)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Fusion Info */}
                <div>
                  <div className="text-muted-foreground mb-1">Fusion:</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Lambda (Face weight):</span>
                      <span>{FUSION_LAMBDA.toFixed(2)}</span>
                    </div>
                    <div className="text-muted-foreground mb-1">Fused FER:</div>
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <span className="text-green-600">Pos:</span>
                        <span className="ml-1">{fusedFer.pos.toFixed(3)}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Neu:</span>
                        <span className="ml-1">{fusedFer.neu.toFixed(3)}</span>
                      </div>
                      <div>
                        <span className="text-red-600">Fru:</span>
                        <span className="ml-1">{fusedFer.fru.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reward Weights */}
                <div>
                  <div className="text-muted-foreground mb-1">Reward Weights:</div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div>
                      <span className="text-muted-foreground">α:</span>
                      <span className="ml-1">{alpha.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">β:</span>
                      <span className="ml-1">{beta.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">γ:</span>
                      <span className="ml-1">{gamma.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Last Reward */}
                {rewardPrev !== null && (
                  <div>
                    <span className="text-muted-foreground">Last Reward:</span>
                    <span className="ml-1 font-bold">
                      {rewardPrev.toFixed(3)}
                    </span>
                  </div>
                )}

                {/* History Lengths */}
                <div>
                  <div className="text-muted-foreground mb-1">History Lengths:</div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div>Acc: {accuracyHistory.length}</div>
                    <div>Eng: {engagementHistory.length}</div>
                    <div>Rew: {rewardHistory.length}</div>
                  </div>
                </div>

                {/* Test Buttons */}
                <div className="pt-2 space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLinucbCheck}
                    className="w-full text-xs"
                  >
                    Run LinUCB Check
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestSER}
                    className="w-full text-xs flex items-center gap-1"
                  >
                    <FlaskConical className="h-3 w-3" />
                    Test SER Service
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
