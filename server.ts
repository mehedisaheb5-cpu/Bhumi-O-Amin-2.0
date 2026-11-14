import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import appletConfig from './firebase-applet-config.json' assert { type: 'json' };

import { paymentEngine } from './server/paymentEngine';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Lazy initialize Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Bhumi O Amin (ভূমি ও আমিন)',
    pwa: true,
    hasApiKey: !!process.env.GEMINI_API_KEY,
    paymentsFoundation: 'Phase 17C Ready',
  });
});

// ========================================================
// PHASE 17C: SECURE SERVER-SIDE PAYMENT INTEGRATION FOUNDATION
// ========================================================

// 1. Public Payment Gateway Availability Config (No secrets exposed)
app.get('/api/payments/config', (req, res) => {
  res.json(paymentEngine.getPublicConfig());
});

// 2. Payment Initiation with Idempotency & Duplicate Protection
app.post('/api/payments/initiate', async (req, res) => {
  try {
    const { bookingId, amount, provider, customer, serviceName, idempotencyKey, metadata } = req.body;

    if (!bookingId || !amount || !provider) {
      return res.status(400).json({
        error: 'Missing required fields: bookingId, amount, and provider are required.',
      });
    }

    const result = await paymentEngine.initiatePayment({
      bookingId,
      amount: Number(amount),
      currency: 'BDT',
      provider,
      customer: customer || { name: 'Customer', mobile: '' },
      serviceName: serviceName || 'Amin Service',
      idempotencyKey,
      metadata,
    });

    return res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Payment Initiation Error:', err);
    return res.status(500).json({ error: err?.message || 'Payment initiation failed' });
  }
});

// 3. Payment Verification
// Enforces: Payment status does NOT become Paid simply by a frontend click.
// Only an Admin or a cryptographically verified gateway response can mark success.


// Helper to get Firebase configuration safely
function getFirebaseConfig() {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId;
  const rawDbId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId;
  const firestoreDatabaseId = rawDbId && !rawDbId.startsWith('G-') && rawDbId !== '(default)' ? rawDbId : '(default)';

  if (!apiKey || !projectId) {
    console.error('Firebase configuration (FIREBASE_API_KEY, FIREBASE_PROJECT_ID) is missing');
    throw new Error('Server configuration error');
  }

  return { apiKey, projectId, firestoreDatabaseId };
}

// Helper to verify ID Token and get UID
async function getUidFromToken(idToken: string): Promise<string | null> {
  const { apiKey } = getFirebaseConfig();
  
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  
  const data = await response.json();
  if (!response.ok || !data.users || data.users.length === 0) return null;
  return data.users[0].localId;
}

// Helper to check if user is admin via Firestore REST API
async function isUserAdmin(uid: string, idToken: string): Promise<boolean> {
  const { projectId, firestoreDatabaseId } = getFirebaseConfig();
  
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/users/${uid}`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  
  if (!response.ok) return false;
  const data = await response.json();
  
  // Firestore REST response structure: fields -> role -> stringValue
  const role = data.fields?.role?.stringValue;
  return role === 'admin';
}

// 3. Payment Verification
// Enforces: Payment status does NOT become Paid simply by a frontend click.
// Only an Admin or a cryptographically verified gateway response can mark success.
app.post('/api/payments/verify', async (req, res) => {
  try {
    const {
      paymentId,
      bookingId,
      provider,
      transactionId,
      paymentReference,
      signature,
      verifiedBy,
      notes,
    } = req.body;

    if (!paymentId || !bookingId || !provider) {
      return res.status(400).json({
        error: 'Missing required fields: paymentId, bookingId, and provider are required.',
      });
    }

    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) return res.status(401).json({ error: 'Unauthorized: Missing ID token' });

    const uid = await getUidFromToken(idToken);
    if (!uid) return res.status(401).json({ error: 'Unauthorized: Invalid ID token' });

    const isAdmin = await isUserAdmin(uid, idToken);

    const result = await paymentEngine.verifyPayment({
      paymentId,
      bookingId,
      provider,
      transactionId,
      paymentReference,
      signature,
      verifiedBy,
      isAdmin,
      notes,
    });

    return res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Payment Verification Error:', err);
    return res.status(500).json({ error: err?.message || 'Payment verification failed' });
  }
});

app.post('/api/payments/refund', async (req, res) => {
  try {
    const { paymentId, bookingId, reason, amount } = req.body;

    if (!paymentId || !bookingId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: paymentId, bookingId, and reason are required.',
      });
    }

    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) return res.status(401).json({ error: 'Unauthorized: Missing ID token' });

    const uid = await getUidFromToken(idToken);
    if (!uid) return res.status(401).json({ error: 'Unauthorized: Invalid ID token' });

    const isAdmin = await isUserAdmin(uid, idToken);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Admin only' });

    const result = await paymentEngine.refundPayment({
      paymentId,
      bookingId,
      reason,
      amount,
      isAdmin: true,
      requestedBy: uid,
    });

    return res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Refund API Error:', err);
    return res.status(500).json({ error: err?.message || 'Refund processing failed' });
  }
});

// 5. Payment Webhook / IPN Listener (Prepared for future bKash/Nagad/SSLCommerz callbacks)
app.post('/api/payments/webhook/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    console.log(`[Payment Webhook] Received webhook callback for provider: ${provider}`, {
      headers: req.headers,
      body: req.body,
    });

    // Webhooks in Phase 17C acknowledge reception without executing fake transactions
    return res.status(200).json({
      received: true,
      provider,
      mode: 'foundation',
      message: 'Webhook received and logged. Live gateway verification pending production configuration.',
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Payment Webhook Error:', err);
    return res.status(500).json({ error: 'Webhook processing error' });
  }
});

// 6. Query Transactions for a Booking
app.get('/api/payments/transactions/:bookingId', (req, res) => {
  try {
    const { bookingId } = req.params;
    const transactions = paymentEngine.getTransactionsForBooking(bookingId);
    return res.json({ bookingId, transactions });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({ error: err?.message || 'Failed to retrieve transactions' });
  }
});

// Multi-turn Gemini Chat API for Land Consultant ("আমিন সহকারী")
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gemini-3.5-flash', systemInstruction } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured.',
        fallbackMessage:
          'এআই সহকারী বর্তমানে অফলাইন মোডে আছে। অনুগ্রহ করে সেটিংস প্যানেল থেকে GEMINI_API_KEY কনফিগার করুন। সাধারণ হিসাব ও পরিমাপ টুলগুলো অফলাইনেও ব্যবহার করা যাবে।',
      });
    }

    // Allowed models check
    const allowedModels = [
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.1-pro-preview',
      'gemini-3.8-flash',
    ];
    const selectedModel = allowedModels.includes(model) ? model : 'gemini-3.5-flash';

    const defaultSystemInstruction =
      systemInstruction ||
      `আপনি "ভূমি ও আমিন" প্ল্যাটফর্মের একজন অত্যন্ত অভিজ্ঞ, দক্ষ এবং পেশাদার ডিজিটাল ভূমি ও জরিপ বিশেষজ্ঞ সহকারী (আমিন ও ভূমি আইন পরামর্শক)।
আপনার প্রধান দায়িত্ব:
১. বাংলাদেশের প্রচলিত ভূমি জরিপ (CS, SA, RS, BS / City Jarip), খতিয়ান, পর্চা, নামজারি (মিউটেশন), খাজনা/ডিএলআরএমএস এবং ভূমি রেজিস্ট্রেশন সম্পর্কিত প্রশ্নের নির্ভুল ও সহজ বাংলায় উত্তর দেওয়া।
২. গ্রামীণ ও শহুরে সাধারণ মানুষ ও ভূমি মালিকদের জমি পরিমাপ (শতাংশ, কাঠা, বিঘা, একর, বর্গফুট, শিকল/লিংক), সীমানা বিরোধ নিরসন এবং দলিল যাচাই সংক্রান্ত ব্যবহারিক পরামর্শ দেওয়া।
৩. উত্তর সবসময় বিনয়ী, পেশাদার, প্রাঞ্জল ও সুস্পষ্ট পয়েন্ট আকারে দেওয়া।
৪. আইনি বিষয়ে স্মরণ করিয়ে দেওয়া যে জটিল বিরোধ বা আদালতের মামলার ক্ষেত্রে সরকারি রেজিস্টার্ড দলিল লেখক, বিজ্ঞ আইনজীবী বা সনদপ্রাপ্ত সরকারি আমিনের সরজমিনে উপস্থিতি প্রয়োজন।`;

    const formattedContents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: formattedContents,
      config: {
        systemInstruction: defaultSystemInstruction,
      },
    });

    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: { text?: string }) => !!p.text);
    const replyText = textPart?.text || response.text || 'কোনো উত্তর পাওয়া যায়নি।';

    return res.json({ reply: replyText });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Chat API Error:', err);
    return res.status(500).json({
      error: err?.message || 'Chat generation failed',
    });
  }
});

// Image Generation API for Map & Plot Visualizer using gemini-3-pro-image-preview
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, size = '1K', aspectRatio = '1:1' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured. Please add GEMINI_API_KEY in settings.',
      });
    }

    // Model: gemini-3-pro-image-preview or gemini-3.1-flash-image
    const modelToUse = 'gemini-3-pro-image-preview';
    const validSizes = ['1K', '2K', '4K'];
    const selectedSize = validSizes.includes(size) ? size : '1K';

    const enhancedPrompt = `High quality architectural cadastral map sketch or land plot layout: ${prompt}. Clean technical lines, clear boundary demarcation, realistic Bangladesh rural/suburban land terrain or cadastral layout.`;

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: {
        parts: [{ text: enhancedPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as '1:1' | '4:3' | '16:9' | '3:4' | '9:16',
          imageSize: selectedSize as '1K' | '2K' | '4K',
        },
      },
    });

    let imageUrl: string | null = null;
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      return res.status(500).json({ error: 'No image generated in the response' });
    }

    return res.json({ imageUrl });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Image Generation API Error:', err);
    return res.status(500).json({
      error: err?.message || 'Image generation failed',
    });
  }
});

// ========================================================
// ========================================================
// PHASE 18: AI SKETCH TO DIGITAL DRAWING API ENDPOINTS
// ========================================================

// 1. AI Vision Service Status & Capability Check
app.get('/api/sketch-to-drawing/status', (req, res) => {
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  return res.json({
    connected: hasApiKey,
    status: hasApiKey ? 'connected' : 'integration_ready',
    model: hasApiKey ? 'gemini-3.1-flash-lite' : null,
    supportedTypes: ['image/jpeg', 'image/jpg', 'image/png'],
    message: hasApiKey
      ? 'Google Gemini Vision AI Connected'
      : 'AI configuration required (GEMINI_API_KEY is not set)',
    disclaimer:
      'AI-generated drawing is based on the uploaded sketch and requires Amin/user review. It is not automatically a legal boundary document.',
  });
});

// 2. Multimodal AI Vision Analysis for Hand-Drawn Sketch
app.post('/api/sketch-to-drawing/detect', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', fileName, metadata } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Image data is required',
        disclaimer:
          'AI-generated drawing is based on the uploaded sketch and requires Amin/user review. It is not automatically a legal boundary document.',
      });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        success: false,
        status: 'not_configured',
        aiStatusText: 'AI configuration required',
        message:
          'AI configuration required (GEMINI_API_KEY is not set). Server-side integration is ready. Amin manual review and CAD plotting is active.',
        disclaimer:
          'AI-generated drawing is based on the uploaded sketch and requires Amin/user review. It is not automatically a legal boundary document.',
      });
    }

    // Clean base64 string
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const prompt = `You are an expert Bangladeshi land surveyor (Amin) and computer vision analyst reviewing a hand-drawn land sketch (ফিল্ড খসড়া নকশা).
Analyze the image strictly based ONLY on what is legibly visible in the drawing.
Extract detected elements in a strict JSON object matching this schema:
{
  "dagNo": string or null,
  "khatianNo": string or null,
  "mouza": string or null,
  "points": [
    {
      "id": string (e.g. "pt-1"),
      "name": string (letter like "A", "B", "C", "D" or Bengali "ক", "খ"),
      "type": "point" | "corner" | "station",
      "label": string,
      "x": number (0 to 1000 representing X position on the image where 0 is left and 1000 is right),
      "y": number (0 to 1000 representing Y position on the image where 0 is top and 1000 is bottom),
      "confidence": number (0.0 to 1.0, reflecting visual clarity),
      "isCorner": boolean,
      "provenance": "ai_detected",
      "sourceDescription": string (e.g. "Visual pencil corner vertex A")
    }
  ],
  "lines": [
    {
      "id": string (e.g. "ln-1"),
      "fromPointId": string,
      "toPointId": string,
      "distanceFt": number or null,
      "distanceLinks": number or null,
      "isBoundary": boolean,
      "type": "boundary" | "subdivision" | "tie_line",
      "label": string or null,
      "confidence": number (0.0 to 1.0),
      "provenance": "ai_detected",
      "sourceDescription": string
    }
  ],
  "polygon": {
    "pointIds": [string],
    "areaSqFt": number or null,
    "perimeterFt": number or null
  },
  "dimensions": [
    {
      "id": string (e.g. "dim-1"),
      "fromPointId": string,
      "toPointId": string,
      "valueFt": number,
      "unit": "ft" | "links" | "m",
      "rawText": string,
      "label": string,
      "confidence": number (0.0 to 1.0),
      "provenance": "ai_detected",
      "sourceDescription": string
    }
  ],
  "labels": [
    {
      "id": string,
      "text": string,
      "x": number (0-1000),
      "y": number (0-1000),
      "type": "dag" | "khatian" | "mouza" | "road" | "pond" | "canal" | "boundary" | "other",
      "confidence": number (0.0 to 1.0),
      "provenance": "ai_detected",
      "sourceDescription": string
    }
  ],
  "northArrow": {
    "detected": boolean,
    "angleDegrees": number (0 is UP, 90 is RIGHT, 180 is DOWN, 270 is LEFT),
    "x": number (0-1000),
    "y": number (0-1000),
    "confidence": number (0.0 to 1.0),
    "provenance": "ai_detected",
    "sourceDescription": string
  },
  "features": [
    {
      "id": string,
      "type": "road" | "pond" | "canal" | "drain" | "tree" | "building" | "border_post" | "other",
      "name": string,
      "label": string,
      "points": [{"x": number, "y": number}],
      "notes": string,
      "confidence": number (0.0 to 1.0),
      "provenance": "ai_detected",
      "sourceDescription": string
    }
  ],
  "detectedTextSummary": [string],
  "confidenceScore": number (0.0 to 1.0)
}

CRITICAL RULES:
- Return ONLY the raw valid JSON object without markdown fences or backticks.
- Do NOT convert image coordinates into real-world GPS coordinates.
- Do NOT invent or fabricate imaginary distances or coordinates.
- If a value or boundary is illegible or missing, omit it or set to null.
- Set provenance to "ai_detected" for all elements identified.
- Provide a confidence score between 0.0 and 1.0 for each element based on clarity.`;

    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.1-pro-preview',
    ];
    let lastError: Error | null = null;
    let successfulModel: string | null = null;
    let replyText = '';

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response.text) {
          replyText = response.text;
          successfulModel = modelName;
          break;
        }
      } catch (genErr: unknown) {
        lastError = genErr as Error;
        console.warn(`Model ${modelName} vision analysis attempt note:`, (genErr as Error).message);
        // If 404, 503, or rate limit, continue to next candidate model
      }
    }

    if (!successfulModel || !replyText) {
      console.warn('All AI model attempts exhausted or temporarily unavailable:', lastError?.message);
      return res.json({
        success: false,
        status: 'integration_ready',
        aiStatusText: 'AI service temporarily unavailable',
        message:
          'AI Vision মডেল বর্তমানে উচ্চ ট্রাফিক বা রেট-লিমিটে থাকায় সার্ভার ভিত্তি মোডে রয়েছে। আপনি সরাসরি ড্রয়িং ক্যানভাসে পয়েন্ট/লাইন স্থাপন ও সংশোধন করতে পারবেন।',
        disclaimer:
          'AI-generated drawing is based on the uploaded sketch and requires Amin/user review. It is not automatically a legal boundary document.',
      });
    }

    let parsedData: any = null;
    try {
      const cleaned = replyText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('Could not parse Gemini vision JSON:', parseErr, replyText);
    }

    if (parsedData && Array.isArray(parsedData.points) && parsedData.points.length > 0) {
      // Clean and normalize points
      const points = parsedData.points.map((p: any, idx: number) => ({
        id: p.id || `pt-${idx + 1}`,
        name: p.name || String.fromCharCode(65 + idx),
        type: p.type || (p.isCorner ? 'corner' : 'point'),
        label: p.label || p.name || `P${idx + 1}`,
        x: Math.max(0, Math.min(1000, typeof p.x === 'number' ? Math.round(p.x) : 500)),
        y: Math.max(0, Math.min(1000, typeof p.y === 'number' ? Math.round(p.y) : 500)),
        confidence: typeof p.confidence === 'number' ? Math.round(p.confidence * 100) / 100 : 0.90,
        isCorner: p.isCorner ?? true,
        provenance: 'ai_detected',
        sourceDescription: p.sourceDescription || `AI vision detected vertex ${p.name || ''}`,
      }));

      // Clean lines
      const lines = Array.isArray(parsedData.lines)
        ? parsedData.lines.map((l: any, idx: number) => ({
            id: l.id || `ln-${idx + 1}`,
            fromPointId: l.fromPointId || points[idx % points.length]?.id,
            toPointId: l.toPointId || points[(idx + 1) % points.length]?.id,
            distanceFt: typeof l.distanceFt === 'number' ? l.distanceFt : undefined,
            distanceLinks: typeof l.distanceLinks === 'number' ? l.distanceLinks : undefined,
            isBoundary: l.isBoundary ?? true,
            type: l.type || 'boundary',
            label: l.label || (l.distanceFt ? `${l.distanceFt} ফুট` : undefined),
            confidence: typeof l.confidence === 'number' ? Math.round(l.confidence * 100) / 100 : 0.88,
            provenance: 'ai_detected',
            sourceDescription: l.sourceDescription || 'AI detected boundary line',
          }))
        : [];

      // Clean dimensions
      const dimensions = Array.isArray(parsedData.dimensions)
        ? parsedData.dimensions.map((d: any, idx: number) => ({
            id: d.id || `dim-${idx + 1}`,
            fromPointId: d.fromPointId || points[idx % points.length]?.id,
            toPointId: d.toPointId || points[(idx + 1) % points.length]?.id,
            valueFt: typeof d.valueFt === 'number' ? d.valueFt : 0,
            unit: d.unit || 'ft',
            rawText: d.rawText || `${d.valueFt || ''} ft`,
            label: d.label || `${d.valueFt || ''} ফুট`,
            confidence: typeof d.confidence === 'number' ? Math.round(d.confidence * 100) / 100 : 0.85,
            provenance: 'ai_detected',
            sourceDescription: d.sourceDescription || 'AI dimension reading',
          }))
        : [];

      // Clean labels
      const labels = Array.isArray(parsedData.labels)
        ? parsedData.labels.map((lb: any, idx: number) => ({
            id: lb.id || `lbl-${idx + 1}`,
            text: lb.text || '',
            x: Math.max(0, Math.min(1000, typeof lb.x === 'number' ? Math.round(lb.x) : 500)),
            y: Math.max(0, Math.min(1000, typeof lb.y === 'number' ? Math.round(lb.y) : 500)),
            type: lb.type || 'other',
            confidence: typeof lb.confidence === 'number' ? Math.round(lb.confidence * 100) / 100 : 0.92,
            provenance: 'ai_detected',
            sourceDescription: lb.sourceDescription || 'AI detected text label',
          }))
        : [];

      // Clean north arrow
      const northArrow = parsedData.northArrow
        ? {
            detected: parsedData.northArrow.detected ?? true,
            angleDegrees: parsedData.northArrow.angleDegrees ?? 0,
            x: parsedData.northArrow.x ?? 900,
            y: parsedData.northArrow.y ?? 100,
            confidence: typeof parsedData.northArrow.confidence === 'number' ? Math.round(parsedData.northArrow.confidence * 100) / 100 : 0.95,
            provenance: 'ai_detected',
            sourceDescription: 'AI detected North orientation marker',
          }
        : {
            detected: false,
            angleDegrees: 0,
            confidence: 0,
            provenance: 'ai_detected',
          };

      // Clean survey features (roads, canals, ponds, waterbodies)
      const features = Array.isArray(parsedData.features)
        ? parsedData.features.map((f: any, idx: number) => ({
            id: f.id || `feat-${idx + 1}`,
            type: f.type || 'road',
            name: f.name || f.label || `Feature ${idx + 1}`,
            label: f.label || f.name || `Feature ${idx + 1}`,
            points: Array.isArray(f.points) ? f.points : [],
            notes: f.notes,
            confidence: typeof f.confidence === 'number' ? Math.round(f.confidence * 100) / 100 : 0.85,
            provenance: 'ai_detected',
            sourceDescription: f.sourceDescription || 'AI detected topography feature',
          }))
        : [];

      return res.json({
        success: true,
        status: 'analyzed',
        modelUsed: successfulModel,
        data: {
          dagNo: parsedData.dagNo || undefined,
          khatianNo: parsedData.khatianNo || undefined,
          mouza: parsedData.mouza || undefined,
          points,
          lines,
          polygon: parsedData.polygon || { pointIds: points.map((p: any) => p.id) },
          dimensions,
          labels,
          northArrow,
          features,
          detectedTextSummary: parsedData.detectedTextSummary || [],
          isAiAssisted: true,
          confidenceScore: typeof parsedData.confidenceScore === 'number' ? Math.round(parsedData.confidenceScore * 100) / 100 : 0.91,
        },
        message: `স্কেচ থেকে ${points.length}টি পয়েন্ট, বাউন্ডারি ও পরিমাপ সফলভাবে শনাক্ত হয়েছে (${successfulModel})। অনুগ্রহ করে রিভিউ করুন।`,
        disclaimer:
          'AI-generated drawing is based on the uploaded sketch and requires Amin/user review. It is not automatically a legal boundary document.',
      });
    }

    return res.json({
      success: false,
      status: 'integration_ready',
      aiStatusText: 'No clear geometry detected',
      message:
        'চিত্র বিশ্লেষণ সম্পন্ন হয়েছে তবে কোনো স্পষ্ট জ্যামিতিক নকশা বা পয়েন্ট শনাক্ত হয়নি। আপনি ম্যানুয়ালি পয়েন্ট চিহ্নিত করতে পারেন।',
      disclaimer:
        'AI-generated drawing is based on the uploaded sketch and requires Amin/user review. It is not automatically a legal boundary document.',
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Sketch Detection API Error:', err);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: err?.message || 'Sketch detection process encountered an error.',
      disclaimer:
        'AI-generated drawing is based on the uploaded sketch and requires Amin/user review. It is not automatically a legal boundary document.',
    });
  }
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`भूमि ও আমিন server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
