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
app.post('/api/agent/chat', (req, res) => {
  const { agent, messages } = req.body || {};
  if (!agent || !Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'agent and messages are required' });
  const last = String(messages[messages.length - 1]?.content || '').slice(0, 1200);
  const recent = memories.filter(m => m.agentId === Number(agent.id)).slice(-5);
  let reply;
  if (/سلام|درود|حالت چطوره|خوبی/.test(last)) reply = 'سلام! من ' + (agent.job || 'یکی از ساکنان این جهان') + ' هستم. حالم ' + (agent.mood || 'خوب') + ' است. تو چه خبر؟';
  else if (/کار|شغل|پول|درآمد|تجارت/.test(last)) reply = 'در این جهان شغل من ' + (agent.job || 'مشخص نشده') + ' است و فعلاً هدفم ' + (agent.goal || 'پیشرفت') + ' است. بیایید راه‌های عملی برای پیشرفت جامعه را بررسی کنیم.';
  else if (/خانواده|دوست|احساس|حال/.test(last)) reply = 'شخصیت من ' + (agent.personality || 'کنجکاو') + ' است و الان احساس ' + (agent.mood || 'آرام') + ' دارم. رابطه با دیگران برایم مهم است.';
  else reply = 'به حرفت فکر می‌کنم: «' + last.slice(0, 160) + '». من به‌عنوان ' + (agent.job || 'یکی از ساکنان') + ' دنبال ' + (agent.goal || 'پیشرفت') + ' هستم. از دید من بهتر است قدم‌به‌قدم بررسی کنیم و نتیجه را در جهان آزمایش کنیم.';
  if (recent.length) reply += ' یادم هست قبلاً درباره «' + String(recent[recent.length - 1].memory).slice(0, 90) + '» صحبت کرده‌ایم.';
  res.json({ reply, mode: 'local-simulation', notice: 'این پاسخ از موتور محلی شبیه‌سازی تولید شده و به مدل هوش مصنوعی ابری متصل نیست.' });
});
app.post('/api/agent/think', (req, res) => {
  const a = req.body?.agent;
  if (!a) return res.status(400).json({ error: 'agent is required' });
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
