'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Mic, Loader2, Volume2, MicOff, CheckCircle2 } from 'lucide-react';

export type BlobState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error' | 'success';

interface BlobProps {
  state: BlobState;
  onClick: () => void;
  isSupported: boolean;
}

export const Blob: React.FC<BlobProps> = ({ state, onClick, isSupported }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-12 w-full h-full max-w-md mx-auto">
      <button
        onClick={onClick}
        disabled={!isSupported}
        className={cn(
          "relative w-64 h-64 rounded-full transition-all duration-700 ease-in-out flex items-center justify-center group outline-none focus:ring-4 focus:ring-accent/50",
          state === 'idle' && "bg-primary animate-blob-pulse blob-shadow",
          state === 'listening' && "bg-accent animate-blob-listen blob-shadow-accent scale-110",
          state === 'processing' && "bg-primary animate-blob-process opacity-70",
          state === 'speaking' && "bg-accent/80 animate-blob-pulse blob-shadow-accent",
          state === 'error' && "bg-destructive animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.5)]",
          state === 'success' && "bg-green-500 shadow-[0_0_40px_rgba(34,197,94,0.6)] scale-105",
          !isSupported && "bg-muted cursor-not-allowed"
        )}
        aria-label={
          state === 'idle' ? "Tap to speak" : 
          state === 'listening' ? "Listening" : 
          state === 'processing' ? "Processing command" : 
          state === 'speaking' ? "Speaking" :
          state === 'success' ? "Success" :
          "Error"
        }
      >
        <div className="z-10 text-background">
          {state === 'idle' && <Mic className="w-20 h-20" />}
          {state === 'listening' && <Mic className="w-24 h-24 text-primary animate-bounce" />}
          {state === 'processing' && <Loader2 className="w-20 h-20 animate-spin text-background" />}
          {state === 'speaking' && <Volume2 className="w-20 h-20 text-primary" />}
          {state === 'error' && <MicOff className="w-20 h-20" />}
          {state === 'success' && <CheckCircle2 className="w-24 h-24 text-background" />}
          {!isSupported && <MicOff className="w-20 h-20" />}
        </div>
        
        {/* Animated rings for states */}
        {(state === 'listening' || state === 'success') && (
          <>
            <div className={cn(
              "absolute inset-0 rounded-full border-4 animate-ping opacity-20",
              state === 'listening' ? "border-accent" : "border-green-400"
            )} />
            <div className={cn(
              "absolute inset-0 rounded-full border-8 animate-ping delay-300 opacity-10",
              state === 'listening' ? "border-accent" : "border-green-400"
            )} />
          </>
        )}
      </button>

      <div className="text-center space-y-4 px-6">
        <p className="text-2xl font-bold tracking-tight text-foreground uppercase transition-colors duration-500">
          {state === 'idle' && "Tap the screen to speak"}
          {state === 'listening' && "Listening..."}
          {state === 'processing' && "Thinking..."}
          {state === 'speaking' && "VoicePal is speaking"}
          {state === 'error' && "Something went wrong"}
          {state === 'success' && "Action successful!"}
          {!isSupported && "Speech not supported"}
        </p>
        <p className="text-muted-foreground text-lg leading-relaxed">
          {state === 'idle' && "Speak in English, Sesotho, or isiZulu"}
          {state === 'listening' && "Say your command now"}
          {state === 'processing' && "Interpreting your request"}
          {state === 'speaking' && "Please wait..."}
          {state === 'error' && "Tap to try again"}
          {state === 'success' && "Your message was sent"}
        </p>
      </div>
    </div>
  );
};
