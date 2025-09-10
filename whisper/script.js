// --- DOM Elements ---
const recordToggleButton = document.getElementById('recordToggleButton');
const outputDiv = document.getElementById('output');
const statusDiv = document.getElementById('status');

// --- Constants & Configuration ---
// DANGER: Do NOT expose your API key in client-side code.
// This is for demonstration purposes only. In a real application,
// this request should be sent from a server-side backend.
const API_KEY_PLACEHOLDER = "YOUR_GEMINI_API_KEY";
const apiKeys = [
    "AIzaSyAymbB23KPZLnkNbyq6QdNj142qveCq-vs", // Primary
    "AIzaSyAcJ2ZHlmjzuNwbkah8uy9dPvOm-DCGUeI", // Secondary
    "AIzaSyAyXSdRlIvZUZNzuQnkxEYo-NVoM3JdqAU"  // Tertiary
];
const MODEL_NAME = "gemini-2.5-pro";
const AUDIO_MIME_TYPE = 'audio/webm';

// --- State ---
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentApiKeyIndex = 0;

// --- UI State Management ---
function setUIState(state) {
    // Reset classes on elements that change
    statusDiv.className = '';
    recordToggleButton.classList.remove('is-recording', 'is-processing');

    switch (state) {
        case 'idle':
            recordToggleButton.disabled = false;
            recordToggleButton.setAttribute('aria-label', 'Start Recording');
            statusDiv.textContent = 'Click the button to start recording.';
            outputDiv.classList.remove('visible');
            break;
        case 'recording':
            recordToggleButton.disabled = false; // Clickable to stop
            recordToggleButton.classList.add('is-recording');
            recordToggleButton.setAttribute('aria-label', 'Stop Recording');
            statusDiv.textContent = "Recording... Click the button to stop.";
            outputDiv.textContent = ""; // Clear previous results
            outputDiv.classList.remove('visible');
            break;
        case 'processing':
            recordToggleButton.disabled = true;
            recordToggleButton.classList.add('is-processing');
            recordToggleButton.setAttribute('aria-label', 'Processing');
            statusDiv.textContent = `Processing audio with ${MODEL_NAME}...`;
            break;
        case 'success':
            recordToggleButton.disabled = false;
            recordToggleButton.setAttribute('aria-label', 'Start Recording');
            statusDiv.textContent = "Done. Click to record again.";
            outputDiv.classList.add('visible');
            break;
        case 'error':
            recordToggleButton.disabled = false;
            recordToggleButton.setAttribute('aria-label', 'Start Recording');
            statusDiv.className = 'error';
            // Specific error message is set by the caller
            outputDiv.classList.add('visible');
            break;
    }
}

// --- Event Listeners ---
recordToggleButton.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: AUDIO_MIME_TYPE });

        isRecording = true;
        setUIState('recording');

        mediaRecorder.start();
        audioChunks = [];

        mediaRecorder.addEventListener('dataavailable', event => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener('stop', async () => {
            const audioBlob = new Blob(audioChunks, { type: AUDIO_MIME_TYPE });
            await sendToGemini(audioBlob);
            // Stop all media tracks to turn off the microphone indicator
            stream.getTracks().forEach(track => track.stop());
        });
    } catch (err) {
        console.error("Error accessing microphone:", err);
        statusDiv.textContent = "Error: Could not access microphone. Please grant permission.";
        setUIState('error');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        setUIState('processing');
    }
}

function sendToGemini(audioBlob) {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1];
        
        const prompt = `always write the transcription and the translation to english, and rewrite with the correct form in correct english.
example:
Transcription:
ما أريده هو اوفر فيو عبارة عن جمل قصيرة تتحدث عني وكل تفاصيل عني في جمل قصيرة.

Translation:
What I want is an overview in the form of short sentences that talk about me, and all the details about me in short sentences.

The correct form:
I'm looking for a brief overview about myself, presented in a series of short sentences.`;

        const requestBody = {
            "contents": [
                {
                    "parts": [
                        { "text": prompt },
                        {
                            "inline_data": {
                                "mime_type": AUDIO_MIME_TYPE,
                                "data": base64Audio
                            }
                        }
                    ]
                }
            ]
        };

        const maxTotalAttempts = 6; // 2 full rotations of the 3 keys
        for (let attempt = 1; attempt <= maxTotalAttempts; attempt++) {
            try {
                const currentKey = apiKeys[currentApiKeyIndex];
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${currentKey}`;

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                const data = await response.json();

                if (!response.ok) {
                    const errorMessage = data.error?.message || "An unknown API error occurred.";
                    throw new Error(`API Error: ${errorMessage}`);
                }

                if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
                    const content = data.candidates[0].content.parts[0].text;
                    outputDiv.textContent = content;
                    setUIState('success');
                    return; // Success, exit the function
                } else {
                    let message = "No valid content from API. Audio might be silent or unprocessable.";
                    if (data.candidates && data.candidates[0].finishReason) {
                        message += ` (Reason: ${data.candidates[0].finishReason})`;
                    }
                    throw new Error(message);
                }
            } catch (error) {
                console.error(`Attempt ${attempt} with key index ${currentApiKeyIndex} failed:`, error);
                
                // Rotate to the next API key for the next attempt
                currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;

                if (attempt < maxTotalAttempts) {
                    statusDiv.textContent = `Service issue detected. Retrying... (${attempt}/${maxTotalAttempts})`;
                }
            }
        }

        // If the loop completes, all attempts have failed across all keys.
        const finalErrorMessage = "The service is currently unavailable after multiple attempts. Please try again later.";
        outputDiv.textContent = finalErrorMessage;
        statusDiv.textContent = "Processing failed.";
        setUIState('error');
    };
}

// --- Initialization ---
function initialize() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
        statusDiv.textContent = "Error: Your browser does not support the required audio recording APIs.";
        setUIState('error');
        recordToggleButton.disabled = true; // Permanently disable
        return;
    }

    if (!apiKeys || apiKeys.length === 0 || apiKeys.some(key => key === API_KEY_PLACEHOLDER || !key.startsWith("AIza"))) {
        statusDiv.innerHTML = `<strong>Error:</strong> Please configure valid API keys in the script.`;
        setUIState('error');
        recordToggleButton.disabled = true; // Permanently disable
    } else {
        setUIState('idle');
    }
}

initialize();