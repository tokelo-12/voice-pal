'use server';

/**
 * @fileOverview Service for interacting with the Africa's Talking API (Voice and SMS).
 * This file handles the server-side logic for initiating phone calls and sending SMS messages.
 */

export async function initiateAfricaTalkingCall(to: string) {
  const username = process.env.AFRICAS_TALKING_USERNAME || 'sandbox';
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;
  const from = process.env.AFRICAS_TALKING_FROM_NUMBER;

  if (!apiKey) {
    console.warn("AFRICAS_TALKING_API_KEY is not configured in .env. Skipping API call.");
    return { success: false, error: 'API Key not set' };
  }

  // Africa's Talking expects a POST with x-www-form-urlencoded for the Voice API
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
      throw new Error(`Africa's Talking Voice API Network Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Handle the specific response format: { entries: [...], errorMessage: "None" }
    if (data.errorMessage && data.errorMessage !== 'None' && data.errorMessage !== '') {
      console.error("Africa's Talking Business Error:", data.errorMessage);
      return { success: false, error: data.errorMessage };
    }

    console.log('Africa\'s Talking Call Initiated Successfully:', data.entries);
    return { success: true, entries: data.entries };
  } catch (error) {
    console.error("Africa's Talking Call Exception:", error);
    return { success: false, error: 'Failed to connect to Africa\'s Talking service' };
  }
}

/**
 * Sends an SMS message using Africa's Talking Bulk Messaging API.
 */
export async function initiateAfricaTalkingSms(to: string | string[], message: string) {
  const username = process.env.AFRICAS_TALKING_USERNAME || 'sandbox';
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;
  const senderId = process.env.AFRICAS_TALKING_SENDER_ID;

  if (!apiKey) {
    console.warn("AFRICAS_TALKING_API_KEY is not configured. Skipping SMS.");
    return { success: false, error: 'API Key not set' };
  }

  const phoneNumbers = Array.isArray(to) ? to : [to];

  try {
    const response = await fetch('https://api.africastalking.com/version1/messaging/bulk', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'apiKey': apiKey,
      },
      body: JSON.stringify({
        username,
        message,
        phoneNumbers,
        ...(senderId ? { senderId } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Africa's Talking SMS API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    /**
     * Expected response format:
     * {
     *   "SMSMessageData": {
     *     "Message": "Sent to 1/1 Total Cost: KES 0.8000",
     *     "Recipients": [{
     *       "statusCode": 101,
     *       "number": "+254711XXXYYY",
     *       "status": "Success",
     *       "cost": "KES 0.8000",
     *       "messageId": "..."
     *     }]
     *   }
     * }
     */
    const smsData = data.SMSMessageData;
    
    if (!smsData) {
      throw new Error("Invalid response structure from Africa's Talking SMS API");
    }

    // Check for failures in recipients (101 is Success code for AT)
    const failures = smsData.Recipients?.filter((r: any) => r.statusCode !== 101 && r.status !== 'Success');

    if (failures && failures.length > 0) {
      console.warn("Some SMS recipients failed:", failures);
      // Even if some failed, we might have partial success. 
      // For this MVP, we log and return the data.
    }

    console.log('Africa\'s Talking SMS Sent Summary:', smsData.Message);
    return { success: true, data: smsData };
  } catch (error) {
    console.error("Africa's Talking SMS Exception:", error);
    return { success: false, error: 'Failed to send SMS' };
  }
}
