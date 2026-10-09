import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: '1mb' }));

// Lightweight standalone API. Data is kept in memory on this instance.
let worldState = null;
const memories = [];
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'agent-world-api' }));
app.get('/api/world/state', (_req, res) => res.json({ state: worldState }));
app.post('/api/world/state', (req, res) => {
  worldState = { ...(req.body || {}), updatedAt: Date.now() };
  res.json({ saved: true, state: worldState });
});
app.get('/api/agent/memory', (req, res) => {
  const agentId = Number(req.query.agentId);
  res.json({ memories: memories.filter(m => m.agentId === agentId).slice(-30).reverse() });
});
app.post('/api/agent/memory', (req, res) => {
  const { agentId, memory, importance = 50 } = req.body || {};
  if (!agentId || !memory) return res.status(400).json({ error: 'agentId and memory are required' });
  const item = { id: memories.length + 1, agentId: Number(agentId), memory: String(memory).slice(0, 1800), importance: Math.max(0, Math.min(100, Number(importance))), createdAt: Date.now() };
  memories.push(item);
  if (memories.length > 5000) memories.splice(0, memories.length - 5000);
  res.json({ saved: true, id: item.id });
});
async function cloudResponse(input, instructions) {
  if (!process.env.OPENAI_API_KEY) return null;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-6-astra',
      instructions,
      input,
      max_output_tokens: 450
    }),
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Cloud AI request failed:', response.status, detail.slice(0, 400));
    throw new Error('cloud_ai_http_' + response.status);
  }
  const data = await response.json();
  const text = data.output_text || (data.output || [])
    .flatMap(item => item.content || [])
    .filter(part => part.type === 'output_text')
    .map(part => part.text || '')
    .join('\n');
  if (!text.trim()) throw new Error('cloud_ai_empty_response');
  return text.trim();
}

app.get('/api/ai/status', (_req, res) => res.json({
  configured: Boolean(process.env.OPENAI_API_KEY),
  provider: process.env.OPENAI_API_KEY ? 'openai' : 'local-simulation',
  model: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || 'gpt-6-astra') : null
}));

app.post('/api/agent/chat', async (req, res) => {
  const { agent, messages, time, location } = req.body || {};
  if (!agent || !Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'agent and messages are required' });
  const recent = memories.filter(m => m.agentId === Number(agent.id)).slice(-8);
  const context = [
    'You are a persistent character inside Agent World, a simulated living open world.',
    'Reply in the same language as the user, especially natural Persian when they write Persian.',
    'Stay in character using the supplied profile. Be conversational, specific, and concise.',
    'You may suggest actions in the simulated world, but never claim you actually changed game state unless an API action confirms it.',
    'Agent profile: ' + JSON.stringify({
      id: agent.id, job: agent.job, mood: agent.mood, personality: agent.personality,
      goal: agent.goal, home: agent.home, activity: agent.activity, intelligence: agent.intelligence,
      social: agent.social, wealth: agent.wealth
    }),
    'Current simulated time: ' + String(time ?? 'unknown'),
    'Player location: ' + String(location ?? 'unknown'),
    'Relevant memories: ' + (recent.map(m => m.memory).join(' | ') || 'No stored memories yet.')
  ].join('\n');
  try {
    const reply = await cloudResponse(messages.slice(-12).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 1600)
    })), context);
    if (reply) return res.json({ reply, mode: 'cloud-ai', notice: 'پاسخ از هوش مصنوعی ابری تولید شد.' });
  } catch (err) {
    console.error('Cloud AI unavailable; using local fallback:', err.message);
  }
  const last = String(messages[messages.length - 1]?.content || '').slice(0, 1200);
  let reply;
  if (/سلام|درود|حالت چطوره|خوبی/.test(last)) reply = 'سلام! من ' + (agent.job || 'یکی از ساکنان این جهان') + ' هستم. حالم ' + (agent.mood || 'خوب') + ' است. تو چه خبر؟';
  else if (/کار|شغل|پول|درآمد|تجارت/.test(last)) reply = 'در این جهان شغل من ' + (agent.job || 'مشخص نشده') + ' است و فعلاً هدفم ' + (agent.goal || 'پیشرفت') + ' است. بیایید راه‌های عملی برای پیشرفت جامعه را بررسی کنیم.';
  else if (/خانواده|دوست|احساس|حال/.test(last)) reply = 'شخصیت من ' + (agent.personality || 'کنجکاو') + ' است و الان احساس ' + (agent.mood || 'آرام') + ' دارم. رابطه با دیگران برایم مهم است.';
  else reply = 'به حرفت فکر می‌کنم: «' + last.slice(0, 160) + '». من به‌عنوان ' + (agent.job || 'یکی از ساکنان') + ' دنبال ' + (agent.goal || 'پیشرفت') + ' هستم. از دید من بهتر است قدم‌به‌قدم بررسی کنیم و نتیجه را در جهان آزمایش کنیم.';
  if (recent.length) reply += ' یادم هست قبلاً درباره «' + String(recent[recent.length - 1].memory).slice(0, 90) + '» صحبت کرده‌ایم.';
  res.json({ reply, mode: 'local-simulation', notice: 'کلید هوش ابری تنظیم نشده یا سرویس ابری موقتاً پاسخ نداده است.' });
});

app.post('/api/agent/think', async (req, res) => {
  const a = req.body?.agent;
  if (!a) return res.status(400).json({ error: 'agent is required' });
  try {
    const decisionText = await cloudResponse(
      'Return one concise JSON object only, with keys action, reason, destination, mood, socialIntent, expectedReward. Make a plausible next decision for this simulated agent.\nAgent: ' + JSON.stringify(a) + '\nWorld: ' + JSON.stringify(req.body?.world || {}),
      'You are the decision engine for an autonomous simulated person in Agent World. Use the character profile and needs. Never claim a real-world action. Output valid JSON only.'
    );
    if (decisionText) {
      const cleaned = decisionText.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
      const decision = JSON.parse(cleaned);
      return res.json({ decision, steps: 1, mode: 'cloud-ai' });
    }
  } catch (err) {
    console.error('Cloud AI decision unavailable; using local fallback:', err.message);
  }
  const action = Number(a.hunger || 0) > 70 ? 'غذا پیدا کن' : Number(a.social || 0) < 30 ? 'با یک Agent گفت‌وگو کن' : 'برای هدف خود کار کن';
  res.json({ decision: { action, reason: 'تصمیم پایه بر اساس نیازهای ثبت‌شده شخصیت', destination: a.home || 'نزدیک‌ترین محل امن', mood: a.mood || 'آرام', socialIntent: 'تعامل با جامعه', expectedReward: 1 }, steps: 1, mode: 'local-simulation' });
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), err => { if (err) next(err); });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log('Agent World listening on ' + port));
