import React, { useState, useEffect } from 'react';
import { ScheduledEvent } from '../types';
import { Play, Pause, RotateCcw, CheckCircle, X, Clock } from 'lucide-react';
import { formatTime12h } from '../utils/timeUtils';
import { playTimerCompletionChime, playBreakStartChime } from '../utils/soundUtils';

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
  // Find current active event or next upcoming event
  const uncompletedEvents = events.filter((e) => !e.isCompleted);
  const [activeEventIndex, setActiveEventIndex] = useState(0);

  const activeEvent = uncompletedEvents[activeEventIndex] || events[0];

  const totalDurationSeconds = activeEvent
    ? (activeEvent.endMinutes - activeEvent.startMinutes) * 60
    : 1500;

  const [secondsRemaining, setSecondsRemaining] = useState(totalDurationSeconds);
  const [isRunning, setIsRunning] = useState(false);

  // Reset seconds remaining when the active event actually changes. Keyed on id,
  // not the object itself — every schedule regeneration produces new object
  // references for unchanged events, and keying on the object would silently
  // reset/pause an in-progress timer whenever unrelated data changed elsewhere
  // in the app (e.g. adding a task in the sidebar) while this modal was open.
  useEffect(() => {
    if (activeEvent) {
      setSecondsRemaining((activeEvent.endMinutes - activeEvent.startMinutes) * 60);
      setIsRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent?.id]);

  // Countdown timer loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            // Play chime tone
            if (activeEvent?.category === 'pomodoro_study') {
              playBreakStartChime();
            } else {
              playTimerCompletionChime();
            }
            if (activeEvent) {
              onEventComplete(activeEvent.id);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, secondsRemaining, activeEvent, onEventComplete]);

  if (!activeEvent) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white border border-stone-200 p-6 rounded-lg text-center space-y-4 max-w-sm shadow-lg animate-scale-in">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
          <h3 className="text-lg font-bold text-stone-800">All Scheduled Events Completed!</h3>
          <p className="text-xs text-stone-500">Great job navigating your SensōToki schedule today.</p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-vela-600 text-white font-bold text-xs rounded-md shadow-xs"
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

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-white border border-stone-200 rounded-lg p-6 md:p-8 shadow-lg relative space-y-6 animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header info */}
        <div className="text-center space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-vela-50 text-vela-700 border border-vela-200">
            {activeEvent.category.replace('_', ' ')} · Focus Session
          </span>
          <h2 className="font-display font-semibold text-xl md:text-2xl text-stone-800 mt-2">
            {activeEvent.title}
          </h2>
          <p className="text-xs text-stone-500 flex items-center justify-center gap-1.5 font-semibold">
            <Clock className="w-3.5 h-3.5" />
            {formatTime12h(activeEvent.startTime)} — {formatTime12h(activeEvent.endTime)}
          </p>
        </div>

        {/* Circular Countdown Display */}
        <div className="relative w-56 h-56 md:w-64 md:h-64 mx-auto flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--color-stone-200)"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--color-vela-600)"
              strokeWidth="6"
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
            <span className="text-[11px] text-stone-500 font-bold mt-1">
              {isRunning ? 'Session Active' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => {
              setSecondsRemaining(totalDurationSeconds);
              setIsRunning(false);
            }}
            className="p-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors border border-stone-200"
            title="Reset Timer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsRunning(!isRunning)}
            className="px-8 py-3.5 bg-vela-600 hover:bg-vela-700 text-white font-bold text-sm rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-98"
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
            onClick={() => {
              playTimerCompletionChime();
              onEventComplete(activeEvent.id);
            }}
            className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition-colors"
            title="Mark Completed"
          >
            <CheckCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Next Upcoming Events Queue */}
        <div className="border-t border-stone-100 pt-4 space-y-2">
          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            Up Next In Queue
          </h4>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {uncompletedEvents.slice(1, 4).map((ev, idx) => (
              <div
                key={ev.id}
                className="bg-stone-50 border border-stone-200 p-2 rounded-md text-xs flex items-center justify-between text-stone-700"
              >
                <div className="truncate">
                  <span className="font-bold text-stone-800">{ev.title}</span>
                </div>
                <span className="text-[10px] font-semibold text-stone-500 shrink-0 ml-2">
                  {formatTime12h(ev.startTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
