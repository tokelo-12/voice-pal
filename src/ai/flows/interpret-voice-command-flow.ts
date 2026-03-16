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

Intents:
- 'make_call': Triggered by keywords like "call", "phone", "letsa" (Sesotho), "shayela" (Zulu), "fona" (Zulu).
- 'send_sms': Triggered by "message", "sms", "text", "molaetsa" (Sesotho), "umyalezo" (Zulu), "thumela" (Zulu/Sesotho).
- 'buy_airtime': Triggered by "airtime", "data", "reka" (Sesotho), "thenga" (Zulu).
- 'change_language': Triggered by "change language", "go back", "fetola puo" (Sesotho), "shintsha ulimi" (Zulu).
- 'unknown': If you can't tell.

Details extraction:
- 'make_call': extract 'phoneNumber' or 'contactName'. If the user says "call me", use "+27218796297".
- 'send_sms': extract 'phoneNumber'/'contactName' and 'message'.
- 'buy_airtime': extract 'amount' (number) and 'recipient'.

Examples:
- "Ngifuna ukushayela uSello" -> {"intent": "make_call", "details": {"contactName": "Sello"}}
- "Thumela umyalezo" -> {"intent": "send_sms", "details": {}}
- "Reka airtime ea mashome a mabeli" -> {"intent": "buy_airtime", "details": {"amount": 20}}
- "Letsetsa Mom" -> {"intent": "make_call", "details": {"contactName": "Mom"}}

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
