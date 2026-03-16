'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Blob, BlobState } from './Blob';
import { interpretVoiceCommand } from '@/ai/flows/interpret-voice-command-flow';
import { Button } from '@/components/ui/button';
import { Mic, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type SupportedLanguage = 'en-US' | 'zu-ZA' | 'st-ZA';

export const VoicePal: React.FC = () => {
  const [appState, setAppState] = useState<BlobState>('idle');
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [isListeningForLanguage, setIsListeningForLanguage] = useState(false);
  
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

  const speak = useCallback((text: string, lang: string = 'en-US') => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onstart = () => setAppState('speaking');
    utterance.onend = () => setAppState('idle');
    utterance.onerror = () => setAppState('idle');
    
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes(lang.split('-')[0])) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    synthRef.current.speak(utterance);
  }, []);

  const selectLanguage = useCallback((lang: SupportedLanguage | null) => {
    setSelectedLanguage(lang);
    setIsListeningForLanguage(false);
    setTranscript('');
    
    if (lang) {
      let welcome = "";
      if (lang === 'en-US') welcome = "English selected. Welcome to Voice Pal. Tap the center of the screen to give a command.";
      if (lang === 'zu-ZA') welcome = "isiZulu sikhethiwe. Siyakwamukela ku-Voice Pal. Thinta isikrini ukuze ukhulume.";
      if (lang === 'st-ZA') welcome = "Sesotho se khethiloe. Re u amohela ho Voice Pal. Tobetsa skrine ho bua.";
      
      setTimeout(() => speak(welcome, lang), 100);
    } else {
      // If going back to selection
      setTimeout(() => speak("Returning to language selection. Please choose English, Zulu, or Sesotho.", "en-US"), 100);
    }
  }, [speak]);

  const toggleLanguageListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;

    if (!isListeningForLanguage) {
      setIsListeningForLanguage(true);
      recognitionRef.current.lang = 'en-US'; // Default to EN for broad recognition of language names
      recognitionRef.current.start();
      
      recognitionRef.current.onresult = (event: any) => {
        const result = event.results[0][0].transcript.toLowerCase();
        setTranscript(result);
        
        if (result.includes('english')) {
          selectLanguage('en-US');
        } else if (result.includes('zulu') || result.includes('zulu')) {
          selectLanguage('zu-ZA');
        } else if (result.includes('sotho') || result.includes('sesotho')) {
          selectLanguage('st-ZA');
        } else {
          speak("I didn't recognize that language. Please say English, Zulu, or Sesotho.", "en-US");
          setIsListeningForLanguage(false);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        setIsListeningForLanguage(false);
        if (event.error !== 'no-speech') {
          speak("Voice selection error. Please tap a button instead.", "en-US");
        }
      };

      recognitionRef.current.onend = () => {
        setIsListeningForLanguage(false);
      };
    } else {
      recognitionRef.current.stop();
      setIsListeningForLanguage(false);
    }
  }, [isListeningForLanguage, isSupported, selectLanguage, speak]);

  const handleIntent = useCallback(async (text: string) => {
    if (!selectedLanguage) return;
    setAppState('processing');
    try {
      const result = await interpretVoiceCommand({ command: text });
      
      if (result.intent === 'make_call') {
        const contact = result.details.contactName || result.details.phoneNumber;
        speak(`Certainly. Calling ${contact} now.`, selectedLanguage);
      } else if (result.intent === 'send_sms') {
        const contact = result.details.contactName || result.details.phoneNumber;
        speak(`Sending message to ${contact}. Message content: ${result.details.message}`, selectedLanguage);
      } else if (result.intent === 'buy_airtime') {
        speak(`Purchasing ${result.details.amount} Rand airtime for ${result.details.recipient}.`, selectedLanguage);
      } else if (result.intent === 'change_language') {
        selectLanguage(null);
      } else {
        speak(result.reason || "I'm sorry, I didn't quite catch that. Could you repeat the command?", selectedLanguage);
      }
    } catch (error) {
      setAppState('error');
      speak("I encountered an error processing your request. Please try again.", selectedLanguage);
    }
  }, [selectedLanguage, speak, selectLanguage]);

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
        if (event.error === 'no-speech') {
          speak("I didn't hear anything. Please tap and try again.", selectedLanguage);
        } else {
          setAppState('error');
        }
      };

      recognitionRef.current.onend = () => {
        if (appState === 'listening') setAppState('idle');
      };
    } else if (appState === 'listening') {
      recognitionRef.current.stop();
      setAppState('idle');
    }
  }, [appState, handleIntent, isSupported, selectedLanguage, speak]);

  // Initial welcome prompt
  useEffect(() => {
    if (!selectedLanguage && isSupported) {
      const timer = setTimeout(() => {
        speak("Welcome to Voice Pal. Please say your language: English, Zulu, or Sesotho. Or tap the screen to select.", "en-US");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedLanguage, isSupported, speak]);

  if (!selectedLanguage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12 bg-background min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-extrabold text-foreground uppercase tracking-tighter">
            Language Selection
          </h2>
          <p className="text-muted-foreground text-lg">Speak or tap your choice</p>
        </div>

        {/* Central Voice Option for Language Selection */}
        <button
          onClick={toggleLanguageListening}
          className={cn(
            "w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 blob-shadow",
            isListeningForLanguage ? "bg-accent scale-110 animate-pulse" : "bg-primary"
          )}
          aria-label={isListeningForLanguage ? "Listening for language" : "Tap to speak your language"}
        >
          {isListeningForLanguage ? (
            <Mic className="w-20 h-20 text-primary animate-bounce" />
          ) : (
            <Mic className="w-20 h-20 text-background" />
          )}
        </button>

        <div className="grid grid-cols-1 w-full max-w-md gap-6">
          <Button 
            onClick={() => selectLanguage('en-US')}
            className="h-20 text-2xl font-bold bg-secondary hover:bg-secondary/80 rounded-2xl border-4 border-transparent focus:border-accent"
            aria-label="Select English"
          >
            ENGLISH
          </Button>
          <Button 
            onClick={() => selectLanguage('zu-ZA')}
            className="h-20 text-2xl font-bold bg-secondary hover:bg-secondary/80 rounded-2xl border-4 border-transparent focus:border-accent"
            aria-label="Khetha isiZulu"
          >
            ISIZULU
          </Button>
          <Button 
            onClick={() => selectLanguage('st-ZA')}
            className="h-20 text-2xl font-bold bg-secondary hover:bg-secondary/80 rounded-2xl border-4 border-transparent focus:border-accent"
            aria-label="Khetha Sesotho"
          >
            SESOTHO
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      {/* Back Button */}
      <div className="absolute top-8 left-8">
        <Button
          variant="outline"
          size="lg"
          onClick={() => selectLanguage(null)}
          className="h-16 px-6 gap-3 text-xl font-bold rounded-2xl border-2 hover:bg-accent hover:text-accent-foreground border-primary/20 bg-background/50 backdrop-blur-sm shadow-lg group"
          aria-label="Go back to language selection"
        >
          <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
          BACK
        </Button>
      </div>

      <Blob state={appState} onClick={toggleListening} isSupported={isSupported} />
      
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
