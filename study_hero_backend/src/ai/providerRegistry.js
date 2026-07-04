const axios = require('axios');

function estimateTokens(text = '') {
    return Math.max(1, Math.ceil(String(text).length / 4));
}

function normalizeResponse(provider, data, startedAt, prompt) {
    const text = data?.choices?.[0]?.message?.content
        || data?.candidates?.[0]?.content?.parts?.[0]?.text
        || data?.response
        || data?.output
        || data?.text
        || '';
    const inputTokens = data?.usage?.prompt_tokens || estimateTokens(prompt);
    const outputTokens = data?.usage?.completion_tokens || estimateTokens(text);

    return {
        provider,
        text: String(text || '').trim(),
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: Date.now() - startedAt,
        raw: data
    };
}

function configuredProvider() {
    return (process.env.AI_PROVIDER || (process.env.MISTRAL_API_KEY ? 'mistral' : 'ollama')).toLowerCase();
}

async function callMistral(messages, options = {}) {
    if (!process.env.MISTRAL_API_KEY) throw new Error('Mistral API key is not configured');
    const startedAt = Date.now();
    const prompt = messages.map((message) => message.content).join('\n');
    const response = await axios.post('https://api.mistral.ai/v1/chat/completions', {
        model: options.model || process.env.MISTRAL_MODEL || 'mistral-medium',
        messages,
        temperature: options.temperature ?? 0.3
    }, {
        headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 45000)
    });
    return normalizeResponse('mistral', response.data, startedAt, prompt);
}

async function callOpenAICompatible(provider, baseUrl, apiKey, messages, options = {}) {
    if (!apiKey) throw new Error(`${provider} API key is not configured`);
    const startedAt = Date.now();
    const prompt = messages.map((message) => message.content).join('\n');
    const response = await axios.post(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        model: options.model || process.env.AI_MODEL || 'gpt-4o-mini',
        messages,
        temperature: options.temperature ?? 0.3
    }, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 45000)
    });
    return normalizeResponse(provider, response.data, startedAt, prompt);
}

async function callGemini(messages, options = {}) {
    if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API key is not configured');
    const startedAt = Date.now();
    const prompt = messages.map((message) => `${message.role}: ${message.content}`).join('\n');
    const model = options.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 45000) }
    );
    return normalizeResponse('gemini', response.data, startedAt, prompt);
}

async function callOllama(messages, options = {}) {
    const startedAt = Date.now();
    const prompt = messages.map((message) => `${message.role}: ${message.content}`).join('\n');
    const response = await axios.post(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/generate`, {
        model: options.model || process.env.OLLAMA_MODEL || 'llama3.1',
        prompt,
        stream: false
    }, { timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 60000) });
    return normalizeResponse('ollama', response.data, startedAt, prompt);
}

async function complete(messages, options = {}) {
    const provider = (options.provider || configuredProvider()).toLowerCase();
    if (provider === 'mistral') return callMistral(messages, options);
    if (provider === 'openai') return callOpenAICompatible('openai', process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', process.env.OPENAI_API_KEY, messages, options);
    if (provider === 'azure_openai' || provider === 'azure-openai') return callOpenAICompatible('azure_openai', process.env.AZURE_OPENAI_ENDPOINT || '', process.env.AZURE_OPENAI_API_KEY, messages, options);
    if (provider === 'gemini') return callGemini(messages, options);
    if (provider === 'ollama') return callOllama(messages, options);
    throw new Error(`Unsupported AI provider: ${provider}`);
}

module.exports = { complete, estimateTokens, configuredProvider };