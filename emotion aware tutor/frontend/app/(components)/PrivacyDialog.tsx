"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Camera, Database, Settings } from "lucide-react";

interface PrivacyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyDialog({ open, onOpenChange }: PrivacyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Data Usage
          </DialogTitle>
          <DialogDescription>
            How we handle your camera and data
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Camera className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Local Processing</h4>
              <p className="text-sm text-muted-foreground">
                All emotion detection runs locally using TensorFlow.js or ONNX Runtime. 
                No video frames are sent to external servers.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Data Storage</h4>
              <p className="text-sm text-muted-foreground">
                Only emotion probabilities (numbers) are stored in session logs. 
                Raw video data is never saved or transmitted.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Settings className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Camera Control</h4>
              <p className="text-sm text-muted-foreground">
                You can disable the camera preview anytime using the toggle in the sidebar. 
                The emotion detection will continue with synthetic estimates.
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}






