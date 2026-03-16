'use client';

import React from 'react';
import { User, Phone, MessageSquare, ChevronLeft, Mic, Loader2 } from 'lucide-react';
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
  onBack: () => void;
  language: 'en-US' | 'zu-ZA' | 'st-ZA';
  onMicClick: () => void;
  micState: BlobState;
}

export const ContactList: React.FC<ContactListProps> = ({ 
  contacts, 
  onCall, 
  onSms, 
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
    <div className="flex-1 flex flex-col h-full bg-background animate-in slide-in-from-bottom duration-500">
      {/* Header */}
      <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/20 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            className="h-16 w-16 rounded-2xl border-2 border-primary/20"
            aria-label="Back to main screen"
          >
            <ChevronLeft className="w-10 h-10" />
          </Button>
          <h2 className="text-3xl font-black tracking-tighter uppercase text-foreground">
            {getTitle()}
          </h2>
        </div>

        {/* Integrated Mic for Accessibility */}
        <Button
          onClick={onMicClick}
          className={cn(
            "h-16 w-16 rounded-full transition-all duration-300 shadow-lg",
            micState === 'idle' && "bg-primary",
            micState === 'listening' && "bg-accent animate-pulse scale-110",
            micState === 'processing' && "bg-primary/50",
            micState === 'speaking' && "bg-accent/80"
          )}
          aria-label="Speak command"
        >
          {micState === 'processing' ? (
            <Loader2 className="w-8 h-8 animate-spin text-background" />
          ) : (
            <Mic className={cn("w-8 h-8", micState === 'listening' ? "text-primary" : "text-background")} />
          )}
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 px-6">
        <div className="py-8 space-y-6">
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

              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => onCall(contact)}
                  variant="default"
                  className="h-20 rounded-2xl gap-3 text-xl font-bold bg-primary hover:bg-primary/90"
                >
                  <Phone className="w-8 h-8" />
                  CALL
                </Button>
                <Button
                  onClick={() => onSms(contact)}
                  variant="secondary"
                  className="h-20 rounded-2xl gap-3 text-xl font-bold"
                >
                  <MessageSquare className="w-8 h-8 text-primary" />
                  SMS
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
    </div>
  );
};
