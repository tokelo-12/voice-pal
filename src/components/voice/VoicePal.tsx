'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Blob, BlobState } from './Blob';
import { interpretVoiceCommand } from '@/ai/flows/interpret-voice-command-flow';
import { toast } from '@/hooks/use-toast';

export const VoicePal: React.FC = () => {
  const [appState, setAppState] = useState<BlobState>('idle');
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize Speech Services
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsSupported(false);
        return;
      }
      
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US'; // We'll handle multi-lang via Genkit interpretation of the raw audio/text

      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return;
    
    // Cancel existing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setAppState('speaking');
    utterance.onend = () => setAppState('idle');
    utterance.onerror = () => setAppState('idle');
    
    // Find a clear voice if possible
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en-GB') || v.lang.includes('en-ZA')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    synthRef.current.speak(utterance);
  }, []);

  const handleIntent = useCallback(async (text: string) => {
    setAppState('processing');
    try {
      const result = await interpretVoiceCommand({ command: text });
      
      if (result.intent === 'make_call') {
        const contact = result.details.contactName || result.details.phoneNumber;
        speak(`Certainly. Calling ${contact} now.`);
        console.log('Action: make_call', result.details);
      } else if (result.intent === 'send_sms') {
        const contact = result.details.contactName || result.details.phoneNumber;
        speak(`Sending message to ${contact}. Message content: ${result.details.message}`);
        console.log('Action: send_sms', result.details);
      } else if (result.intent === 'buy_airtime') {
        speak(`Purchasing ${result.details.amount} Rand airtime for ${result.details.recipient}.`);
        console.log('Action: buy_airtime', result.details);
      } else {
        speak(result.reason || "I'm sorry, I didn't quite catch that. Could you repeat the command?");
      }
    } catch (error) {
      console.error('Genkit error:', error);
      setAppState('error');
      speak("I encountered an error processing your request. Please try again.");
    }
  }, [speak]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;

    if (appState === 'idle' || appState === 'error') {
      setAppState('listening');
      recognitionRef.current.start();
      
      recognitionRef.current.onresult = (event: any) => {
        const currentTranscript = event.results[0][0].transcript;
        setTranscript(currentTranscript);
        handleIntent(currentTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'no-speech') {
          speak("I didn't hear anything. Please tap and try again.");
        } else {
          setAppState('error');
        }
      };

      recognitionRef.current.onend = () => {
        if (appState === 'listening') {
          setAppState('idle');
        }
      };
    } else if (appState === 'listening') {
      recognitionRef.current.stop();
      setAppState('idle');
    }
  }, [appState, handleIntent, isSupported, speak]);

  // Accessibility: Welcome message on mount
  useEffect(() => {
    const welcomeTimeout = setTimeout(() => {
      speak("Welcome to Voice Pal. Tap the center of the screen to give a command in Sesotho, isiZulu, or English.");
    }, 1000);
    return () => clearTimeout(welcomeTimeout);
  }, [speak]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <Blob state={appState} onClick={toggleListening} isSupported={isSupported} />
      
      {/* High-contrast status bar for non-completely blind users or low-vision users */}
      <div className="fixed bottom-12 w-full max-w-lg px-8">
        <div className="bg-secondary/50 backdrop-blur-md rounded-2xl p-4 border border-border/50">
          <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-1">Status</p>
          <p className="text-foreground text-sm font-medium">
            {transcript ? `"${transcript}"` : "Ready for command"}
          </p>
        </div>
      </div>
    </div>
  );
};
