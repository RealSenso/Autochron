import { format, parse, addMinutes, differenceInMinutes, isValid } from 'date-fns';

export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  try {
    const parsedDate = parse(timeStr, 'HH:mm', new Date(2026, 0, 1));
    if (isValid(parsedDate)) {
      const midnight = new Date(2026, 0, 1, 0, 0, 0);
      const diff = differenceInMinutes(parsedDate, midnight);
      return Math.min(Math.max(diff, 0), 1439);
    }
  } catch {
  }
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;
  return Math.min(Math.max(hours * 60 + minutes, 0), 1439);
}

export function minutesToTime(minutes: number): string {
  const boundedMins = Math.max(0, Math.min(minutes, 1440));
  try {
    const baseDate = new Date(2026, 0, 1, 0, 0, 0);
    const targetDate = addMinutes(baseDate, boundedMins);
    return format(targetDate, 'HH:mm');
  } catch {
    const hrs = Math.floor(boundedMins / 60) % 24;
    const mins = Math.floor(boundedMins % 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}`;
  }
}

export function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  if (timeStr === '24:00') return '12:00 AM';
  try {
    const date = parse(timeStr, 'HH:mm', new Date());
    if (!isValid(date)) return timeStr;
    return format(date, 'h:mm a');
  } catch {
    return timeStr;
  }
}

export function getTodayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getPreviousDateStr(dateStr: string): string {
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  const prev = new Date(parsed);
  prev.setDate(prev.getDate() - 1);
  return format(prev, 'yyyy-MM-dd');
}

export function getPreviousDayOfWeek(dayOfWeek: number): number {
  return (dayOfWeek + 6) % 7;
}

export function addMinutesToTimeStr(timeStr: string, mins: number): string {
  try {
    const parsedDate = parse(timeStr, 'HH:mm', new Date(2026, 0, 1));
    if (isValid(parsedDate)) {
      const resultDate = addMinutes(parsedDate, mins);
      return format(resultDate, 'HH:mm');
    }
  } catch {
  }
  const currentMins = timeToMinutes(timeStr);
  const newMins = (currentMins + mins) % 1440;
  return minutesToTime(newMins < 0 ? newMins + 1440 : newMins);
}

export function getDurationMinutes(startTime: string, endTime: string): number {
  try {
    const startDate = parse(startTime, 'HH:mm', new Date(2026, 0, 1));
    let endDate = parse(endTime, 'HH:mm', new Date(2026, 0, 1));
    if (isValid(startDate) && isValid(endDate)) {
      if (endDate < startDate) {
        endDate = addMinutes(endDate, 1440);
      }
      return Math.max(0, differenceInMinutes(endDate, startDate));
    }
  } catch {
  }
  const startMins = timeToMinutes(startTime);
  let endMins = timeToMinutes(endTime);
  if (endMins < startMins) {
    endMins += 1440;
  }
  return Math.max(0, endMins - startMins);
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function isOverlapping(s1: number, e1: number, s2: number, e2: number): boolean {
  return Math.max(s1, s2) < Math.min(e1, e2);
}

export interface PastelStyle {
  bg: string;
  border: string;
  text: string;
  badge: string;
  iconBg: string;
  borderLeft: string;
}

export const PASTEL_PALETTES: PastelStyle[] = [
  {
    bg: 'bg-rose-50/90 hover:bg-rose-100/90 text-rose-950',
    border: 'border-rose-200',
    text: 'text-rose-950',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    iconBg: 'bg-rose-100 text-rose-700',
    borderLeft: 'border-l-4 border-rose-400',
  },
  {
    bg: 'bg-sky-50/90 hover:bg-sky-100/90 text-sky-950',
    border: 'border-sky-200',
    text: 'text-sky-950',
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    iconBg: 'bg-sky-100 text-sky-700',
    borderLeft: 'border-l-4 border-sky-400',
  },
  {
    bg: 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-950',
    border: 'border-emerald-200',
    text: 'text-emerald-950',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    iconBg: 'bg-emerald-100 text-emerald-700',
    borderLeft: 'border-l-4 border-emerald-400',
  },
  {
    bg: 'bg-purple-50/90 hover:bg-purple-100/90 text-purple-950',
    border: 'border-purple-200',
    text: 'text-purple-950',
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
    iconBg: 'bg-purple-100 text-purple-700',
    borderLeft: 'border-l-4 border-purple-400',
  },
  {
    bg: 'bg-amber-50/90 hover:bg-amber-100/90 text-amber-950',
    border: 'border-amber-200',
    text: 'text-amber-950',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    iconBg: 'bg-amber-100 text-amber-700',
    borderLeft: 'border-l-4 border-amber-400',
  },
  {
    bg: 'bg-teal-50/90 hover:bg-teal-100/90 text-teal-950',
    border: 'border-teal-200',
    text: 'text-teal-950',
    badge: 'bg-teal-100 text-teal-800 border-teal-300',
    iconBg: 'bg-teal-100 text-teal-700',
    borderLeft: 'border-l-4 border-teal-400',
  },
  {
    bg: 'bg-orange-50/90 hover:bg-orange-100/90 text-orange-950',
    border: 'border-orange-200',
    text: 'text-orange-950',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    iconBg: 'bg-orange-100 text-orange-700',
    borderLeft: 'border-l-4 border-orange-400',
  },
  {
    bg: 'bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-950',
    border: 'border-indigo-200',
    text: 'text-indigo-950',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    iconBg: 'bg-indigo-100 text-indigo-700',
    borderLeft: 'border-l-4 border-indigo-400',
  },
  {
    bg: 'bg-fuchsia-50/90 hover:bg-fuchsia-100/90 text-fuchsia-950',
    border: 'border-fuchsia-200',
    text: 'text-fuchsia-950',
    badge: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
    iconBg: 'bg-fuchsia-100 text-fuchsia-700',
    borderLeft: 'border-l-4 border-fuchsia-400',
  },
  {
    bg: 'bg-cyan-50/90 hover:bg-cyan-100/90 text-cyan-950',
    border: 'border-cyan-200',
    text: 'text-cyan-950',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    iconBg: 'bg-cyan-100 text-cyan-700',
    borderLeft: 'border-l-4 border-cyan-400',
  },
];

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCategoryStyles(category: string, title?: string): PastelStyle {
  if (category === 'core_sleep') {
    return {
      bg: 'bg-stone-900 text-stone-100 hover:bg-stone-800',
      border: 'border-stone-800',
      text: 'text-stone-100',
      badge: 'bg-stone-950 text-stone-300 border-stone-800',
      iconBg: 'bg-stone-800 text-stone-200',
      borderLeft: 'border-l-4 border-indigo-500',
    };
  }

  if (title && title.trim().length > 0) {
    const paletteIndex = stringHash(title.trim().toLowerCase()) % PASTEL_PALETTES.length;
    return PASTEL_PALETTES[paletteIndex];
  }

  switch (category) {
    case 'nap':
      return PASTEL_PALETTES[3];
    case 'lecture':
      return PASTEL_PALETTES[0];
    case 'meal':
      return PASTEL_PALETTES[4];
    case 'task':
      return PASTEL_PALETTES[1];
    case 'pomodoro_study':
      return PASTEL_PALETTES[2];
    case 'pomodoro_break':
      return PASTEL_PALETTES[5];
    case 'decompression':
      return PASTEL_PALETTES[8];
    case 'weekly_chore':
      return PASTEL_PALETTES[6];
    default:
      return PASTEL_PALETTES[7];
  }
}
