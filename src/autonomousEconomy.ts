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

    // Recovery is a real priority: exhausted or very hungry residents should
    // eat when possible and regain energy before returning to productive work.
    if (agent.energy < 18 || agent.hunger > 86) {
      if (stock.food > 0 && agent.hunger > 25) {
        stock.food -= 1;
        agent.hunger = Math.max(0, agent.hunger - 22);
        agent.activity = 'غذا خوردن و بازیابی نیرو';
      } else {
        agent.activity = agent.hunger > 86 ? 'در جست‌وجوی غذا و استراحت' : 'در حال استراحت برای بازیابی انرژی';
      }
      agent.energy = Math.min(100, agent.energy + 8);
      agent.mood = agent.hunger > 70 ? 'گرسنه' : 'در حال بازیابی';
      continue;
    }

    const options = tasks[agent.job] || [{ activity: 'یادگیری مهارت تازه', product: 'knowledge' as const, amount: 1, energy: 3, pay: 3 }];
    let task = options[(agent.id + Math.floor(agent.wealth)) % options.length];
    const foodTarget = Math.max(25, next.length * 0.35);
    // Let the workforce react to shortages instead of following a fixed routine.
    if (stock.food < foodTarget && (agent.job === 'کشاورز' || agent.job === 'ماهیگیر')) task = options[options.length - 1];
    if (stock.medicine < Math.max(8, next.length * 0.08) && agent.job === 'پزشک') task = options[0];
    if (stock.materials < Math.max(12, next.length * 0.12) && agent.job === 'سازنده') task = options[0];
    if (stock.tools < Math.max(10, next.length * 0.1) && agent.job === 'مهندس') task = options[0];
    if (stock.knowledge < Math.max(15, next.length * 0.12) && (agent.job === 'پژوهشگر' || agent.job === 'معلم' || agent.job === 'معمار')) task = options[0];
    if (stock.culture < 8 && agent.job === 'هنرمند') task = options[0];
    agent.activity = task.activity;
    agent.energy = Math.max(0, agent.energy - task.energy);

    // Wages are paid from the simulated economy, not created without limit.
    const wage = Math.min(task.pay, Math.max(0, 80 - agent.wealth));
    agent.wealth += wage;
    economyDelta += wage * 0.03;

    if (agent.job === 'تاجر') {
      // Traders coordinate supply: exchange surplus stock for scarce essentials.
      const foodTarget = Math.max(25, next.length * 0.35);
      const medicineTarget = Math.max(8, next.length * 0.08);
      const toolsTarget = Math.max(10, next.length * 0.1);
      if (stock.food < foodTarget && stock.materials > 8) {
        stock.materials -= 1;
        stock.food += 2;
        agent.activity = 'تأمین غذا از طریق مبادله بازار';
      } else if (stock.medicine < medicineTarget && stock.culture > 5) {
        stock.culture -= 2;
        stock.medicine += 1;
        agent.activity = 'هماهنگی تأمین دارو برای درمانگاه';
      } else if (stock.tools < toolsTarget && stock.materials > 8) {
        stock.materials -= 2;
        stock.tools += 1;
        agent.activity = 'تأمین ابزار برای مهندسان';
      } else if (stock.materials > 12 && stock.food >= foodTarget) {
        stock.materials -= 1;
        stock.food += 1;
        agent.activity = 'تبادل مازاد مصالح با بازار';
      } else {
        stock.culture += 1;
        agent.activity = 'جست‌وجوی معامله سودمند در بازار';
      }
    } else {
      const target = task.product === 'food' ? Math.max(25, next.length * 0.35) : task.product === 'medicine' ? Math.max(8, next.length * 0.08) : task.product === 'materials' ? Math.max(12, next.length * 0.12) : task.product === 'tools' ? Math.max(10, next.length * 0.1) : task.product === 'knowledge' ? Math.max(15, next.length * 0.12) : 8;
      const ratio = stock[task.product] / target;
      const boost = ratio < 0.35 ? 2.5 : ratio < 0.6 ? 2 : ratio < 1 ? 1.5 : 1;
      stock[task.product] += task.amount * boost;
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

  const foodTarget = Math.max(25, next.length * 0.35);
  const medicineTarget = Math.max(8, next.length * 0.08);
  const materialTarget = Math.max(12, next.length * 0.12);
  const toolTarget = Math.max(10, next.length * 0.1);
  const knowledgeTarget = Math.max(15, next.length * 0.12);
  const hungryCount = next.filter(a => a.hunger > 75).length;
  const exhaustedCount = next.filter(a => a.energy < 18).length;
  const hungryRatio = next.length ? hungryCount / next.length : 0;
  const exhaustedRatio = next.length ? exhaustedCount / next.length : 0;
  const priorityPlan = [
    { ratio: stock.food / foodTarget, message: 'برنامه خودکار: افزایش تولید غذا در اولویت نخست شهر قرار گرفت.' },
    { ratio: stock.medicine / medicineTarget, message: 'برنامه خودکار: تأمین دارو و پشتیبانی درمانی در اولویت شهر قرار گرفت.' },
    { ratio: stock.materials / materialTarget, message: 'برنامه خودکار: تأمین مصالح برای نگهداری و توسعه شهر در اولویت قرار گرفت.' },
    { ratio: stock.tools / toolTarget, message: 'برنامه خودکار: تأمین ابزار و تعمیر زیرساخت‌ها در اولویت قرار گرفت.' },
    { ratio: stock.knowledge / knowledgeTarget, message: 'برنامه خودکار: آموزش و پژوهش برای افزایش دانش شهر در اولویت قرار گرفت.' },
  ].sort((a, b) => a.ratio - b.ratio);
  if (priorityPlan[0]?.ratio < 0.75) events.push(priorityPlan[0].message);

  if (stock.food < 10) events.push('برنامه فوری شهر: بحران غذا؛ تولید و مبادله غذا باید اولویت نخست باشد.');
  else if (stock.food < foodTarget) events.push('هشدار غذا: ذخیره زیر سطح هدف است؛ کشاورزان و ماهیگیران باید تولید را افزایش دهند.');
  if (stock.medicine < medicineTarget) events.push('هشدار درمان: ذخیره دارو کمتر از نیاز تخمینی شهر است.');
  if (stock.materials < materialTarget) events.push('هشدار ساخت‌وساز: مصالح برای پروژه‌های آینده کم است.');
  if (stock.tools < toolTarget) events.push('هشدار زیرساخت: ابزار کافی برای تعمیرات و کار مهندسان وجود ندارد.');
  if (stock.knowledge < knowledgeTarget) events.push('هشدار آموزش و پژوهش: ذخیره دانش پایین‌تر از هدف شهر است.');
  if (stock.materials >= 20 && stock.tools >= 10) events.push('فرصت توسعه: منابع کافی برای آغاز یک پروژه ساختمانی فراهم شده است.');
  if (exhaustedRatio >= 0.6) events.push('هشدار نیروی کار: بیش از ۶۰٪ ایجنت‌ها کم‌انرژی‌اند؛ استراحت و بازیابی را در اولویت بگذارید.');
  else if (exhaustedRatio >= 0.3) events.push('خستگی رو به افزایش است؛ زمان‌بندی کار و استراحت را متعادل کنید.');
  if (hungryRatio >= 0.4) events.push('هشدار رفاه: دست‌کم ۴۰٪ ایجنت‌ها گرسنه‌اند؛ ذخیره غذا و توزیع آن را بررسی کنید.');
  else if (hungryCount > 0) events.push(`نیاز به پشتیبانی: ${hungryCount} ایجنت گرسنه‌اند.`);

  return { agents: next, stock, events, economyDelta };
}
