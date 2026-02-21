"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, Square } from "lucide-react";
import { useSessionStore } from "@/store/session";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SessionSidebar } from "./SessionSidebar";
import { FUSION_LAMBDA } from "@/src/lib/fusion";
 

interface HeaderBarProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  mediaStreamRef?: React.RefObject<MediaStream | null>;
  cameraEnabled?: boolean;
}

export function HeaderBar({ videoRef, canvasRef, mediaStreamRef, cameraEnabled }: HeaderBarProps) {
  const isActive = useSessionStore(s => s.isActive);
  const turn = useSessionStore(s => s.turn);
  const endSession = useSessionStore(s => s.endSession);
  const micEnabled = useSessionStore(s => s.micEnabled);

  // Dark mode enforced via layout; no theme toggle

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-primary text-primary-foreground">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Mobile menu */}
        <div className="flex items-center gap-4 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SessionSidebar 
                videoRef={videoRef} 
                canvasRef={canvasRef} 
                mediaStreamRef={mediaStreamRef}
                cameraEnabled={cameraEnabled}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-lg">
            <span className="text-lg font-bold">EA</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-semibold">Emotion-Aware Adaptive Tutor</h1>
          </div>
          
          <Badge variant="outline" className="hidden sm:flex text-xs">
          Microphone: {micEnabled ? `On (λ ${FUSION_LAMBDA.toFixed(2)})` : 'Off'}
          </Badge>
        </div>

        {/* Desktop controls */}
        <div className="hidden lg:flex items-center gap-4">
          {isActive && turn > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={endSession}
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              End Session
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
