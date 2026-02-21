"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrivacyDialog } from "./PrivacyDialog";
import { useSessionStore } from "@/store/session";
import { useToast } from "@/lib/hooks/use-toast";

interface PrivacyBannerProps {
  className?: string;
}

export function PrivacyBanner({ className }: PrivacyBannerProps) {
  const [visible, setVisible] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const { micEnabled } = useSessionStore();
  const { toast } = useToast();

  useEffect(() => {
    try {
      const agreed = localStorage.getItem("et_privacy_ok");
      setVisible(agreed !== "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const agreed = localStorage.getItem("et_privacy_ok");
      if (micEnabled && agreed !== "1") {
        toast({ title: "Privacy Reminder", description: "Microphone enabled — only emotion probabilities are stored." });
      }
    } catch {}
  }, [micEnabled, toast]);

  const handleAgree = () => {
    try {
      localStorage.setItem("et_privacy_ok", "1");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <div className={`w-full bg-muted text-muted-foreground border-b ${className}`}>
        <div className="container mx-auto px-4 py-3 text-sm flex items-center gap-3">
          <Info className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            Camera and microphone are used locally; only emotion probabilities (not raw audio/video) are stored.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDialog(true)}
              className="text-xs"
            >
              Learn more
            </Button>
            <Button
              size="sm"
              onClick={handleAgree}
              className="text-xs"
            >
              I Agree
            </Button>
          </div>
        </div>
      </div>
      
      <PrivacyDialog open={showDialog} onOpenChange={setShowDialog} />
    </>
  );
}