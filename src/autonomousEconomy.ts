export type EconomyJob =
  | 'کشاورز' | 'مهندس' | 'پزشک' | 'معمار' | 'سازنده' | 'تاجر'
  | 'پژوهشگر' | 'برنامه‌نویس' | 'معلم' | 'راننده' | 'هنرمند' | 'ماهیگیر';

export type EconomyAgent = {
  id: number;
  job: string;
  wealth: number;
  energy: number;
  hunger: number;
  mood: string;
  activity: string;
  skills: string[];
};

export type EconomyStock = {
  food: number;
  materials: number;
  tools: number;
  medicine: number;
  knowledge: number;
  culture: number;
};

export type EconomyTick = {
  agents: EconomyAgent[];
  stock: EconomyStock;
  events: string[];
  economyDelta: number;
};

const tasks: Record<string, { activity: string; product: keyof EconomyStock; amount: number; energy: number; pay: number }[]> = {
  'کشاورز': [{ activity: 'کاشت و آبیاری مزرعه', product: 'food', amount: 3, energy: 7, pay: 5 }, { activity: 'برداشت محصول و ارسال به بازار', product: 'food', amount: 4, energy: 9, pay: 6 }],
  'ماهیگیر': [{ activity: 'صید پایدار و رساندن غذا به بازار', product: 'food', amount: 3, energy: 8, pay: 5 }],
  'مهندس': [{ activity: 'تعمیر زیرساخت‌های شهر', product: 'tools', amount: 2, energy: 6, pay: 7 }, { activity: 'بهینه‌سازی مصرف انرژی', product: 'knowledge', amount: 1, energy: 4, pay: 6 }],
  'پزشک': [{ activity: 'رسیدگی به بیماران', product: 'medicine', amount: 2, energy: 5, pay: 6 }],
  'معمار': [{ activity: 'طراحی ساختمان ایمن', product: 'knowledge', amount: 2, energy: 5, pay: 6 }],
  'سازنده': [{ activity: 'ساخت‌وساز با مصالح محلی', product: 'materials', amount: 2, energy: 8, pay: 6 }],
  'تاجر': [{ activity: 'مبادله کالا و متعادل‌سازی بازار', product: 'food', amount: 1, energy: 4, pay: 8 }],
  'پژوهشگر': [{ activity: 'پژوهش برای بهبود تولید', product: 'knowledge', amount: 2, energy: 4, pay: 6 }],
  'برنامه‌نویس': [{ activity: 'ساخت ابزارهای دیجیتال', product: 'tools', amount: 2, energy: 5, pay: 7 }],
  'معلم': [{ activity: 'آموزش مهارت به جامعه', product: 'knowledge', amount: 1, energy: 4, pay: 5 }],
  'راننده': [{ activity: 'حمل کالا میان بازار و انبار', product: 'materials', amount: 1, energy: 5, pay: 5 }],
  'هنرمند': [{ activity: 'برگزاری رویداد فرهنگی', product: 'culture', amount: 2, energy: 3, pay: 4 }]
};

export function runEconomyTick(agents: EconomyAgent[], previous: EconomyStock): EconomyTick {
  const stock: EconomyStock = { ...previous };
  const next = agents.map((agent) => ({ ...agent, skills: [...agent.skills] }));
  const events: string[] = [];
  let economyDelta = 0;

  for (const agent of next) {
    agent.hunger = Math.min(100, agent.hunger + 1);
    if (agent.energy < 18 || agent.hunger > 86) {
      agent.activity = agent.hunger > 86 ? 'در جست‌وجوی غذا و استراحت' : 'در حال استراحت برای بازیابی انرژی';
      agent.energy = Math.min(100, agent.energy + 3);
      agent.mood = 'خسته';
      continue;
    }

    const options = tasks[agent.job] || [{ activity: 'یادگیری مهارت تازه', product: 'knowledge' as const, amount: 1, energy: 3, pay: 3 }];
    const task = options[(agent.id + Math.floor(agent.wealth)) % options.length];
    agent.activity = task.activity;
    agent.energy = Math.max(0, agent.energy - task.energy);

    // Wages are paid from the simulated economy, not created without limit.
    const wage = Math.min(task.pay, Math.max(0, 80 - agent.wealth));
    agent.wealth += wage;
    economyDelta += wage * 0.03;

    if (agent.job === 'تاجر') {
      // Traders move goods between the market and warehouse instead of creating food from nothing.
      if (stock.materials > 8) {
        stock.materials -= 1;
        stock.food += 2;
        agent.activity = 'تبادل مصالح با غذا در بازار';
      } else if (stock.tools > 5) {
        stock.tools -= 1;
        stock.food += 1;
        agent.activity = 'تبادل ابزار با غذا در بازار';
      } else {
        stock.culture += 1;
        agent.activity = 'جست‌وجوی معامله سودمند در بازار';
      }
    } else {
      stock[task.product] += task.amount;
    }

    if (stock.food > 0 && agent.hunger > 25) {
      stock.food -= 1;
      agent.hunger = Math.max(0, agent.hunger - 18);
      agent.mood = 'خوشحال';
    } else if (agent.hunger > 65) {
      agent.mood = 'گرسنه';
    }

    if (agent.job === 'پزشک' && stock.medicine > 0 && agent.hunger > 55) {
      stock.medicine -= 1;
      agent.hunger = Math.max(0, agent.hunger - 5);
      agent.activity = 'رسیدگی درمانی به ساکنان نیازمند';
    }
    if (task.product === 'knowledge' && !agent.skills.includes('یادگیری مداوم')) agent.skills.push('یادگیری مداوم');
  }

  // Keep the simulated warehouse within sensible limits and avoid negative inventories.
  (Object.keys(stock) as (keyof EconomyStock)[]).forEach(key => {
    stock[key] = Math.max(0, Math.min(999999, Math.round(stock[key] * 100) / 100));
  });

  if (stock.food < 10) events.push('هشدار بازار: ذخیره غذا کم است؛ کشاورزان و ماهیگیران باید تولید را افزایش دهند.');
  if (stock.materials >= 20 && stock.tools >= 10) events.push('منابع کافی برای آغاز یک پروژه ساختمانی فراهم شده است.');
  if (stock.medicine < 5) events.push('نیاز به تولید دارو و تقویت خدمات درمانی وجود دارد.');
  if (next.length > 0 && next.filter(a => a.energy < 18).length >= Math.ceil(next.length * 0.6)) events.push('بخش زیادی از نیروی کار خسته است؛ استراحت جمعی لازم است.');
  if (next.some(a => a.hunger > 75)) events.push('چند Agent گرسنه‌اند؛ بررسی ذخیره غذا و افزایش تولید لازم است.');

  return { agents: next, stock, events, economyDelta };
}
