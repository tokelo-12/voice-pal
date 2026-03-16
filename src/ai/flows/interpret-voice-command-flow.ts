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
  prompt: `You are VoicePal, an AI assistant for visually impaired users. Your primary goal is to accurately interpret spoken voice commands, given in Sesotho, isiZulu, or English, and extract the user's intended action along with all relevant details. Provide a JSON response conforming to the provided schema.

The possible intents are:
- 'make_call': The user wants to initiate a phone call.
- 'send_sms': The user wants to send an SMS message.
- 'buy_airtime': The user wants to purchase airtime.
- 'change_language': The user wants to go back to the language selection screen or change their language. Examples: "change language", "go back", "fetola puo", "khutlela morao", "shintsha ulimi", "buyela emuva".
- 'unknown': The intent cannot be understood or does not fit the above categories.

When the intent is 'make_call', populate 'phoneNumber' and/or 'contactName' in the 'details' object. 
IMPORTANT: For testing purposes, if the user asks to "call me", "call my number", or similar, use the testing phone number: +27218796297.

When the intent is 'send_sms', populate 'phoneNumber' and/or 'contactName', and the 'message' content in the 'details' object.
When the intent is 'buy_airtime', populate the 'amount' (as a number, e.g., 50 for R50) and the 'recipient' (e.g., 'self', a contact name, or a phone number) in the 'details' object.
If the intent is 'unknown', include a brief 'reason' why the command could not be processed.

Examples:
- "Ke kopa ho letsetsa Sello ka nomoro 0831234567" -> {"intent": "make_call", "details": {"contactName": "Sello", "phoneNumber": "0831234567"}}
- "Call my number" -> {"intent": "make_call", "details": {"contactName": "My Number", "phoneNumber": "+27218796297"}}
- "Thumela umyalezo kuNomusa othi 'Sawubona Nomusa, unjani?'" -> {"intent": "send_sms", "details": {"contactName": "Nomusa", "message": "Sawubona Nomusa, unjani?"}}
- "Buy R50 airtime for myself." -> {"intent": "buy_airtime", "details": {"amount": 50, "recipient": "self"}}
- "Fetola puo" -> {"intent": "change_language", "details": {}}
- "Shintsha ulimi" -> {"intent": "change_language", "details": {}}

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
