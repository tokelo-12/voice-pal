'use server';

/**
 * @fileOverview Service for interacting with the Africa's Talking API (Voice, SMS, and Airtime).
 * This file handles the server-side logic for initiating phone calls, sending SMS, and sending airtime.
 */

export async function initiateAfricaTalkingCall(to: string) {
  const username = process.env.AFRICAS_TALKING_USERNAME || 'sandbox';
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;
  const from = process.env.AFRICAS_TALKING_FROM_NUMBER;

  if (!apiKey) {
    console.warn("AFRICAS_TALKING_API_KEY is not configured in .env. Skipping API call.");
    return { success: false, error: 'API Key not set' };
  }

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
    const smsData = data.SMSMessageData;
    
    if (!smsData) {
      throw new Error("Invalid response structure from Africa's Talking SMS API");
    }

    const failures = smsData.Recipients?.filter((r: any) => r.statusCode !== 101 && r.status !== 'Success');

    if (failures && failures.length > 0) {
      console.warn("Some SMS recipients failed:", failures);
    }

    console.log('Africa\'s Talking SMS Sent Summary:', smsData.Message);
    return { success: true, data: smsData };
  } catch (error) {
    console.error("Africa's Talking SMS Exception:", error);
    return { success: false, error: 'Failed to send SMS' };
  }
}

/**
 * Sends Airtime using Africa's Talking Airtime API.
 */
export async function initiateAfricaTalkingAirtime(phoneNumber: string, amount: number, currency: string = 'ZAR') {
  const username = process.env.AFRICAS_TALKING_USERNAME || 'sandbox';
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;

  if (!apiKey) {
    console.warn("AFRICAS_TALKING_API_KEY is not configured. Skipping Airtime.");
    return { success: false, error: 'API Key not set' };
  }

  // Format amount as string like "ZAR 10.00"
  const formattedAmount = `${currency} ${amount.toFixed(2)}`;

  try {
    const response = await fetch('https://api.africastalking.com/version1/airtime/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'apiKey': apiKey,
        'Idempotency-Key': `airtime-${Date.now()}-${phoneNumber}`,
      },
      body: JSON.stringify({
        username,
        recipients: [
          {
            phoneNumber,
            amount: formattedAmount,
          },
        ],
        maxNumRetry: 2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Africa's Talking Airtime API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    /**
     * Expected structure:
     * {
     *   "errorMessage": "None",
     *   "numSent": 1,
     *   "totalAmount": "ZAR 10.0000",
     *   "totalDiscount": "ZAR 0.4000",
     *   "responses": [...]
     * }
     */
    if (data.errorMessage && data.errorMessage !== 'None') {
      return { success: false, error: data.errorMessage };
    }

    const firstResponse = data.responses?.[0];
    if (firstResponse && firstResponse.status !== 'Sent' && firstResponse.status !== 'Success') {
      return { success: false, error: firstResponse.errorMessage || 'Failed to send airtime' };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Africa's Talking Airtime Exception:", error);
    return { success: false, error: 'Failed to send airtime' };
  }
}
