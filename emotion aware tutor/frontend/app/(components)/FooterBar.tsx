"use client";

import { ExternalLink } from "lucide-react";

export function FooterBar() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="container py-4 px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-primary-foreground">
          <div className="flex items-center gap-4">
            <span>© 2024 Emotion-Aware Adaptive Tutor</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-xs">Research Project</span>
          </div>
          
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              Privacy Policy
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="#"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              Terms of Service
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
