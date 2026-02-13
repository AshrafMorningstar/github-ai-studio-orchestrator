
import { AIKeys, AIProvider } from "../types";

const PROVIDER_URLS: Record<Exclude<AIProvider, 'gemini'>, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions'
};

const PROVIDER_MODELS: Record<Exclude<AIProvider, 'gemini'>, string> = {
  openai: 'gpt-4o',
  deepseek: 'deepseek-chat',
  openrouter: 'google/gemini-2.0-flash-001'
};

export async function callChatAI(
  provider: Exclude<AIProvider, 'gemini'>,
  keys: AIKeys,
  prompt: string,
  json: boolean = false
) {
  const apiKey = keys[provider];
  if (!apiKey) throw new Error(`API Key for ${provider} missing.`);

  const response = await fetch(PROVIDER_URLS[provider], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(provider === 'openrouter' ? { 'HTTP-Referer': window.location.origin, 'X-Title': 'GitHub ARM' } : {})
    },
    body: JSON.stringify({
      model: PROVIDER_MODELS[provider],
      messages: [{ role: 'user', content: prompt }],
      ...(json ? { response_format: { type: 'json_object' } } : {})
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`${provider} Error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
