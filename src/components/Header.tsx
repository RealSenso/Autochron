import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Timer,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  MoreHorizontal,
  Download,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { format, parse } from 'date-fns';

interface HeaderProps {
  currentDateStr: string;
  onDateChange: (newDateStr: string) => void;
  activeTab: 'timeline' | 'focus';
  onTabChange: (tab: 'timeline' | 'focus') => void;
  onGenerateSchedule: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onReset?: () => void;
  isGenerating?: boolean;
  isSyncActive: boolean;
  userEmail: string | null;
  onOpenSync: () => void;
}

const KitoseMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
    <rect width="28" height="28" rx="8" fill="var(--color-vela-600)" />
    <path
      d="M14 8v6l4.2 2.4"
      stroke="var(--color-vela-50)"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="14" cy="14" r="8.5" stroke="var(--color-vela-300)" strokeWidth="1.4" strokeDasharray="2.2 3.4" />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({
  currentDateStr,
  onDateChange,
  activeTab,
  onTabChange,
  onExport,
  onImport,
  onReset,
  isSyncActive,
  userEmail,
  onOpenSync,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const currentDate = parse(currentDateStr, 'yyyy-MM-dd', new Date());

  const handlePrevDay = () => {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    onDateChange(format(prevDate, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    onDateChange(format(nextDate, 'yyyy-MM-dd'));
  };

  const handleToday = () => {
    onDateChange(format(new Date(), 'yyyy-MM-dd'));
  };

  return (
    <header className="bg-white border-b border-stone-200 text-stone-900 px-4 md:px-6 py-3 shadow-xs sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <KitoseMark className="w-7 h-7 shrink-0" />
            <div className="flex items-baseline gap-1.5">
              <h1 className="font-display font-semibold text-xl tracking-tight text-stone-900">
                Kitose
              </h1>
              <span className="text-xs font-semibold text-stone-400 font-mono">季時</span>
            </div>
          </div>

          <div className="flex md:hidden items-center gap-1 bg-stone-100 p-1 rounded-md border border-stone-200 text-xs">
            <button onClick={handlePrevDay} className="p-1 hover:bg-stone-200 rounded text-stone-700">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold px-1 text-stone-800">{format(currentDate, 'MMM d')}</span>
            <button onClick={handleNextDay} className="p-1 hover:bg-stone-200 rounded text-stone-700">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 bg-stone-50 p-1 rounded-md border border-stone-200">
          <button
            onClick={handlePrevDay}
            className="p-1.5 hover:bg-stone-200/80 rounded text-stone-600 transition-colors"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-bold hover:bg-stone-200/80 rounded text-stone-700 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-stone-800">
            <CalendarIcon className="w-3.5 h-3.5 text-vela-600" />
            <span>{format(currentDate, 'EEEE, MMMM d, yyyy')}</span>
          </div>
          <button
            onClick={handleNextDay}
            className="p-1.5 hover:bg-stone-200/80 rounded text-stone-600 transition-colors"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={currentDateStr}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className="bg-white border border-stone-200 rounded px-2 py-0.5 text-xs text-stone-700 font-medium focus:outline-none focus:border-vela-500"
          />
        </div>

        <div className="flex items-center gap-2 max-w-full">
          <div className="flex bg-stone-100 rounded-md p-1 text-xs font-bold text-stone-500 border border-stone-200/80">
            <button
              onClick={() => onTabChange('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all whitespace-nowrap ${
                activeTab === 'timeline'
                  ? 'bg-white text-vela-600 shadow-xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Day</span>
            </button>
            <button
              onClick={() => onTabChange('focus')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all whitespace-nowrap ${
                activeTab === 'focus'
                  ? 'bg-white text-vela-600 shadow-xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Run a focus session from your schedule"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>Focus</span>
            </button>
          </div>

          <button
            onClick={onOpenSync}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border transition-all cursor-pointer whitespace-nowrap h-[34px] ${
              isSyncActive
                ? 'bg-vela-50 border-vela-200 text-vela-600 hover:bg-vela-100/70'
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
            title={userEmail ? `Synced as ${userEmail}` : 'Sync across devices'}
          >
            {isSyncActive ? <Cloud className="w-4 h-4 text-vela-600 animate-pulse" /> : <CloudOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{isSyncActive ? 'Synced' : 'Sync'}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setIsMoreOpen((v) => !v)}
              className="flex items-center justify-center w-[34px] h-[34px] rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all"
              title="More"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMoreOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsMoreOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white border border-stone-200 rounded-md shadow-lg z-40 py-1 animate-scale-in origin-top-right text-xs font-semibold text-stone-700">
                  <button
                    onClick={() => {
                      onExport?.();
                      setIsMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-stone-500" /> Export Backup (JSON)
                  </button>
                  <button
                    onClick={() => {
                      onImport?.();
                      setIsMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-50 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-stone-500" /> Import Backup (JSON)
                  </button>
                  <div className="my-1 border-t border-stone-100" />
                  <button
                    onClick={() => {
                      onReset?.();
                      setIsMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset to Defaults
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
