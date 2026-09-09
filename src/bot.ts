import { Telegraf } from 'telegraf';
import 'dotenv/config';

import { addEntry, getEntriesForMonth, getEntriesForToday, initDatabase } from './db';

const token = process.env.BOT_TOKEN;

if (!token) {
  throw new Error('BOT_TOKEN не найден. Создайте .env с BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN');
}

const bot = new Telegraf(token);

function formatMoney(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₸`;
}

function parseEntry(text: string): { title: string; amount: number; type: 'expense' | 'income' } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(.+?)\s+(\d+(?:[.,]\d{1,2})?)$/);
  if (!match) return null;

  const title = match[1].trim();
  const amountRaw = match[2].replace(',', '.');
  const amount = Math.round(Number(amountRaw));

  if (!title || Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  return {
    title,
    amount,
    type: 'expense',
  };
}

function parseIncome(text: string): { title: string; amount: number; type: 'income' } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^\+\s*(.+?)\s+(\d+(?:[.,]\d{1,2})?)$/i);
  if (!match) return null;

  const title = match[1].trim();
  const amountRaw = match[2].replace(',', '.');
  const amount = Math.round(Number(amountRaw));

  if (!title || Number.isNaN(amount) || amount <= 0) return null;

  return { title, amount, type: 'income' };
}

async function showTodayReport(ctx: any) {
  const userId = Number(ctx.from?.id);
  const entries = await getEntriesForToday(userId);

  const expenses = entries.filter((entry) => entry.type === 'expense');
  const total = expenses.reduce((sum, entry) => sum + entry.amount, 0);

  if (expenses.length === 0) {
    await ctx.reply('💰 Расходы за сегодня\n\nПока нет расходов.');
    return;
  }

  const lines = expenses.map((entry) => `☕ ${entry.title} — ${formatMoney(entry.amount)}`);
  const text = `💰 Расходы за сегодня\n\n${lines.join('\n')}\n\nИтого: ${formatMoney(total)}`;

  await ctx.reply(text);
}

async function showMonthReport(ctx: any) {
  const userId = Number(ctx.from?.id);
  const entries = await getEntriesForMonth(userId);

  const expenses = entries.filter((entry) => entry.type === 'expense');
  const incomes = entries.filter((entry) => entry.type === 'income');

  const totalExpense = expenses.reduce((sum, entry) => sum + entry.amount, 0);
  const totalIncome = incomes.reduce((sum, entry) => sum + entry.amount, 0);
  const balance = totalIncome - totalExpense;

  const lines = expenses.map((entry) => `💸 ${entry.title} — ${formatMoney(entry.amount)}`);
  const incomeLines = incomes.map((entry) => `💵 ${entry.title} — ${formatMoney(entry.amount)}`);

  const text = `📊 Итоги за месяц\n\nДоходы:\n${incomeLines.length ? incomeLines.join('\n') : 'Нет доходов'}\n\nРасходы:\n${lines.length ? lines.join('\n') : 'Нет расходов'}\n\nИтого: ${formatMoney(balance)}`;

  await ctx.reply(text);
}

bot.start(async (ctx) => {
  await ctx.reply(
    'Привет! 👋\nЯ ExpenseBot 💰\n\nПишите расходы или доходы в формате:\n\nкофе 450\n+ зарплата 250000\n\nКоманды:\n/start\n/today\n/month\n/help',
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply('Формат записи:\n\nРасход: кофе 450\nДоход: + зарплата 250000\n\nКоманды:\n/today\n/month');
});

bot.command('today', async (ctx) => {
  await showTodayReport(ctx);
});

bot.command('month', async (ctx) => {
  await showMonthReport(ctx);
});

bot.on('text', async (ctx) => {
  const userId = Number(ctx.from?.id);
  const text = ctx.message.text.trim();

  if (!text) return;

  if (text.startsWith('/')) return;

  const incomeEntry = parseIncome(text);
  if (incomeEntry) {
    await addEntry(userId, incomeEntry.title, incomeEntry.amount, 'income');
    await ctx.reply(`✅ Доход добавлен: ${incomeEntry.title} — ${formatMoney(incomeEntry.amount)}`);
    return;
  }

  const parsed = parseEntry(text);
  if (!parsed) {
    await ctx.reply('❌ Неверный формат. Пример: кофе 450');
    return;
  }

  await addEntry(userId, parsed.title, parsed.amount, 'expense');
  await ctx.reply(`✅ Расход добавлен: ${parsed.title} — ${formatMoney(parsed.amount)}`);
});

bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  if (ctx && typeof ctx.reply === 'function') {
    ctx.reply('⚠️ Что-то пошло не так, но бот продолжает работу.').catch(() => undefined);
  }
});

async function bootstrap() {
  await initDatabase();
  await bot.launch();
  console.log('ExpenseBot запущен!');
}

bootstrap();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
