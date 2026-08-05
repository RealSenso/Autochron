import React, { useState } from 'react';
import { ScheduledEvent, EventCategory } from '../types';
import { X, Clock, Lock, Unlock, Trash2, Sparkles, Pencil, CheckCircle2 } from 'lucide-react';
import { formatTime12h, timeToMinutes, minutesToTime } from '../utils/timeUtils';

interface EventModalProps {
  event: ScheduledEvent | null; // null if creating new
  defaultStartTime?: string;
  dateStr: string;
  onSave: (event: ScheduledEvent) => void;
  onDelete?: (eventId: string) => void;
  onDeleteAnchorInstance?: (anchorId: string, dateStr: string) => void;
  onDeleteAnchorSeries?: (anchorId: string) => void;
  onExcludeGeneratedSlot?: (event: ScheduledEvent) => void;
  onClose: () => void;
}

const categoryLabels: Record<EventCategory, string> = {
  core_sleep: 'Core Sleep',
  nap: 'Everyman Nap',
  lecture: 'Recurring Routine Anchor',
  meal: 'Meal Window',
  task: 'Task / Errand',
  pomodoro_study: 'Pomodoro Study',
  pomodoro_break: 'Pomodoro Break',
  transit: 'Transit / Buffer',
  decompression: 'Decompression / Wind-down',
  chore: 'Chore / Weekly Routine',
  custom: 'Custom Activity',
};

const getCategoryStyles = (cat: EventCategory) => {
  switch (cat) {
    case 'core_sleep':
    case 'nap':
      return { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' };
    case 'lecture':
      return { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' };
    case 'meal':
      return { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    case 'task':
      return { bg: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' };
    case 'pomodoro_study':
      return { bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' };
    case 'pomodoro_break':
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
    case 'transit':
      return { bg: 'bg-stone-50 text-stone-600 border-stone-200', dot: 'bg-stone-500' };
    case 'decompression':
      return { bg: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' };
    case 'chore':
      return { bg: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' };
    default:
      return { bg: 'bg-stone-50 text-stone-700 border-stone-200', dot: 'bg-stone-500' };
  }
};


export const EventModal: React.FC<EventModalProps> = ({
  event,
  defaultStartTime = '10:00',
  dateStr,
  onSave,
  onDelete,
  onDeleteAnchorInstance,
  onDeleteAnchorSeries,
  onExcludeGeneratedSlot,
  onClose,
}) => {
  const [isEditMode, setIsEditMode] = useState(!event);
  
  const [title, setTitle] = useState(event?.title || 'Custom Session');
  const [category, setCategory] = useState<EventCategory>(event?.category || 'custom');
  const [startTime, setStartTime] = useState(event?.startTime || defaultStartTime);
  const [endTime, setEndTime] = useState(
    event?.endTime || minutesToTime(timeToMinutes(defaultStartTime) + 60)
  );
  const [isLocked, setIsLocked] = useState(event?.isLocked || false);
  const [overrideSleep, setOverrideSleep] = useState(event?.overrideSleep || false);
  const [notes, setNotes] = useState(event?.notes || '');
  const [color, setColor] = useState(event?.color || '#6366f1');
  const [isCompleted, setIsCompleted] = useState(event?.isCompleted || event?.status === 'done' || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sMins = timeToMinutes(startTime);
    let eMins = timeToMinutes(endTime);
    if (eMins <= sMins) eMins = sMins + 30; // safety

    const updatedEvent: ScheduledEvent = {
      id: event?.id || `custom-event-${Date.now()}`,
      title: title.trim() || 'Untitled Session',
      category,
      startTime,
      endTime,
      startMinutes: sMins,
      endMinutes: eMins,
      dateStr,
      color,
      isLocked,
      overrideSleep,
      isCompleted,
      status: isCompleted ? 'done' : 'pending',
      notes: notes.trim() || undefined,
      isPinned: true,
    };

    onSave(updatedEvent);
    onClose();
  };

  // Duration calculation for display
  const getDurationDisplay = () => {
    let startVal = startTime;
    let endVal = endTime;
    if (event) {
      startVal = event.startTime;
      endVal = event.endTime;
    }
    const duration = Math.max(0, timeToMinutes(endVal) - timeToMinutes(startVal));
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${mins > 0 ? `${mins}m` : ''}` || '0m';
  };

  const catStyle = getCategoryStyles(category);

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-stone-200 rounded-lg p-6 w-full max-w-md shadow-lg space-y-5 text-stone-800 transition-all animate-scale-in">
        
        {/* HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="font-display font-semibold text-sm text-stone-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-vela-600" />
            {isEditMode ? (
              <span>{event ? 'Edit Scheduled Event' : 'Create Custom Event'}</span>
            ) : (
              <span>Event Details</span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* VIEW MODE */}
        {!isEditMode && event ? (
          <div className="space-y-5 text-xs">
            {/* Title & Category Badge */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h2 className="text-base font-bold text-stone-800 tracking-tight leading-snug break-words max-w-[70%]">
                  {event.title}
                </h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getCategoryStyles(event.category).bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${getCategoryStyles(event.category).dot}`}></span>
                  {categoryLabels[event.category] || event.category}
                </span>
              </div>

              {/* Time Interval & Duration Card */}
              <div className="flex items-center gap-3 text-stone-600 bg-stone-50 p-3 rounded-md border border-stone-100">
                <Clock className="w-4 h-4 text-stone-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-stone-700">
                    {formatTime12h(event.startTime)} – {formatTime12h(event.endTime)}
                  </span>
                  <span className="text-[10px] font-semibold text-stone-400">
                    Duration: {getDurationDisplay()} • {dateStr}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes / Details */}
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Notes / Details</h4>
              <div className="bg-stone-50/50 border border-stone-200/60 p-3 rounded-md text-stone-600 leading-relaxed">
                {event.notes ? (
                  <p className="whitespace-pre-wrap">{event.notes}</p>
                ) : (
                  <p className="italic text-stone-400">No notes or details added to this event.</p>
                )}
              </div>
            </div>

            {/* Quick Toggle Settings Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Interactive Status Button */}
              <button
                type="button"
                onClick={() => {
                  const nextVal = !isCompleted;
                  setIsCompleted(nextVal);
                  const updated: ScheduledEvent = {
                    ...event,
                    isCompleted: nextVal,
                    status: nextVal ? 'done' : 'pending',
                  };
                  onSave(updated);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-md border text-left transition-all ${
                  isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${isCompleted ? 'text-emerald-600' : 'text-stone-400'}`} />
                <div className="flex flex-col">
                  <span className="font-bold">{isCompleted ? 'Completed' : 'Pending'}</span>
                  <span className="text-[8px] font-medium opacity-80">Click to toggle status</span>
                </div>
              </button>

              {/* Locked State Card */}
              <div className={`flex items-center gap-2 p-2.5 rounded-md border ${
                event.isLocked
                  ? 'bg-amber-50/50 text-amber-800 border-amber-200/60'
                  : 'bg-stone-50/50 text-stone-500 border-stone-200/50'
              }`}>
                {event.isLocked ? (
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <Unlock className="w-4 h-4 text-stone-400 shrink-0" />
                )}
                <div className="flex flex-col">
                  <span className="font-bold">{event.isLocked ? 'Hard-Locked' : 'Unlocked'}</span>
                  <span className="text-[8px] font-medium opacity-80">
                    {event.isLocked ? 'Immutable' : 'Reschedulable'}
                  </span>
                </div>
              </div>

              {/* Override Sleep Config */}
              <div className={`col-span-2 flex items-center gap-2 p-2.5 rounded-md border ${
                event.overrideSleep
                  ? 'bg-purple-50/50 text-purple-800 border-purple-200/60'
                  : 'bg-stone-50/50 text-stone-500 border-stone-200/50'
              }`}>
                <Sparkles className={`w-4 h-4 shrink-0 ${event.overrideSleep ? 'text-purple-600' : 'text-stone-400'}`} />
                <div className="flex flex-col">
                  <span className="font-bold">
                    {event.overrideSleep ? 'Sleep Override Active' : 'Obeys Sleep Constraints'}
                  </span>
                  <span className="text-[8px] font-medium opacity-80">
                    {event.overrideSleep ? 'Bypasses sleep cycle collisions' : 'Will adjust around sleep'}
                  </span>
                </div>
              </div>

              {/* ML Buffer Note */}
              {!!event.frictionAppliedMinutes && event.frictionAppliedMinutes > 0 && (
                <div className="col-span-2 flex items-center gap-2 p-2.5 rounded-md border bg-purple-50/60 text-purple-900 border-purple-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shrink-0"></div>
                  <div className="flex flex-col">
                    <span className="font-bold">Habit Friction Delay Buffer (+{event.frictionAppliedMinutes}m)</span>
                    <span className="text-[8px] font-medium opacity-80">
                      Adaptive cushion added based on previous completion speed for {event.category} tasks.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER ACTIONS */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-100 flex-wrap">
              {event && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(event.parentAnchorId || event.id.startsWith('anchor-') || event.category === 'lecture') && onDeleteAnchorInstance && onDeleteAnchorSeries && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const anchorId = event.parentAnchorId || event.id.replace(/^anchor-/, '').replace(new RegExp(`-${dateStr}(?:-p[12])?$`), '');
                          onDeleteAnchorInstance(anchorId, dateStr);
                          onClose();
                        }}
                        className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-300 text-[10px] font-bold transition-colors"
                        title="Cancel this routine anchor for today only (won't regenerate today)"
                      >
                        Cancel Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const anchorId = event.parentAnchorId || event.id.replace(/^anchor-/, '').replace(new RegExp(`-${dateStr}(?:-p[12])?$`), '');
                          onDeleteAnchorSeries(anchorId);
                          onClose();
                        }}
                        className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 text-[10px] font-bold transition-colors"
                        title="Delete this entire recurring routine series"
                      >
                        Delete Series
                      </button>
                    </>
                  )}

                  {['meal', 'nap', 'pomodoro_study', 'pomodoro_break', 'core_sleep', 'decompression'].includes(event.category) && onExcludeGeneratedSlot && (
                    <button
                      type="button"
                      onClick={() => {
                        onExcludeGeneratedSlot(event);
                        onClose();
                      }}
                      className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-300 text-[10px] font-bold transition-colors"
                      title="Exclude this slot for today only (won't regenerate today)"
                    >
                      Cancel Today
                    </button>
                  )}

                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(event.id);
                        onClose();
                      }}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-md border border-red-200 transition-colors"
                      title="Remove from today's schedule view"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-md border border-stone-200 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className="px-4 py-2 bg-vela-600 hover:bg-vela-700 text-white font-bold rounded-md shadow-xs flex items-center gap-1.5 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Event</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* EDIT MODE (FORM) */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-[11px] font-bold text-stone-600 block mb-1">Event Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-md px-3 py-2 text-stone-800 focus:outline-none focus:border-vela-600 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-md px-3 py-2 text-stone-800 text-xs focus:outline-none focus:border-vela-600"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-600 block mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-md px-3 py-2 text-stone-800 text-xs focus:outline-none focus:border-vela-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-600 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full bg-white border border-stone-200 rounded-md px-3 py-2 text-stone-800 text-xs focus:outline-none focus:border-vela-600"
              >
                <option value="lecture">Recurring Routine Anchor</option>
                <option value="meal">Meal Window</option>
                <option value="task">Task / Errand</option>
                <option value="pomodoro_study">Pomodoro Study</option>
                <option value="pomodoro_break">Pomodoro Break</option>
                <option value="core_sleep">Core Sleep</option>
                <option value="nap">Everyman Nap</option>
                <option value="transit">Transit / Buffer</option>
                <option value="decompression">Decompression / Wind-down</option>
                <option value="chore">Chore / Weekly Routine</option>
                <option value="custom">Custom Activity</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-600 block mb-1">Notes / Details</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Chapter 4 study goals or classroom number"
                className="w-full bg-white border border-stone-200 rounded-md p-2.5 text-stone-800 text-xs focus:outline-none focus:border-vela-600"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-stone-700">
                <input
                  type="checkbox"
                  checked={isLocked}
                  onChange={(e) => setIsLocked(e.target.checked)}
                  className="rounded border-stone-300 text-vela-600 focus:ring-vela-600"
                />
                <span className="text-xs font-semibold">Hard-Lock Anchor (Prevent Overwriting)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-stone-700">
                <input
                  type="checkbox"
                  checked={overrideSleep}
                  onChange={(e) => setOverrideSleep(e.target.checked)}
                  className="rounded border-stone-300 text-vela-600 focus:ring-vela-600"
                />
                <span className="text-xs font-semibold">Override Sleep (Bypass/Suppress Polyphasic Sleep)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-stone-700">
                <input
                  type="checkbox"
                  checked={isCompleted}
                  onChange={(e) => setIsCompleted(e.target.checked)}
                  className="rounded border-stone-300 text-vela-600 focus:ring-vela-600"
                />
                <span className="text-xs font-semibold">Mark as Completed / Archive as Done</span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-100 flex-wrap">
              {event && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(event.parentAnchorId || event.id.startsWith('anchor-') || event.category === 'lecture') && onDeleteAnchorInstance && onDeleteAnchorSeries && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const anchorId = event.parentAnchorId || event.id.replace(/^anchor-/, '').replace(new RegExp(`-${dateStr}(?:-p[12])?$`), '');
                          onDeleteAnchorInstance(anchorId, dateStr);
                          onClose();
                        }}
                        className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-300 text-[10px] font-bold transition-colors"
                        title="Cancel this routine anchor for today only (won't regenerate today)"
                      >
                        Cancel Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const anchorId = event.parentAnchorId || event.id.replace(/^anchor-/, '').replace(new RegExp(`-${dateStr}(?:-p[12])?$`), '');
                          onDeleteAnchorSeries(anchorId);
                          onClose();
                        }}
                        className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 text-[10px] font-bold transition-colors"
                        title="Delete this entire recurring routine series"
                      >
                        Delete Series
                      </button>
                    </>
                  )}

                  {['meal', 'nap', 'pomodoro_study', 'pomodoro_break', 'core_sleep', 'decompression'].includes(event.category) && onExcludeGeneratedSlot && (
                    <button
                      type="button"
                      onClick={() => {
                        onExcludeGeneratedSlot(event);
                        onClose();
                      }}
                      className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-300 text-[10px] font-bold transition-colors"
                      title="Exclude this slot for today only (won't regenerate today)"
                    >
                      Cancel Today
                    </button>
                  )}

                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(event.id);
                        onClose();
                      }}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-md border border-red-200 transition-colors"
                      title="Remove from today's schedule view"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={event ? () => setIsEditMode(false) : onClose}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-md text-xs border border-stone-200 transition-colors"
                >
                  {event ? 'Back to View' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-vela-600 hover:bg-vela-700 text-white font-bold rounded-md text-xs shadow-xs transition-all"
                >
                  Save Event
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
