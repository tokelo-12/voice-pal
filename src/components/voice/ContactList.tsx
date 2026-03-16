'use client';

import React from 'react';
import { User, Phone, MessageSquare, ChevronLeft, Mic, Loader2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { BlobState } from './Blob';

export interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
}

interface ContactListProps {
  contacts: Contact[];
  onCall: (contact: Contact) => void;
  onSms: (contact: Contact) => void;
  onAirtime: (contact: Contact) => void;
  onBack: () => void;
  language: 'en-US' | 'zu-ZA' | 'st-ZA';
  onMicClick: () => void;
  micState: BlobState;
}

export const ContactList: React.FC<ContactListProps> = ({ 
  contacts, 
  onCall, 
  onSms, 
  onAirtime,
  onBack,
  language,
  onMicClick,
  micState
}) => {
  const getTitle = () => {
    if (language === 'zu-ZA') return "OXHUMANA NABO";
    if (language === 'st-ZA') return "MABITSO";
    return "CONTACTS";
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background animate-in slide-in-from-bottom duration-500 relative">
      {/* Header */}
      <div className="p-6 border-b border-border/50 flex items-center bg-secondary/20 backdrop-blur-md sticky top-0 z-20">
        <Button
          variant="outline"
          size="icon"
          onClick={onBack}
          className="h-16 w-16 rounded-2xl border-2 border-primary/20"
          aria-label="Back to main screen"
        >
          <ChevronLeft className="w-10 h-10" />
        </Button>
        <h2 className="ml-6 text-3xl font-black tracking-tighter uppercase text-foreground">
          {getTitle()}
        </h2>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 px-6">
        <div className="py-8 pb-48 space-y-6">
          {contacts.map((contact) => (
            <div 
              key={contact.id}
              className="bg-secondary/40 border border-border/50 p-6 rounded-[2rem] flex flex-col gap-6 shadow-sm hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <User className="w-10 h-10 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-2xl font-bold text-foreground truncate uppercase tracking-tight">
                    {contact.name}
                  </p>
                  <p className="text-muted-foreground font-mono text-lg">
                    {contact.phoneNumber}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => onCall(contact)}
                    variant="default"
                    className="h-20 rounded-2xl gap-3 text-xl font-bold bg-primary hover:bg-primary/90 shadow-lg"
                  >
                    <Phone className="w-8 h-8" />
                    CALL
                  </Button>
                  <Button
                    onClick={() => onSms(contact)}
                    variant="secondary"
                    className="h-20 rounded-2xl gap-3 text-xl font-bold shadow-md"
                  >
                    <MessageSquare className="w-8 h-8 text-primary" />
                    SMS
                  </Button>
                </div>
                <Button
                  onClick={() => onAirtime(contact)}
                  variant="outline"
                  className="h-20 rounded-2xl gap-3 text-xl font-bold border-2 border-primary/20 hover:bg-primary/10"
                >
                  <CreditCard className="w-8 h-8 text-primary" />
                  {language === 'zu-ZA' ? 'THENGA AIRTIME' : language === 'st-ZA' ? 'REKA AIRTIME' : 'BUY AIRTIME'}
                </Button>
              </div>
            </div>
          ))}
          
          {contacts.length === 0 && (
            <div className="text-center py-20 opacity-50">
              <User className="w-20 h-20 mx-auto mb-4 opacity-20" />
              <p className="text-xl font-bold">No contacts found</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Mic FAB */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <Button
            onClick={onMicClick}
            className={cn(
              "h-32 w-32 rounded-full transition-all duration-500 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border-4",
              micState === 'idle' && "bg-primary border-primary/50 animate-blob-pulse blob-shadow",
              micState === 'listening' && "bg-accent border-accent/50 animate-blob-listen blob-shadow-accent scale-110",
              micState === 'processing' && "bg-primary/70 border-primary/20 animate-blob-process",
              micState === 'speaking' && "bg-accent/80 border-accent/30 animate-blob-pulse blob-shadow-accent",
              micState === 'error' && "bg-destructive border-destructive/50"
            )}
            aria-label="Speak voice command"
          >
            {micState === 'processing' ? (
              <Loader2 className="w-16 h-16 animate-spin text-background" />
            ) : (
              <Mic className={cn("w-16 h-16", micState === 'listening' ? "text-primary" : "text-background")} />
            )}
          </Button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-20" />
    </div>
  );
};
