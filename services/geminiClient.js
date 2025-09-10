// services/geminiClient.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

let cachedModel = null;
let cachedClient = null;

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const DEFAULT_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 15000);

function ensureApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '') {
    const err = new Error('GEMINI_API_KEY missing');
    err.code = 'NO_GEMINI_KEY';
    throw err;
  }
  return key;
}

function getClient() {
  if (cachedClient) return cachedClient;
  const key = ensureApiKey();
  cachedClient = new GoogleGenerativeAI(key);
  return cachedClient;
}

function getModel() {
  if (cachedModel) return cachedModel;
  const client = getClient();
  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  cachedModel = client.getGenerativeModel({ model: modelName });
  return cachedModel;
}

async function generateSafe(prompt, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const model = getModel();

  const job = model.generateContent(prompt);
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('GEMINI_TIMEOUT')), timeoutMs));

  try {
    const result = await Promise.race([job, timeout]);
    return result;
  } catch (err) {
    if (err?.message === 'GEMINI_TIMEOUT') {
      const e = new Error('Gemini request timed out');
      e.code = 'GEMINI_TIMEOUT';
      throw e;
    }
    if (err?.message?.toLowerCase().includes('permission') || err?.message?.toLowerCase().includes('invalid')) {
      const e = new Error('Gemini auth/model error');
      e.code = 'GEMINI_AUTH';
      e.detail = err.message;
      throw e;
    }
    err.code = err.code || 'GEMINI_ERROR';
    throw err;
  }
}

module.exports = { getClient, getModel, generateSafe };
