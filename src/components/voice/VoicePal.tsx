'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Blob, BlobState } from './Blob';
import { CallScreen } from './CallScreen';
import { ContactList, Contact } from './ContactList';
import { interpretVoiceCommand } from '@/ai/flows/interpret-voice-command-flow';
import { tts } from '@/ai/flows/tts-flow';
import { 
  initiateAfricaTalkingCall, 
  initiateAfricaTalkingSms, 
  initiateAfricaTalkingAirtime 
} from '@/services/africas-talking';
import { Button } from '@/components/ui/button';
import { Mic, ChevronLeft, Phone, MessageSquare, CreditCard, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type SupportedLanguage = 'en-US' | 'zu-ZA' | 'st-ZA';

const INITIAL_CONTACTS: Contact[] = [
  { id: '1', name: 'Mom', phoneNumber: '+27644914275' },
  { id: '2', name: 'Sindi', phoneNumber: '+27716828358' },
  { id: '3', name: 'Sello', phoneNumber: '0831234567' },
  { id: '4', name: 'Emergency', phoneNumber: '112' },
];

const SUCCESS_SOUND = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';
const ERROR_SOUND = 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg';

type PendingAction = {
  type: 'sms' | 'call' | 'airtime';
  phoneNumber?: string;
  contactName?: string;
  message?: string;
  amount?: number;
};

export const VoicePal: React.FC = () => {
  const [appState, setAppState] = useState<BlobState>('idle');
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [isListeningForLanguage, setIsListeningForLanguage] = useState(false);
  const [activeCall, setActiveCall] = useState<{ contact: string } | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [contacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [lastActionStatus, setLastActionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const feedbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasSpokenWelcome = useRef(false);
  
  const voiceCache = useRef<Map<string, string>>(new Map());

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
      feedbackAudioRef.current = new Audio();
    }
  }, []);

  const playFeedbackSound = useCallback((type: 'success' | 'error') => {
    if (!feedbackAudioRef.current) return;
    feedbackAudioRef.current.src = type === 'success' ? SUCCESS_SOUND : ERROR_SOUND;
    feedbackAudioRef.current.play().catch(e => console.warn('Feedback sound blocked', e));
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

  const speak = useCallback(async (text: string, lang: SupportedLanguage = 'en-US', autoListenAfter: boolean = false) => {
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

      const onSpeechEnd = () => {
        setAppState(prev => (prev !== 'success' && prev !== 'error' ? 'idle' : prev));
        if (autoListenAfter) {
          setTimeout(() => {
            if (recognitionRef.current) {
              setAppState('listening');
              setLastActionStatus('idle');
              recognitionRef.current.lang = lang;
              recognitionRef.current.start();
            }
          }, 300);
        }
      };

      if (audioUrl) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = onSpeechEnd;
        audioRef.current.onerror = () => {
          browserFallbackSpeak(text, lang);
          if (autoListenAfter) setTimeout(() => toggleListening(), 1000);
        };
        await audioRef.current.play().catch(() => {
          browserFallbackSpeak(text, lang);
          if (autoListenAfter) setTimeout(() => toggleListening(), 1000);
        });
      } else {
        browserFallbackSpeak(text, lang);
        if (autoListenAfter) setTimeout(() => toggleListening(), 2000);
      }
    } catch (error) {
      browserFallbackSpeak(text, lang);
      if (autoListenAfter) setTimeout(() => toggleListening(), 2000);
    }
  }, [browserFallbackSpeak]);

  const selectLanguage = useCallback((lang: SupportedLanguage | null) => {
    setSelectedLanguage(lang);
    setIsListeningForLanguage(false);
    setTranscript('');
    setActiveCall(null);
    setShowContacts(false);
    setLastActionStatus('idle');
    setPendingAction(null);
    
    if (lang) {
      let welcome = "";
      if (lang === 'en-US') welcome = "English selected. Welcome to Voice Pal. Tap the screen or press the space bar to give a command.";
      if (lang === 'zu-ZA') welcome = "isiZulu sikhethiwe. Siyakwamukela ku-Voice Pal. Thinta isikrini noma ucindezele i-space bar ukuze ukhulume.";
      if (lang === 'st-ZA') welcome = "Sesotho se khethiloe. Re u amohela ho Voice Pal. Tobetsa skrine kapa o tobetse space bar ho bua.";
      
      hasSpokenWelcome.current = true;
      setTimeout(() => speak(welcome, lang), 100);
    } else {
      hasSpokenWelcome.current = false;
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
        const text = event.results[0][0].transcript.toLowerCase();
        if (text.includes('english')) selectLanguage('en-US');
        else if (text.includes('zulu') || text.includes('isizulu')) selectLanguage('zu-ZA');
        else if (text.includes('sesotho') || text.includes('sotho')) selectLanguage('st-ZA');
        else {
          speak("I didn't catch that. Please say English, Zulu, or Sesotho.", "en-US");
        }
      };

      recognitionRef.current.onerror = () => setIsListeningForLanguage(false);
      recognitionRef.current.onend = () => setIsListeningForLanguage(false);
    } else {
      recognitionRef.current.stop();
    }
  }, [isSupported, isListeningForLanguage, selectLanguage, speak]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported || !selectedLanguage) return;

    if (appState === 'idle' || appState === 'error' || appState === 'success') {
      setAppState('listening');
      setLastActionStatus('idle');
      recognitionRef.current.lang = selectedLanguage;
      recognitionRef.current.start();
      
      recognitionRef.current.onresult = (event: any) => {
        const currentTranscript = event.results[0][0].transcript;
        setTranscript(currentTranscript);
        handleIntent(currentTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          let msg = "I didn't hear anything. Please try again.";
          if (selectedLanguage === 'zu-ZA') msg = "Angizwanga lutho. Sicela uzame futhi.";
          if (selectedLanguage === 'st-ZA') msg = "Ha ke a utloa letho. Ka kopo leka hape.";
          speak(msg, selectedLanguage);
        } else {
          setAppState('error');
          setLastActionStatus('error');
        }
      };

      recognitionRef.current.onend = () => {
        setAppState(prev => prev === 'listening' ? 'idle' : prev);
      };
    } else if (appState === 'listening') {
      recognitionRef.current.stop();
      setAppState('idle');
    }
  }, [appState, isSupported, selectedLanguage, speak]);

  const handleIntent = useCallback(async (text: string) => {
    if (!selectedLanguage) return;
    setAppState('processing');
    setLastActionStatus('idle');
    
    try {
      if (pendingAction) {
        if (pendingAction.type === 'sms' && pendingAction.phoneNumber && !pendingAction.message) {
          const smsResult = await initiateAfricaTalkingSms(pendingAction.phoneNumber, text);
          if (smsResult.success) {
            setAppState('success');
            setLastActionStatus('success');
            playFeedbackSound('success');
            setPendingAction(null);
            let msg = `Success! Message sent.`;
            if (selectedLanguage === 'zu-ZA') msg = `Kuphumelele! Umlayezo thunyelwe.`;
            if (selectedLanguage === 'st-ZA') msg = `Katleho! Molaetsa o rometsoe.`;
            speak(msg, selectedLanguage);
          } else {
            setAppState('error');
            setLastActionStatus('error');
            playFeedbackSound('error');
            setPendingAction(null);
            speak("Failed to send message.", selectedLanguage);
          }
          return;
        }

        if (pendingAction.type === 'airtime') {
          if (!pendingAction.amount) {
            const amount = parseFloat(text.replace(/[^0-9.]/g, ''));
            if (isNaN(amount)) {
              speak("I didn't get the amount. Please say a number.", selectedLanguage, true);
              return;
            }
            const airtimeResult = await initiateAfricaTalkingAirtime(pendingAction.phoneNumber || '+27644914275', amount);
            if (airtimeResult.success) {
              setAppState('success');
              setLastActionStatus('success');
              playFeedbackSound('success');
              setPendingAction(null);
              let msg = `Airtime of ${amount} Rands sent successfully.`;
              if (selectedLanguage === 'zu-ZA') msg = `I-airtime ka R${amount} ithunyelwe ngempumelelo.`;
              if (selectedLanguage === 'st-ZA') msg = `Airtime ea R${amount} e rometsoe ka katleho.`;
              speak(msg, selectedLanguage);
            } else {
              setAppState('error');
              setLastActionStatus('error');
              playFeedbackSound('error');
              setPendingAction(null);
              speak("Airtime purchase failed.", selectedLanguage);
            }
            return;
          }
        }
      }

      const result = await interpretVoiceCommand({ command: text });
      
      if (result.intent === 'make_call') {
        const contactName = result.details.contactName;
        const matchedContact = contacts.find(c => {
          const name = c.name.toLowerCase();
          const target = contactName?.toLowerCase() || '';
          return name === target || target.includes(name) || name.includes(target);
        });
        
        const phoneNumber = matchedContact?.phoneNumber || result.details.phoneNumber;
        const finalName = matchedContact?.name || contactName || "Unknown Contact";

        if (!phoneNumber) {
          setShowContacts(true);
          setPendingAction({ type: 'call' });
          let msg = "Who would you like to call?";
          if (selectedLanguage === 'zu-ZA') msg = "Ubani ofuna ukumshayela ucingo?";
          if (selectedLanguage === 'st-ZA') msg = "O batla ho letsetsa mang?";
          speak(msg, selectedLanguage, true);
        } else {
          let msg = `Certainly. Calling ${finalName} now.`;
          if (selectedLanguage === 'zu-ZA') msg = `Kulungile. Ngishayela u-${finalName} manje.`;
          if (selectedLanguage === 'st-ZA') msg = `Ho lokile. Ke letsetsa ${finalName} hona joale.`;
          
          speak(msg, selectedLanguage);
          setActiveCall({ contact: finalName });
          initiateAfricaTalkingCall(phoneNumber);
          setPendingAction(null);
        }
      } else if (result.intent === 'send_sms') {
        const contactName = result.details.contactName;
        const matchedContact = contacts.find(c => {
          const name = c.name.toLowerCase();
          const target = contactName?.toLowerCase() || '';
          return name === target || target.includes(name) || name.includes(target);
        });
        
        const phoneNumber = matchedContact?.phoneNumber || result.details.phoneNumber;
        const message = result.details.message;

        if (!phoneNumber) {
          setShowContacts(true);
          setPendingAction({ type: 'sms' });
          let msg = "Who would you like to message?";
          if (selectedLanguage === 'zu-ZA') msg = "Ubani ofuna ukumthumelela umlayezo?";
          if (selectedLanguage === 'st-ZA') msg = "O batla ho thumelela mang molaetsa?";
          speak(msg, selectedLanguage, true);
        } else if (!message) {
          setPendingAction({ type: 'sms', phoneNumber, contactName: matchedContact?.name || contactName });
          let msg = `What message would you like to send?`;
          if (selectedLanguage === 'zu-ZA') msg = `Ufuna ukuthumela muphi umlayezo?`;
          if (selectedLanguage === 'st-ZA') msg = `O batla ho thumela molaetsa ofe?`;
          speak(msg, selectedLanguage, true);
        } else {
          const smsResult = await initiateAfricaTalkingSms(phoneNumber, message);
          if (smsResult.success) {
            setAppState('success');
            setLastActionStatus('success');
            playFeedbackSound('success');
            setPendingAction(null);
            let msg = `Success! Message sent.`;
            if (selectedLanguage === 'zu-ZA') msg = `Kuphumelele! Umlayezo thunyelwe.`;
            if (selectedLanguage === 'st-ZA') msg = `Katleho! Molaetsa o rometsoe.`;
            speak(msg, selectedLanguage);
          } else {
            setAppState('error');
            setLastActionStatus('error');
            playFeedbackSound('error');
            setPendingAction(null);
            speak("Failed to send message.", selectedLanguage);
          }
        }
      } else if (result.intent === 'buy_airtime') {
        const amount = result.details.amount;
        const recipient = result.details.recipient;
        
        let phoneNumber = '+27644914275'; 
        if (recipient && recipient !== 'self') {
          const matchedContact = contacts.find(c => c.name.toLowerCase().includes(recipient.toLowerCase()));
          if (matchedContact) phoneNumber = matchedContact.phoneNumber;
        }

        if (!amount) {
          setPendingAction({ type: 'airtime', phoneNumber });
          let msg = "How much airtime would you like?";
          if (selectedLanguage === 'zu-ZA') msg = "Ufuna i-airtime engakanani?";
          if (selectedLanguage === 'st-ZA') msg = "O batla airtime e kae?";
          speak(msg, selectedLanguage, true);
        } else {
          const airtimeResult = await initiateAfricaTalkingAirtime(phoneNumber, amount);
          if (airtimeResult.success) {
            setAppState('success');
            setLastActionStatus('success');
            playFeedbackSound('success');
            setPendingAction(null);
            let msg = `Airtime of ${amount} Rands sent successfully.`;
            if (selectedLanguage === 'zu-ZA') msg = `I-airtime ka R${amount} ithunyelwe ngempumelelo.`;
            if (selectedLanguage === 'st-ZA') msg = `Airtime ea R${amount} e rometsoe ka katleho.`;
            speak(msg, selectedLanguage);
          } else {
            setAppState('error');
            setLastActionStatus('error');
            playFeedbackSound('error');
            setPendingAction(null);
            speak("Airtime purchase failed.", selectedLanguage);
          }
        }
      } else if (result.intent === 'change_language') {
        selectLanguage(null);
      } else {
        speak(result.reason || "I'm sorry, I didn't quite catch that. Could you repeat the command?", selectedLanguage, true);
      }
    } catch (error) {
      setAppState('error');
      setLastActionStatus('error');
      playFeedbackSound('error');
      speak("Error processing request.", selectedLanguage, true);
    }
  }, [selectedLanguage, speak, contacts, playFeedbackSound, pendingAction]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeCall) return;
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        if (!selectedLanguage) {
          toggleLanguageListening();
        } else {
          toggleListening();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLanguage, activeCall, toggleLanguageListening, toggleListening]);

  useEffect(() => {
    if (!selectedLanguage && isSupported && !hasSpokenWelcome.current) {
      const timer = setTimeout(() => {
        speak("Welcome to Voice Pal. Please say your language: English, Zulu, or Sesotho. Or tap the screen to select.", "en-US");
        hasSpokenWelcome.current = true;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedLanguage, isSupported, speak]);

  const handleQuickAction = (action: 'call' | 'sms' | 'airtime' | 'contacts') => {
    if (!selectedLanguage) return;

    if (action === 'call' || action === 'contacts') {
      setShowContacts(true);
      setPendingAction({ type: 'call' });
      let msg = "Showing your contacts.";
      if (selectedLanguage === 'zu-ZA') msg = "Ngibonisa oxhumana nabo.";
      if (selectedLanguage === 'st-ZA') msg = "Ke u bontša mabitso a hao.";
      speak(msg, selectedLanguage);
      return;
    }
    
    let prompt = "";
    if (action === 'sms') {
      setPendingAction({ type: 'sms' });
      if (selectedLanguage === 'en-US') prompt = "Who should I message?";
      else if (selectedLanguage === 'zu-ZA') prompt = "Ubani okufanele ngimthumelele umlayezo?";
      else prompt = "Ke thumele molaetsa ho mang?";
    } else if (action === 'airtime') {
      setPendingAction({ type: 'airtime' });
      if (selectedLanguage === 'en-US') prompt = "How much airtime would you like?";
      else if (selectedLanguage === 'zu-ZA') prompt = "Ufuna i-airtime engakanani?";
      else prompt = "O batla airtime e kae?";
    }
    speak(prompt, selectedLanguage, true);
  };

  const handleContactCall = (contact: Contact) => {
    let msg = `Calling ${contact.name}.`;
    if (selectedLanguage === 'zu-ZA') msg = `Ngishayela u-${contact.name}.`;
    if (selectedLanguage === 'st-ZA') msg = `Ke letsetsa ${contact.name}.`;
    speak(msg, selectedLanguage!);
    setActiveCall({ contact: contact.name });
    initiateAfricaTalkingCall(contact.phoneNumber);
    setPendingAction(null);
  };

  const handleContactSms = (contact: Contact) => {
    setPendingAction({ type: 'sms', phoneNumber: contact.phoneNumber, contactName: contact.name });
    let msg = `Say your message for ${contact.name}.`;
    if (selectedLanguage === 'zu-ZA') msg = `Khuluma umlayezo wakho we ${contact.name}.`;
    if (selectedLanguage === 'st-ZA') msg = `Bua molaetsa oa hau oa ${contact.name}.`;
    speak(msg, selectedLanguage!, true);
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
          aria-label={isListeningForLanguage ? "Listening for language" : "Tap to speak your language. You can also press Space bar."}
        >
          {isListeningForLanguage ? (
            <Mic className="w-20 h-20 text-primary animate-bounce" />
          ) : (
            <Mic className="w-20 h-20 text-background" />
          )}
        </button>
        <div className="grid grid-cols-1 w-full max-w-md gap-6">
          <Button onClick={() => selectLanguage('en-US')} className="h-20 text-2xl font-bold bg-secondary hover:bg-secondary/80 rounded-2xl border-4 border-transparent focus:border-accent">ENGLISH</Button>
          <Button onClick={() => selectLanguage('zu-ZA')} className="h-20 text-2xl font-bold bg-secondary hover:bg-secondary/80 rounded-2xl border-4 border-transparent focus:border-accent">ISIZULU</Button>
          <Button onClick={() => selectLanguage('st-ZA')} className="h-20 text-2xl font-bold bg-secondary hover:bg-secondary/80 rounded-2xl border-4 border-transparent focus:border-accent">SESOTHO</Button>
        </div>
      </div>
    );
  }

  if (activeCall) return <CallScreen contact={activeCall.contact} onHangUp={handleHangUp} language={selectedLanguage} />;
  if (showContacts) return <ContactList contacts={contacts} onCall={handleContactCall} onSms={handleContactSms} onBack={() => setShowContacts(false)} language={selectedLanguage} onMicClick={toggleListening} micState={appState} />;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-8 left-8 z-20">
        <Button variant="outline" size="lg" onClick={() => selectLanguage(null)} className="h-16 px-6 gap-3 text-xl font-bold rounded-2xl border-2 hover:bg-accent hover:text-accent-foreground border-primary/20 bg-background/50 backdrop-blur-sm shadow-lg group">
          <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
          BACK
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <Blob state={appState} onClick={toggleListening} isSupported={isSupported} />
      </div>

      {/* Moved Status Bar into the main flow between Blob and Buttons */}
      <div className="w-full max-w-lg px-8 mb-6 mt-2">
        <div className={cn(
          "backdrop-blur-md rounded-2xl p-4 border transition-all duration-500 shadow-2xl",
          lastActionStatus === 'success' ? "bg-green-500/10 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.4)]" : 
          lastActionStatus === 'error' ? "bg-red-500/10 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]" : 
          "bg-secondary/50 border-border/50"
        )}>
          <p className={cn(
            "text-xs font-semibold uppercase tracking-widest mb-1 transition-colors duration-500",
            lastActionStatus === 'success' ? "text-green-400" : 
            lastActionStatus === 'error' ? "text-red-400" : 
            "text-accent"
          )}>
            {lastActionStatus === 'success' ? 'Success' : lastActionStatus === 'error' ? 'Failure' : 'Status'}
          </p>
          <p className="text-foreground text-base font-medium truncate">
            {transcript ? `"${transcript}"` : lastActionStatus === 'success' ? "Action complete!" : lastActionStatus === 'error' ? "Action failed" : "Ready for command"}
          </p>
        </div>
      </div>

      <div className="w-full max-w-lg grid grid-cols-2 gap-4 mb-12 px-4">
        <Button onClick={() => handleQuickAction('call')} className="flex flex-col h-28 gap-3 bg-secondary hover:bg-primary/20 border-2 border-primary/10 rounded-[2rem] group">
          <Phone className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-bold text-base uppercase">{selectedLanguage === 'zu-ZA' ? 'SHAYELA' : selectedLanguage === 'st-ZA' ? 'LETSA' : 'CALL'}</span>
        </Button>
        <Button onClick={() => handleQuickAction('contacts')} className="flex flex-col h-28 gap-3 bg-secondary hover:bg-primary/20 border-2 border-primary/10 rounded-[2rem] group">
          <Users className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-bold text-base uppercase">{selectedLanguage === 'zu-ZA' ? 'OXHUMANA' : selectedLanguage === 'st-ZA' ? 'MABITSO' : 'CONTACTS'}</span>
        </Button>
        <Button onClick={() => handleQuickAction('sms')} className="flex flex-col h-28 gap-3 bg-secondary hover:bg-primary/20 border-2 border-primary/10 rounded-[2rem] group">
          <MessageSquare className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-bold text-base uppercase">SMS</span>
        </Button>
        <Button onClick={() => handleQuickAction('airtime')} className="flex flex-col h-28 gap-3 bg-secondary hover:bg-primary/20 border-2 border-primary/10 rounded-[2rem] group">
          <CreditCard className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-bold text-base uppercase">AIRTIME</span>
        </Button>
      </div>
    </div>
  );
};