'use client';

import React from 'react';
import { PhoneOff, User, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CallScreenProps {
  contact: string;
  onHangUp: () => void;
  language: 'en-US' | 'zu-ZA' | 'st-ZA';
}

export const CallScreen: React.FC<CallScreenProps> = ({ contact, onHangUp, language }) => {
  const getStatusText = () => {
    if (language === 'zu-ZA') return "Iyashaya...";
    if (language === 'st-ZA') return "Ea letsetsa...";
    return "Calling...";
  };

  const getHangUpText = () => {
    if (language === 'zu-ZA') return "VALA";
    if (language === 'st-ZA') return "KHAOLA";
    return "HANG UP";
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-8 bg-background animate-in fade-in duration-500">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 w-full">
        {/* Contact Avatar Area */}
        <div className="relative">
          <div className="w-48 h-48 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <User className="w-24 h-24 text-primary" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-accent rounded-full flex items-center justify-center border-4 border-background">
            <Phone className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Contact Details */}
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-extrabold text-foreground tracking-tight uppercase break-all">
            {contact || "Unknown"}
          </h2>
          <p className="text-2xl font-bold text-accent animate-pulse">
            {getStatusText()}
          </p>
        </div>
      </div>

      {/* Hang Up Button - Large and Accessible */}
      <div className="w-full max-w-md pb-12">
        <Button
          onClick={onHangUp}
          variant="destructive"
          className="w-full h-32 rounded-3xl flex flex-col gap-2 shadow-2xl hover:scale-105 transition-transform"
          aria-label="Hang up call"
        >
          <PhoneOff className="w-12 h-12" />
          <span className="text-2xl font-black tracking-widest">{getHangUpText()}</span>
        </Button>
      </div>
    </div>
  );
};
