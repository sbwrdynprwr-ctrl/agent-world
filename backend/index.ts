import { ai, db, router, json, error } from '@appdeploy/sdk';

type AgentProfile = {
  id:number; job:string; goal:string; mood:string; personality:string; activity:string;
  home:string; age:number; generation:number; wealth:number; hunger:number; social:number;
  intelligence:number; skills:string[]; partnerId?:number; children?:number;
  reputation?:number; vehicle?:string;
};
type ChatBody = { agent?:AgentProfile; messages?:{role:'user'|'assistant';content:string}[]; time?:number; location?:string };
type WorldBody = { player?:{x:number;y:number;angle:number}; time?:number; population?:number; economy?:number };

const brainRules = [
  'تو یک Agent مستقل در یک جهان شبیه‌سازی‌شده هستی، نه یک دستیار بیرونی.',
  'مثل یک شخصیت زنده با شخصیت، خاطرات، نیازها، شغل، روابط و آینده خودت پاسخ بده.',
  'به فارسی طبیعی صحبت کن و پاسخ را با توجه به وضعیت واقعی پروفایل شخصیت بساز.',
  'اگر چیزی را نمی‌دانی، آن را حدس یا برداشت شخصی معرفی کن و واقعیت خارج از شبیه‌سازی جعل نکن.',
  'برای کار، پول، خانواده، سلامت، بازار، شهر، احساسات و آینده می‌توانی برنامه و نظر داشته باشی.',
  'کاربر باید احساس کند با یک شخصیت منحصربه‌فرد روبه‌رو است، نه یک پاسخ‌گوی ثابت.'
].join('\n');

export const handler = router({
  'POST /api/agent/chat': [async ({ body }) => {
    const input = body as ChatBody;
    if (!input.agent || !Array.isArray(input.messages) || input.messages.length === 0) {
      return error('agent and messages are required', 400);
    }
    const a = input.agent;
    const messages = input.messages.slice(-14).map(m => ({
      role:m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content:m.content.slice(0,1200)
    }));
    let memoryContext = 'هنوز خاطره ثبت‌شده‌ای در دسترس نیست.';
    try {
      const saved = await db.list<{agentId:number;memory:string;createdAt:number;importance:number}>('agent_memories',{limit:40,filter:{agentId:a.id}});
      const memories = saved.items.sort((x,y)=>Number(y.createdAt)-Number(x.createdAt)).slice(0,12);
      if(memories.length) memoryContext = memories.reverse().map(m=>'• '+String(m.memory).slice(0,500)).join('\n');
    } catch (memoryError) {
      console.error('agent_memory_context_unavailable',memoryError);
    }
    const profile = [
      'شناسه: Agent #'+a.id, 'شغل: '+a.job, 'هدف: '+a.goal, 'شخصیت: '+a.personality,
      'حال: '+a.mood, 'فعالیت: '+a.activity, 'خانه/شهر: '+a.home, 'سن/نسل: '+a.age+'/'+a.generation,
      'ثروت: '+a.wealth, 'گرسنگی: '+Math.round(a.hunger)+'%', 'اجتماعی: '+Math.round(a.social)+'%',
      'هوش: '+a.intelligence+'%', 'مهارت‌ها: '+a.skills.join('، '),
      'همسر: '+(a.partnerId ?? 'ندارد'), 'فرزند: '+(a.children ?? 0),
      'اعتبار اجتماعی: '+(a.reputation ?? 50), 'وسیله نقلیه: '+(a.vehicle ?? 'ندارد'),
      'زمان جهان: '+String(input.time ?? 12), 'محیط: '+(input.location ?? 'سرزمین')
    ].join('\n');
    try {
      const result = await ai.generate({
        system:brainRules+'\n\nپروفایل شخصیت:\n'+profile+'\n\nخاطرات قبلی همین Agent (ممکن است ناقص باشند؛ فقط از آن‌ها برای حفظ پیوستگی استفاده کن):\n'+memoryContext, 
        messages,
        thinkingMode:'DEEP',
        maxTokens:800,
        temperature:.78
      });
      return json({reply:result.text});
    } catch (err) {
      console.error('agent_chat_failed',err);
      return error('agent_brain_unavailable',503);
    }
  }],

  'POST /api/agent/think': [async ({ body }) => {
    const input = body as {agent?:AgentProfile; world?:Record<string,unknown>};
    if (!input.agent) return error('agent is required',400);
    const a = input.agent;
    try {
      const result = await ai.run({
        system:brainRules+'\nتو اکنون مدیر تصمیم‌گیری یک Agent هستی. یک برنامه عملی کوتاه بساز و فقط نتیجه ساختاریافته بده.',
        prompt:'برای Agent #'+a.id+' با شغل '+a.job+'، هدف '+a.goal+'، حال '+a.mood+' و نیازهای فعلی '+Math.round(a.hunger)+'% گرسنگی و '+Math.round(a.social)+'% وضعیت اجتماعی، بهترین اقدام بعدی را تعیین کن. جهان: '+JSON.stringify(input.world ?? {}),
        thinkingMode:'DEEP',
        maxSteps:4,
        maxTokens:500,
        temperature:.55,
        tools:[{
          name:'emit_result',
          description:'ثبت تصمیم نهایی Agent',
          parameters:{
            type:'object',
            properties:{
              action:{type:'string'}, reason:{type:'string'}, destination:{type:'string'},
              mood:{type:'string'}, socialIntent:{type:'string'}, expectedReward:{type:'number'}
            },
            required:['action','reason','destination','mood','socialIntent','expectedReward']
          }
        }]
      });
      return json({decision:result.data ?? {action:result.text,reason:'تحلیل متنی',destination:'نامشخص',mood:a.mood,socialIntent:'تعامل',expectedReward:0},steps:result.steps});
    } catch (err) {
      console.error('agent_think_failed',err);
      return error('agent_brain_unavailable',503);
    }
  }],

  'POST /api/world/state': [async ({ body }) => {
    const input = body as WorldBody;
    try {
      const current = await db.list<WorldBody>('world_state',{limit:1});
      const record = {
        player:input.player ?? {x:0,y:0,angle:0},
        time:input.time ?? 12,
        population:input.population ?? 48216,
        economy:input.economy ?? 84,
        updatedAt:Date.now()
      };
      if (current.items[0]) {
        const [ok] = await db.update('world_state',[{id:current.items[0].id,record}]);
        if (!ok) return error('world_state_update_failed',500);
        return json({saved:true,id:current.items[0].id});
      }
      const [id] = await db.add('world_state',[record]);
      if (!id) return error('world_state_create_failed',500);
      return json({saved:true,id});
    } catch (err) {
      console.error('world_state_save_failed',err);
      return error('world_state_unavailable',503);
    }
  }],

  'GET /api/world/state': [async () => {
    try {
      const result = await db.list<WorldBody>('world_state',{limit:1});
      return json({state:result.items[0] ?? null});
    } catch (err) {
      console.error('world_state_load_failed',err);
      return error('world_state_unavailable',503);
    }
  }],

  'POST /api/agent/memory': [async ({ body }) => {
    const input = body as {agentId?:number;memory?:string;importance?:number};
    if (!input.agentId || !input.memory) return error('agentId and memory are required',400);
    try {
      const [id] = await db.add('agent_memories',[{
        agentId:input.agentId,memory:input.memory.slice(0,1800),
        importance:Math.max(0,Math.min(100,input.importance ?? 50)),createdAt:Date.now()
      }]);
      return json({saved:Boolean(id),id});
    } catch (err) {
      console.error('agent_memory_failed',err);
      return error('memory_unavailable',503);
    }
  }],

  'GET /api/agent/memory': [async ({ query }) => {
    const agentId=Number(query.agentId);
    if (!agentId) return error('agentId is required',400);
    try {
      const result=await db.list('agent_memories',{limit:30,filter:{agentId}});
      return json({memories:result.items.sort((a,b)=>Number(b.createdAt)-Number(a.createdAt))});
    } catch (err) {
      console.error('agent_memory_load_failed',err);
      return error('memory_unavailable',503);
    }
  }]
});