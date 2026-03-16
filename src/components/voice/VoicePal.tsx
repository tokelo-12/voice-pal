'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Blob, BlobState } from './Blob';
import { CallScreen } from './CallScreen';
import { ContactList, Contact } from './ContactList';
import { interpretVoiceCommand } from '@/ai/flows/interpret-voice-command-flow';
import { tts } from '@/ai/flows/tts-flow';
import { initiateAfricaTalkingCall } from '@/services/africas-talking';
import { Button } from '@/components/ui/button';
import { Mic, ChevronLeft, Phone, MessageSquare, CreditCard, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type SupportedLanguage = 'en-US' | 'zu-ZA' | 'st-ZA';

const INITIAL_CONTACTS: Contact[] = [
  { id: '1', name: 'Mom', phoneNumber: '+27218796297' },
  { id: '2', name: 'Sello', phoneNumber: '0831234567' },
  { id: '3', name: 'Emergency', phoneNumber: '112' },
];

export const VoicePal: React.FC = () => {
  const [appState, setAppState] = useState<BlobState>('idle');
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [isListeningForLanguage, setIsListeningForLanguage] = useState(false);
  const [activeCall, setActiveCall] = useState<{ contact: string } | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [contacts] = useState<Contact[]>(INITIAL_CONTACTS);
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // In-memory cache for repeated voice responses
  const voiceCache = useRef<Map<string, string>>(new Map());

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

      audioRef.current = new Audio();
    }
  }, []);

  const browserFallbackSpeak = useCallback((text: string, lang: SupportedLanguage) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.onend = () => setAppState('idle');
      utterance.onerror = () => setAppState('idle');
      window.speechSynthesis.speak(utterance);
    } else {
      setAppState('idle');
    }
  }, []);

  const speak = useCallback(async (text: string, lang: SupportedLanguage = 'en-US') => {
    if (!audioRef.current) return;
    
    setAppState('speaking');
    const cacheKey = `${lang}:${text}`;
    
    try {
      let audioUrl = voiceCache.current.get(cacheKey);
      
      if (!audioUrl) {
        const response = await tts({ text, language: lang });
        if (response.media) {
          audioUrl = response.media;
          voiceCache.current.set(cacheKey, audioUrl);
        }
      }

      if (audioUrl) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => setAppState('idle');
        audioRef.current.onerror = () => {
          console.warn('Audio play error, falling back to browser synthesis');
          browserFallbackSpeak(text, lang);
        };
        await audioRef.current.play().catch(() => {
          browserFallbackSpeak(text, lang);
        });
      } else {
        browserFallbackSpeak(text, lang);
      }
    } catch (error) {
      console.error('TTS Flow Error:', error);
      browserFallbackSpeak(text, lang);
    }
  }, [browserFallbackSpeak]);

  const selectLanguage = useCallback((lang: SupportedLanguage | null) => {
    setSelectedLanguage(lang);
    setIsListeningForLanguage(false);
    setTranscript('');
    setActiveCall(null);
    setShowContacts(false);
    
    if (lang) {
      let welcome = "";
      if (lang === 'en-US') welcome = "English selected. Welcome to Voice Pal. Tap the center of the screen to give a command.";
      if (lang === 'zu-ZA') welcome = "isiZulu sikhethiwe. Siyakwamukela ku-Voice Pal. Thinta isikrini ukuze ukhulume.";
      if (lang === 'st-ZA') welcome = "Sesotho se khethiloe. Re u amohela ho Voice Pal. Tobetsa skrine ho bua.";
      
      setTimeout(() => speak(welcome, lang), 100);
    } else {
      setTimeout(() => speak("Returning to language selection. Please choose English, Zulu, or Sesotho.", "en-US"), 100);
    }
  }, [speak]);

  const toggleLanguageListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;

    if (!isListeningForLanguage) {
      setIsListeningForLanguage(true);
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.start();
      
      recognitionRef.current.onresult = (event: any) => {
        const result = event.results[0][0].transcript.toLowerCase();
        setTranscript(result);
        
        if (result.includes('english')) {
          selectLanguage('en-US');
        } else if (result.includes('zulu')) {
          selectLanguage('zu-ZA');
        } else if (result.includes('sotho') || result.includes('sesotho')) {
          selectLanguage('st-ZA');
        } else {
          speak("I didn't recognize that language. Please say English, Zulu, or Sesotho.", "en-US");
          setIsListeningForLanguage(false);
        }
      };

      recognitionRef.current.onerror = () => setIsListeningForLanguage(false);
      recognitionRef.current.onend = () => setIsListeningForLanguage(false);
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
        const contactName = result.details.contactName;
        // Check if contact exists in our list
        const matchedContact = contacts.find(c => c.name.toLowerCase() === contactName?.toLowerCase());
        const phoneNumber = matchedContact?.phoneNumber || result.details.phoneNumber || "+27218796297";
        const finalName = matchedContact?.name || contactName || "Unknown Contact";

        speak(`Certainly. Calling ${finalName} now.`, selectedLanguage);
        setActiveCall({ contact: finalName });
        initiateAfricaTalkingCall(phoneNumber);
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
  }, [selectedLanguage, speak, selectLanguage, contacts]);

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

  useEffect(() => {
    if (!selectedLanguage && isSupported) {
      const timer = setTimeout(() => {
        speak("Welcome to Voice Pal. Please say your language: English, Zulu, or Sesotho. Or tap the screen to select.", "en-US");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedLanguage, isSupported, speak]);

  const handleQuickAction = (action: 'call' | 'sms' | 'airtime' | 'contacts') => {
    if (!selectedLanguage) return;

    if (action === 'contacts') {
      setShowContacts(true);
      let msg = "Showing your contacts.";
      if (selectedLanguage === 'zu-ZA') msg = "Ngibonisa oxhumana nabo.";
      if (selectedLanguage === 'st-ZA') msg = "Ke u bontša mabitso a hao.";
      speak(msg, selectedLanguage);
      return;
    }
    
    if (action === 'call') {
      const testNumber = "+27218796297";
      let message = `Calling ${testNumber}`;
      if (selectedLanguage === 'zu-ZA') message = `Ishaya inombolo ${testNumber}`;
      if (selectedLanguage === 'st-ZA') message = `Ea letsetsa nomoro ea ${testNumber}`;
      
      speak(message, selectedLanguage);
      setActiveCall({ contact: testNumber });
      initiateAfricaTalkingCall(testNumber);
      return;
    }
    
    let prompt = "";
    if (action === 'sms') prompt = selectedLanguage === 'en-US' ? "Who should I message?" : selectedLanguage === 'zu-ZA' ? "Ubani okufanele ngimthumelele umlayezo?" : "Ke thumele molaetsa ho mang?";
    if (action === 'airtime') prompt = selectedLanguage === 'en-US' ? "How much airtime would you like?" : selectedLanguage === 'zu-ZA' ? "Ufuna i-airtime engakanani?" : "O batla airtime e kae?";
    
    speak(prompt, selectedLanguage);
    setTimeout(() => toggleListening(), 2500);
  };

  const handleContactCall = (contact: Contact) => {
    speak(`Calling ${contact.name}.`, selectedLanguage!);
    setActiveCall({ contact: contact.name });
    initiateAfricaTalkingCall(contact.phoneNumber);
  };

  const handleContactSms = (contact: Contact) => {
    let msg = `Say your message for ${contact.name}.`;
    if (selectedLanguage === 'zu-ZA') msg = `Khuluma umlayezo wakho we ${contact.name}.`;
    if (selectedLanguage === 'st-ZA') msg = `Bua molaetsa oa hau oa ${contact.name}.`;
    
    speak(msg, selectedLanguage!);
    setTimeout(() => toggleListening(), 2500);
  };

  const handleHangUp = () => {
    let message = "Call ended.";
    if (selectedLanguage === 'zu-ZA') message = "Ucingo luvaliwe.";
    if (selectedLanguage === 'st-ZA') message = "Mohala o khaotsoe.";
    
    speak(message, selectedLanguage!);
    setActiveCall(null);
  };

  if (!selectedLanguage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12 bg-background min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-extrabold text-foreground uppercase tracking-tighter">
            Language Selection
          </h2>
          <p className="text-muted-foreground text-lg">Speak or tap your choice</p>
        </div>

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
          >
            ENGLISH
          </Button>
          <Button 
            onClick={() => selectLanguage('zu-ZA')}
            className="h-20 text-2xl font-bold bg-secondary hover:bg-secondary/80 rounded-2xl border-4 border-transparent focus:border-accent"
          >
            ISIZULU
          </Button>
          <Button 
            onClick={() => selectLanguage('st-ZA')}
            className="h-20 text-2xl font-bold bg-secondary hover:bg-secondary/80 rounded-2xl border-4 border-transparent focus:border-accent"
          >
            SESOTHO
          </Button>
        </div>
      </div>
    );
  }

  if (activeCall) {
    return (
      <CallScreen 
        contact={activeCall.contact} 
        onHangUp={handleHangUp} 
        language={selectedLanguage}
      />
    );
  }

  if (showContacts) {
    return (
      <ContactList 
        contacts={contacts} 
        onCall={handleContactCall} 
        onSms={handleContactSms}
        onBack={() => setShowContacts(false)}
        language={selectedLanguage}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-8 left-8 z-20">
        <Button
          variant="outline"
          size="lg"
          onClick={() => selectLanguage(null)}
          className="h-16 px-6 gap-3 text-xl font-bold rounded-2xl border-2 hover:bg-accent hover:text-accent-foreground border-primary/20 bg-background/50 backdrop-blur-sm shadow-lg group"
        >
          <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
          BACK
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <Blob state={appState} onClick={toggleListening} isSupported={isSupported} />
      </div>
      
      <div className="w-full max-w-lg grid grid-cols-2 gap-4 mb-32 px-4">
        <Button
          onClick={() => handleQuickAction('call')}
          className="flex flex-col h-28 gap-3 bg-secondary hover:bg-primary/20 border-2 border-primary/10 rounded-[2rem] group"
        >
          <Phone className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-bold text-base">CALL</span>
        </Button>
        <Button
          onClick={() => handleQuickAction('contacts')}
          className="flex flex-col h-28 gap-3 bg-secondary hover:bg-primary/20 border-2 border-primary/10 rounded-[2rem] group"
        >
          <Users className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-bold text-base">CONTACTS</span>
        </Button>
        <Button
          onClick={() => handleQuickAction('sms')}
          className="flex flex-col h-28 gap-3 bg-secondary hover:bg-primary/20 border-2 border-primary/10 rounded-[2rem] group"
        >
          <MessageSquare className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-bold text-base">SMS</span>
        </Button>
        <Button
          onClick={() => handleQuickAction('airtime')}
          className="flex flex-col h-28 gap-3 bg-secondary hover:bg-primary/20 border-2 border-primary/10 rounded-[2rem] group"
        >
          <CreditCard className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-bold text-base">AIRTIME</span>
        </Button>
      </div>

      <div className="fixed bottom-8 w-full max-w-lg px-8">
        <div className="bg-secondary/50 backdrop-blur-md rounded-2xl p-4 border border-border/50 shadow-2xl">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Status</p>
          <p className="text-foreground text-base font-medium truncate">
            {transcript ? `"${transcript}"` : "Ready for command"}
          </p>
        </div>
      </div>
    </div>
  );
};
