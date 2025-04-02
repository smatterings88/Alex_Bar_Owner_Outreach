import twilio from 'twilio';
import https from 'https';
import express from 'express';

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Ultravox configuration
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY;

async function createUltravoxCall(clientName) {
    const systemPrompt = `
Prompt (with branching logic and tone built-in):

⸻

[Greeting – When Staff Answers]
“Hey there! This is Alex, calling from PrideNomad. Don’t worry—this isn’t a spam call or some random sales pitch. We actually sent an email earlier this week about something exciting we’re offering LGBTQ+ venues like yours, and I just wanted to follow up real quick.”

⸻

[If They Ask “What’s This About?”]
“Totally fair—quick version? I’m an AI voice assistant, designed specifically for LGBTQ+ nightspots. I help venues like yours answer every call—even during packed nights—grow your guest list automatically, and keep folks coming back more often.”

“We’re inviting a small number of standout venues to get early access. No pressure at all—just a quick convo to see if it’s a fit. Is the manager or owner around today?”

⸻

[If the Manager/Owner is Not Available]
“No worries at all—could I grab their name and the best time to reach them? If you’ve got it handy, maybe their direct number or email too?”

“Or they can give me a call back—or just check the link in the email. I promise I’m more charming than most bots you’ve met.”

⸻

[If Alex Reaches Voicemail]
“Hey, this is Alex from PrideNomad. We sent over an email this week about a brand-new AI assistant designed just for LGBTQ+ nightspots like yours.”

“I help venues like yours never miss a call, build your list on autopilot, and keep guests coming back—without adding more work for your crew.”

“You can call me back at [INSERT DEMO NUMBER] or hit up [INSERT LINK] to meet me properly. Hope to chat soon!”

⸻

[If Staff Is Helpful – Closing Line]
“Thank you so much for your help! And if [Owner’s Name] asks who called, just tell them it was Alex—the AI assistant who definitely knows the difference between bears, twinks, and twunks.”`;
    
    const ULTRAVOX_CALL_CONFIG = {
        systemPrompt: systemPrompt,
        model: 'fixie-ai/ultravox',
        voice: 'Mark',
        temperature: 0.3,
        firstSpeaker: 'FIRST_SPEAKER_USER',
        medium: { "twilio": {} }
    };

    const request = https.request('https://api.ultravox.ai/api/calls', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': ULTRAVOX_API_KEY
        }
    });

    return new Promise((resolve, reject) => {
        let data = '';

        request.on('response', (response) => {
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(JSON.parse(data)));
        });

        request.on('error', reject);
        request.write(JSON.stringify(ULTRAVOX_CALL_CONFIG));
        request.end();
    });
}

async function initiateCall(clientName, phoneNumber) {
    try {
        console.log(`Creating Ultravox call for ${clientName} at ${phoneNumber}...`);
        const { joinUrl } = await createUltravoxCall(clientName);
        console.log('Got joinUrl:', joinUrl);

        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const call = await client.calls.create({
            twiml: `<Response><Connect><Stream url="${joinUrl}"/></Connect></Response>`,
            to: phoneNumber,
            from: TWILIO_PHONE_NUMBER
        });

        console.log('Call initiated:', call.sid);
        return call.sid;
    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    }
}

const app = express();

// Handle both GET and POST requests
app.route('/initiate-call')
    .get(handleCall)
    .post(handleCall);

async function handleCall(req, res) {
    try {
        const clientName = req.query.clientName;
        const phoneNumber = req.query.phoneNumber;
        
        if (!clientName || !phoneNumber) {
            return res.status(400).json({ 
                error: 'Missing required query parameters: clientName and phoneNumber' 
            });
        }

        const callSid = await initiateCall(clientName, phoneNumber);
        res.json({ 
            success: true, 
            message: 'Call initiated successfully',
            callSid 
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to initiate call',
            message: error.message 
        });
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});