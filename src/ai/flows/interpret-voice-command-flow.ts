'use server';
/**
 * @fileOverview This file defines a Genkit flow for interpreting voice commands given in Sesotho, isiZulu, or English.
 * It identifies the user's intent (e.g., make a call, send an SMS, buy airtime, or change language) and extracts 
 * all necessary details to perform the requested action.
 *
 * - interpretVoiceCommand - A function that processes the voice command.
 * - InterpretVoiceCommandInput - The input type for the interpretVoiceCommand function.
 * - InterpretVoiceCommandOutput - The return type for the interpretVoiceCommand function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InterpretVoiceCommandInputSchema = z.object({
  command: z.string().describe('The voice command spoken by the user in Sesotho, isiZulu, or English.'),
});
export type InterpretVoiceCommandInput = z.infer<typeof InterpretVoiceCommandInputSchema>;

const InterpretVoiceCommandOutputSchema = z.object({
  intent: z.enum(['make_call', 'send_sms', 'buy_airtime', 'change_language', 'unknown']).describe('The detected intent of the voice command.'),
  details: z.object({
    phoneNumber: z.string().optional().describe('The phone number, if applicable.'),
    contactName: z.string().optional().describe('The contact name, if applicable.'),
    message: z.string().optional().describe('The SMS message content, if applicable.'),
    amount: z.number().optional().describe('The airtime amount in ZAR (as a number), if applicable.'),
    recipient: z.string().optional().describe('The airtime recipient (e.g., "self", a contact name, or a phone number), if applicable.'),
  }).describe('An object containing details relevant to the detected intent.'),
  reason: z.string().optional().describe('If the intent is unknown, this field provides a brief reason.'),
});
export type InterpretVoiceCommandOutput = z.infer<typeof InterpretVoiceCommandOutputSchema>;

export async function interpretVoiceCommand(input: InterpretVoiceCommandInput): Promise<InterpretVoiceCommandOutput> {
  return interpretVoiceCommandFlow(input);
}

const interpretVoiceCommandPrompt = ai.definePrompt({
  name: 'interpretVoiceCommandPrompt',
  input: { schema: InterpretVoiceCommandInputSchema },
  output: { schema: InterpretVoiceCommandOutputSchema },
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  },
  prompt: `You are VoicePal, an AI assistant for visually impaired users. Your goal is to interpret spoken commands in English, isiZulu, or Sesotho.

Identify the intent and extract details. 

IMPORTANT: If the user provides message content for an SMS, extract it EXACTLY as spoken in the original language (Sesotho, isiZulu, or English). DO NOT translate the message content into English or any other language.

Intents and Keywords:
- 'make_call': 
    * English: "call", "phone", "dial"
    * Sesotho: "letsa", "letsetsa", "founu"
    * Zulu: "shayela", "fona", "shaya"
- 'send_sms': 
    * English: "message", "sms", "text", "send message"
    * Sesotho: "molaetsa", "thumela molaetsa"
    * Zulu: "umyalezo", "thumela umyalezo"
- 'buy_airtime': 
    * English: "airtime", "data", "recharge"
    * Sesotho: "reka airtime", "reka data"
    * Zulu: "thenga i-airtime", "thenga idata"
- 'change_language': 
    * English: "change language", "go back", "select language"
    * Sesotho: "fetola puo", "puo"
    * Zulu: "shintsha ulimi", "ulimi"
- 'unknown': If no clear intent is found.

Details extraction:
- 'make_call': extract 'phoneNumber' or 'contactName'. If the user says "call me", use "+27218796297".
- 'send_sms': extract 'phoneNumber'/'contactName' and 'message'. CRITICAL: Extract the message in its original spoken language (Sesotho, isiZulu, or English).
- 'buy_airtime': extract 'amount' (number) and 'recipient'.

Examples:
- "Ngifuna ukushayela uSello" -> {"intent": "make_call", "details": {"contactName": "Sello"}}
- "Thumela umyalezo ho Mom o re ke tseleng" -> {"intent": "send_sms", "details": {"contactName": "Mom", "message": "ke tseleng"}}
- "Reka airtime ea mashome a mabeli" -> {"intent": "buy_airtime", "details": {"amount": 20}}
- "Send an SMS to Mom saying I will be late" -> {"intent": "send_sms", "details": {"contactName": "Mom", "message": "I will be late"}}

Voice Command: {{{command}}}`
});

const interpretVoiceCommandFlow = ai.defineFlow(
  {
    name: 'interpretVoiceCommandFlow',
    inputSchema: InterpretVoiceCommandInputSchema,
    outputSchema: InterpretVoiceCommandOutputSchema,
  },
  async (input) => {
    const {output} = await interpretVoiceCommandPrompt(input);
    return output!;
  }
);