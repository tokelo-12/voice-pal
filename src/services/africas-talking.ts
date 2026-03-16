'use server';

/**
 * @fileOverview Service for interacting with the Africa's Talking Voice API.
 * This file handles the server-side logic for initiating real phone calls.
 */

export async function initiateAfricaTalkingCall(to: string) {
  const username = process.env.AFRICAS_TALKING_USERNAME || 'sandbox';
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;
  const from = process.env.AFRICAS_TALKING_FROM_NUMBER;

  if (!apiKey) {
    console.warn("AFRICAS_TALKING_API_KEY is not configured in .env. Skipping API call.");
    return { success: false, error: 'API Key not set' };
  }

  // Africa's Talking expects a POST with x-www-form-urlencoded
  const body = new URLSearchParams();
  body.append('username', username);
  body.append('to', to);
  if (from) {
    body.append('from', from);
  }

  try {
    const response = await fetch('https://voice.africastalking.com/call', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': apiKey,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Africa's Talking API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Africa\'s Talking Call Initiated:', data);
    return { success: true, data };
  } catch (error) {
    console.error("Africa's Talking Call Error:", error);
    return { success: false, error: 'Failed to initiate call via network' };
  }
}
