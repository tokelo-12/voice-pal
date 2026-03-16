import { VoicePal } from '@/components/voice/VoicePal';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background overflow-hidden selection:bg-accent selection:text-background">
      {/* Subtle Background Elements for depth */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/5 blur-[120px] rounded-full" />
      </div>

      {/* Screen Reader Only Title */}
      <h1 className="sr-only">VoicePal - Voice Assistant for Visually Impaired</h1>

      {/* Main Interactive Interface */}
      <div className="relative z-10 w-full h-screen flex flex-col">
        <VoicePal />
      </div>

      {/* Accessibility instruction for screen readers */}
      <div className="sr-only" aria-live="polite">
        VoicePal is ready. Tap anywhere on the large central blob to start speaking your command for calls, messages, or airtime.
      </div>
    </main>
  );
}
