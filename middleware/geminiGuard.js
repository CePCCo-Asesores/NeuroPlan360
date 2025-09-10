// middleware/geminiGuard.js
function geminiGuard(_req, res, next) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
    return res.status(503).json({
      success: false,
      error: 'Gemini is not configured',
      code: 'NO_GEMINI_KEY'
    });
  }
  next();
}

module.exports = { geminiGuard };
