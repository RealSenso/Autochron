import React, { useState, useEffect, useMemo } from 'react';
import { ScheduledEvent } from '../types';
import { Play, Pause, RotateCcw, CheckCircle, X, Clock, Plus, Minus, ChevronDown, Check } from 'lucide-react';
import { formatTime12h } from '../utils/timeUtils';
import { playTimerCompletionChime, playBreakStartChime, playTickSound } from '../utils/soundUtils';

interface FocusTimerModalProps {
  events: ScheduledEvent[];
  onClose: () => void;
  onEventComplete: (eventId: string) => void;
}

export const FocusTimerModal: React.FC<FocusTimerModalProps> = ({
  events,
  onClose,
  onEventComplete,
}) => {
  // Sort events chronologically
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.startMinutes - b.startMinutes);
  }, [events]);

  // Determine initial active event based on current real time or next upcoming
  const defaultEvent = useMemo(() => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    // 1. Current active event happening now (uncompleted)
    const ongoing = sortedEvents.find(
      (e) => !e.isCompleted && e.startMinutes <= currentMins && currentMins < e.endMinutes
    );
    if (ongoing) return ongoing;

    // 2. Next upcoming uncompleted event today
    const upcoming = sortedEvents.find((e) => !e.isCompleted && e.startMinutes > currentMins);
    if (upcoming) return upcoming;

    // 3. First uncompleted event overall
    const firstUncompleted = sortedEvents.find((e) => !e.isCompleted);
    if (firstUncompleted) return firstUncompleted;

    // 4. Fallback to first event
    return sortedEvents[0] || null;
  }, [sortedEvents]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(defaultEvent?.id || null);

  // Fallback to defaultEvent if selected event no longer exists
  const activeEvent = useMemo(() => {
    return sortedEvents.find((e) => e.id === selectedEventId) || defaultEvent;
  }, [sortedEvents, selectedEventId, defaultEvent]);

  // Calculate default total duration in seconds
  const defaultDurationSeconds = useMemo(() => {
    return activeEvent ? Math.max(300, (activeEvent.endMinutes - activeEvent.startMinutes) * 60) : 1500;
  }, [activeEvent]);

  const [totalDurationSeconds, setTotalDurationSeconds] = useState(defaultDurationSeconds);
  const [secondsRemaining, setSecondsRemaining] = useState(defaultDurationSeconds);
  const [isRunning, setIsRunning] = useState(false);

  // Sync state when active event changes
  useEffect(() => {
    setTotalDurationSeconds(defaultDurationSeconds);
    setSecondsRemaining(defaultDurationSeconds);
    setIsRunning(false);
  }, [activeEvent?.id, defaultDurationSeconds]);

  // Handle countdown timer loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, secondsRemaining]);

  // Handle completion when timer hits zero
  useEffect(() => {
    if (secondsRemaining === 0 && isRunning) {
      setIsRunning(false);
      if (activeEvent?.category === 'pomodoro_study') {
        playBreakStartChime();
      } else {
        playTimerCompletionChime();
      }
      if (activeEvent) {
        onEventComplete(activeEvent.id);
      }
    }
  }, [secondsRemaining, isRunning, activeEvent, onEventComplete]);

  // Quick duration adjustments (+5m, -5m)
  const adjustTime = (deltaMins: number) => {
    playTickSound();
    const deltaSecs = deltaMins * 60;
    setSecondsRemaining((prev) => Math.max(60, prev + deltaSecs));
    setTotalDurationSeconds((prev) => Math.max(60, prev + deltaSecs));
  };

  const handleTogglePlay = () => {
    playTickSound();
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    playTickSound();
    setIsRunning(false);
    setSecondsRemaining(defaultDurationSeconds);
    setTotalDurationSeconds(defaultDurationSeconds);
  };

  const handleManualComplete = () => {
    playTimerCompletionChime();
    if (activeEvent) {
      onEventComplete(activeEvent.id);
    }
  };

  if (!activeEvent) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white border border-stone-200 p-6 rounded-xl text-center space-y-4 max-w-sm shadow-xl animate-scale-in">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
          <h3 className="text-lg font-bold text-stone-800">All Scheduled Events Completed!</h3>
          <p className="text-xs text-stone-500">Great job navigating your schedule today.</p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-vela-600 hover:bg-vela-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
          >
            Close Focus Mode
          </button>
        </div>
      </div>
    );
  }

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const progressPercent = Math.min(
    100,
    Math.max(0, ((totalDurationSeconds - secondsRemaining) / totalDurationSeconds) * 100)
  );

  const uncompletedEvents = sortedEvents.filter((e) => !e.isCompleted);
  const queueEvents = sortedEvents.filter((e) => e.id !== activeEvent.id);

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg bg-white border border-stone-200 rounded-2xl p-6 md:p-8 shadow-xl relative space-y-6 my-auto animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          title="Close Focus Mode"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header & Event Dropdown Selector */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-vela-50 text-vela-700 border border-vela-200/80 text-[11px] font-bold uppercase tracking-wider">
            <span>{activeEvent.category.replace('_', ' ')}</span>
            <span>·</span>
            <span>Focus Session</span>
          </div>

          {/* Selector Dropdown */}
          <div className="relative inline-block w-full max-w-md mx-auto">
            <select
              value={activeEvent.id}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full text-center font-display font-semibold text-lg md:text-xl text-stone-800 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-vela-500/20 cursor-pointer appearance-none transition-colors truncate"
            >
              {sortedEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.isCompleted ? '✓ ' : ''}{ev.title} ({formatTime12h(ev.startTime)})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <p className="text-xs text-stone-500 flex items-center justify-center gap-1.5 font-semibold">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            {formatTime12h(activeEvent.startTime)} — {formatTime12h(activeEvent.endTime)}
          </p>
        </div>

        {/* Circular Countdown Display */}
        <div className="relative w-52 h-52 md:w-60 md:h-60 mx-auto flex items-center justify-center my-2">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--color-stone-200)"
              strokeWidth="5"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--color-vela-600)"
              strokeWidth="5"
              strokeDasharray="263.89"
              strokeDashoffset={263.89 - (263.89 * progressPercent) / 100}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-4xl md:text-5xl font-bold font-mono text-stone-800 tracking-tight">
              {formattedTime}
            </span>
            <span
              className={`text-[11px] font-bold mt-1 px-2 py-0.5 rounded-full ${
                isRunning
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-stone-100 text-stone-500 border border-stone-200'
              }`}
            >
              {isRunning ? 'Session Active' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Time Adjustments */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => adjustTime(-5)}
            disabled={secondsRemaining <= 60}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-40 rounded-lg text-xs font-bold transition-colors border border-stone-200 flex items-center gap-1 cursor-pointer"
            title="Subtract 5 minutes"
          >
            <Minus className="w-3.5 h-3.5" /> 5m
          </button>
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Adjust</span>
          <button
            onClick={() => adjustTime(5)}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors border border-stone-200 flex items-center gap-1 cursor-pointer"
            title="Add 5 minutes"
          >
            <Plus className="w-3.5 h-3.5" /> 5m
          </button>
        </div>

        {/* Main Controls Bar */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleReset}
            className="p-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors border border-stone-200 cursor-pointer"
            title="Reset Timer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={handleTogglePlay}
            className={`px-8 py-3.5 font-bold text-sm rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-98 cursor-pointer ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-vela-600 hover:bg-vela-700 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5" /> Pause Session
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" /> Start Focus
              </>
            )}
          </button>

          <button
            onClick={handleManualComplete}
            className={`p-3 rounded-xl border transition-colors cursor-pointer ${
              activeEvent.isCompleted
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
            }`}
            title={activeEvent.isCompleted ? 'Completed' : 'Mark Completed'}
          >
            <CheckCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Clickable Queue Section */}
        {queueEvents.length > 0 && (
          <div className="border-t border-stone-100 pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                Select Session / Up Next ({uncompletedEvents.length} remaining)
              </h4>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {queueEvents.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => {
                    playTickSound();
                    setSelectedEventId(ev.id);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer ${
                    ev.isCompleted
                      ? 'bg-stone-50/70 border-stone-200 text-stone-400'
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200/90 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {ev.isCompleted ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-vela-500 shrink-0" />
                    )}
                    <span className={`font-semibold truncate ${ev.isCompleted ? 'line-through' : 'text-stone-800'}`}>
                      {ev.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-stone-400 shrink-0 ml-2">
                    {formatTime12h(ev.startTime)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

