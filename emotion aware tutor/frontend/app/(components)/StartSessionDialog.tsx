"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/store/session";
import { Shield, Eye, Lock } from "lucide-react";

interface StartSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function StartSessionDialog({ open, onOpenChange, onConfirm }: StartSessionDialogProps) {
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await onConfirm();
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privacy & Data Usage
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>
              Before we begin your learning session, please understand how we handle your data:
            </p>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <Eye className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                We only store emotion probabilities
              </p>
              <p className="text-xs text-green-700 dark:text-green-300">
                No video frames or personal images are saved or transmitted.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Your data is secure and anonymous
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                All data is processed locally and only aggregated statistics are shared.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isStarting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={isStarting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isStarting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
            ) : null}
            I agree & start session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
