'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Blob, BlobState } from './Blob';
import { interpretVoiceCommand } from '@/ai/flows/interpret-voice-command-flow';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SupportedLanguage = 'en-US' | 'zu-ZA' | 'st-ZA';

export const VoicePal: React.FC = () => {
  const [appState, setAppState] = useState<BlobState>('idle');
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  
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

      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback((text: string, lang?: string) => {
    if (!synthRef.current) return;
    
    // Cancel existing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang || selectedLanguage || 'en-US';
    utterance.onstart = () => setAppState('speaking');
    utterance.onend = () => setAppState('idle');
    utterance.onerror = () => setAppState('idle');
    
    // Find a clear voice if possible
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes(utterance.lang.split('-')[0])) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    synthRef.current.speak(utterance);
  }, [selectedLanguage]);

  const handleIntent = useCallback(async (text: string) => {
    setAppState('processing');
    try {
      const result = await interpretVoiceCommand({ command: text });
      
      if (result.intent === 'make_call') {
        const contact = result.details.contactName || result.details.phoneNumber;
        speak(`Certainly. Calling ${contact} now.`);
      } else if (result.intent === 'send_sms') {
        const contact = result.details.contactName || result.details.phoneNumber;
        speak(`Sending message to ${contact}. Message content: ${result.details.message}`);
      } else if (result.intent === 'buy_airtime') {
        speak(`Purchasing ${result.details.amount} Rand airtime for ${result.details.recipient}.`);
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
    if (!recognitionRef.current || !isSupported || !selectedLanguage) return;

    if (appState === 'idle' || appState === 'error') {
      setAppState('listening');
      recognitionRef.current.lang = selectedLanguage;
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
  }, [appState, handleIntent, isSupported, selectedLanguage, speak]);

  const selectLanguage = (lang: SupportedLanguage) => {
    setSelectedLanguage(lang);
    
    let welcome = "";
    if (lang === 'en-US') welcome = "Welcome to Voice Pal. Tap the center of the screen to give a command.";
    if (lang === 'zu-ZA') welcome = "Siyakwamukela ku-Voice Pal. Thinta isikrini ukuze ukhulume.";
    if (lang === 'st-ZA') welcome = "Re u amohela ho Voice Pal. Tobetsa skrine ho bua.";
    
    // Slight delay to ensure state update and synthesis availability
    setTimeout(() => speak(welcome, lang), 100);
  };

  // Accessibility: Prompt for language selection if nothing selected
  useEffect(() => {
    if (!selectedLanguage) {
      const timer = setTimeout(() => {
        speak("Please select your language. English, Zulu, or Sesotho.", "en-US");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedLanguage, speak]);

  if (!selectedLanguage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 bg-background">
        <h2 className="text-3xl font-extrabold text-foreground text-center mb-8 uppercase tracking-tighter">
          Select Language / Khetha Ulimi / Khetha Puo
        </h2>
        <div className="grid grid-cols-1 w-full max-w-md gap-6">
          <Button 
            onClick={() => selectLanguage('en-US')}
            className="h-24 text-2xl font-bold bg-primary hover:bg-primary/90 rounded-2xl border-4 border-transparent focus:border-white"
            aria-label="English"
          >
            ENGLISH
          </Button>
          <Button 
            onClick={() => selectLanguage('zu-ZA')}
            className="h-24 text-2xl font-bold bg-accent text-primary hover:bg-accent/90 rounded-2xl border-4 border-transparent focus:border-white"
            aria-label="IsiZulu"
          >
            ISIZULU
          </Button>
          <Button 
            onClick={() => selectLanguage('st-ZA')}
            className="h-24 text-2xl font-bold bg-secondary hover:bg-secondary/90 rounded-2xl border-4 border-transparent focus:border-white"
            aria-label="Sesotho"
          >
            SESOTHO
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <Blob state={appState} onClick={toggleListening} isSupported={isSupported} />
      
      {/* High-contrast status bar */}
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
