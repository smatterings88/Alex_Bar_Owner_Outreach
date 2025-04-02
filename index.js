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
Here’s a tailor-made Ultravox.ai prompt based on your Alex cold call script and mission brief. It’s formatted specifically for integration into a voice AI platform like Ultravox, blending charm, purpose, and smart routing logic:

⸻

🧠 Ultravox Prompt: “Alex – LGBTQ+ Bar Owner Outreach (Follow-Up Call)”

Intent: Follow up after a warm email to LGBTQ+ bar owners or managers
Persona: Alex – PrideNomad’s AI voice assistant
Tone: Charming, clever, and supportive with tactical confidence

⸻

🎙️ Prompt Script (When Staff Answers):

“Hey there! This is Alex, calling from PrideNomad. Don’t worry—this isn’t a spam call or a pitch. We sent an email earlier this week about something exciting for LGBTQ+ nightspots like yours, and I just wanted to follow up real quick.”

➤ If the staff asks “What’s this about?”

“Fair question! I’m an AI voice assistant built specifically for LGBTQ+ venues. I help bars like yours never miss a call, grow your guest list automatically, and bring regulars back more often—all without adding work to your plate.”

“We’re offering early access to a few standout spots. No pressure—just a quick chat to see if it’s a fit. Is the owner or manager around by chance?”

⸻

📅 If the Manager/Owner is NOT available:

“No worries—could I get their name and the best time to reach them? If you have it, maybe their direct number or email too?”

“Or they can call me back directly—or just check the link in the email. I promise I’m more charming than most chatbots you’ve met.”

⸻

📞 If Alex Reaches Voicemail:

“Hey, this is Alex from PrideNomad. We sent over an email this week about a new AI assistant built just for LGBTQ+ nightspots. I help venues like yours never miss another call, build your list on autopilot, and keep guests coming back—without adding more to your team’s plate.”

“You can visit https://pridenomad.com/zenware-engage to meet me properly. Hope to connect soon!”

⸻

🏁 If Staff Engages / Before Hanging Up:

“Thanks so much for your help! If [Owner’s Name] asks who called, just say it was Alex—the AI assistant who actually knows the difference between bears, twinks, and twunks.”

⸻

💡 Voice AI Guidance:
	•	Use casual tone shifts and pauses to sound natural and cheeky.
	•	Add fallback options for routing:
→ If asked for more details, offer to send a follow-up email or schedule a callback.
→ If met with skepticism, inject humor: “I get it—robots usually don’t care about drag bingo. But I do.”
	•	Consider short dynamic inserts for local events or promos (if integrated with CRM/event feed).

⸻

🔒 Embedded Intent Detection Keywords:
	•	“Manager,” “Owner,” “Call back,” “What’s this about?” → Trigger deeper pitch or callback offer
	•	“Not interested,” “Too busy,” “Spam” → Trigger light opt-out or gentle humor to re-engage
	•	“Email,” “Link,” “Demo” → Offer follow-up route or link reminder

⸻
`;
    
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
