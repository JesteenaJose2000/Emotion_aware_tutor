"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, Star, Square } from "lucide-react";
import { useSessionStore } from "@/store/session";

interface Mastery100DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Mastery100Dialog({ open, onOpenChange }: Mastery100DialogProps) {
  const endSession = useSessionStore(s => s.endSession);

  const handleEndSession = () => {
    endSession();
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Trophy className="h-20 w-20 text-yellow-500 animate-bounce" />
              <Sparkles className="h-8 w-8 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
            </div>
          </div>
          <DialogTitle className="text-3xl font-bold text-center">
            🎉 Congratulations! 🎉
          </DialogTitle>
          <DialogDescription className="text-lg pt-2 text-center">
            You've achieved <span className="font-bold text-primary">100% Mastery</span>!
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3 text-center">
          <p className="text-muted-foreground">
            Outstanding work! You've demonstrated complete mastery of this concept.
          </p>
          <div className="flex justify-center gap-2 py-2">
            <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
            <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
            <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            Keep up the excellent work and continue challenging yourself!
          </p>
        </div>

        <DialogFooter className="sm:justify-center gap-2">
          <Button
            variant="outline"
            onClick={handleEndSession}
            className="w-full sm:w-auto"
            size="lg"
          >
            <Square className="h-4 w-4 mr-2" />
            End Session
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            size="lg"
          >
            Continue Learning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

