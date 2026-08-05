import React, { useState, useEffect, useRef } from 'react';
import { ScheduledEvent, UnscheduledItem } from '../types';
import {
  minutesToTime,
  formatTime12h,
  getCategoryStyles,
  formatDuration,
} from '../utils/timeUtils';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Trash2,
  Moon,
  BookOpen,
  Utensils,
  Sparkles,
  Bus,
  Check,
  Pin,
  X,
  FileCheck,
  Repeat,
} from 'lucide-react';

interface TimelineViewProps {
  events: ScheduledEvent[];
  unscheduledItems: UnscheduledItem[];
  stats: {
    totalSleepMinutes: number;
    totalStudyMinutes: number;
    totalLectureMinutes: number;
    totalMealMinutes: number;
    totalTaskMinutes: number;
    freeMinutes: number;
    utilizationPercent: number;
  };
  currentDateStr: string;
  isDraftSchedule?: boolean;
  onCommitDraft?: () => void;
  onDiscardDraft?: () => void;
  onReoptimizeDay?: () => void;
  onEventClick: (event: ScheduledEvent) => void;
  onEventUpdate: (updatedEvent: ScheduledEvent) => void;
  onEventDelete: (eventId: string) => void;
  onTogglePinEvent?: (event: ScheduledEvent) => void;
  onCreateSlotClick: (startTime: string) => void;
  hasExclusionsToday?: boolean;
  onClearExclusions?: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  events,
  unscheduledItems,
  stats,
  currentDateStr,
  isDraftSchedule,
  onCommitDraft,
  onDiscardDraft,
  onReoptimizeDay,
  onEventClick,
  onEventUpdate,
  onEventDelete,
  onTogglePinEvent,
  onCreateSlotClick,
  hasExclusionsToday,
  onClearExclusions,
}) => {
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update real-time indicator line
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStrNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      if (dateStrNow === currentDateStr) {
        setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
      } else {
        setCurrentTimeMinutes(null);
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 30000); // refresh every 30s
    return () => clearInterval(timer);
  }, [currentDateStr]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Handle slot click for quick creation
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickRatio = Math.max(0, Math.min(offsetY / rect.height, 1));
    const clickMinutes = Math.floor(clickRatio * 1440);
    // Snap to 15m interval
    const snappedMins = Math.floor(clickMinutes / 15) * 15;
    onCreateSlotClick(minutesToTime(snappedMins));
  };

  // Toggle complete state
  const handleToggleComplete = (e: React.MouseEvent, event: ScheduledEvent) => {
    e.stopPropagation();
    onEventUpdate({
      ...event,
      isCompleted: !event.isCompleted,
    });
  };


  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-stone-50 text-stone-900">
      {/* Draft Schedule Notice Banner */}
      {isDraftSchedule && (
        <div className="bg-amber-500 text-stone-950 px-4 py-2.5 rounded-lg shadow-md flex items-center justify-between gap-3 shrink-0 border border-amber-600">
          <div className="flex items-center gap-2">
            <span className="bg-stone-950 text-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wide shrink-0">
              DRAFT PREVIEW
            </span>
            <span className="text-xs font-bold text-stone-950">
              Proposed schedule generated in draft state. Review and commit changes to finalize!
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDiscardDraft}
              className="px-3 py-1 bg-white hover:bg-stone-100 text-stone-900 text-xs font-bold rounded shadow-xs transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Discard
            </button>
            <button
              onClick={onCommitDraft}
              className="px-3 py-1 bg-stone-950 hover:bg-stone-900 text-white text-xs font-bold rounded shadow-xs transition-colors flex items-center gap-1"
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" /> Commit Schedule
            </button>
          </div>
        </div>
      )}
      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-xs hover:shadow-sm hover:border-stone-300 transition-all">
          <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1 mb-1">
            <Moon className="w-3.5 h-3.5 text-stone-600" /> Sleep Reserved
          </div>
          <div className="text-xl font-display font-semibold text-stone-900 tabular-nums">
            {formatDuration(stats.totalSleepMinutes)}
          </div>
          <div className="text-[10px] text-stone-400 font-medium mt-0.5">Core Sleep + Naps</div>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-xs hover:shadow-sm hover:border-stone-300 transition-all">
          <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Focus Study
          </div>
          <div className="text-xl font-display font-semibold text-stone-900 tabular-nums">
            {formatDuration(stats.totalStudyMinutes)}
          </div>
          <div className="text-[10px] text-stone-400 font-medium mt-0.5">Elastic 50-60m / 15-20m Break</div>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-xs hover:shadow-sm hover:border-stone-300 transition-all">
          <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1 mb-1">
            <Repeat className="w-3.5 h-3.5 text-rose-500" /> Routines
          </div>
          <div className="text-xl font-display font-semibold text-stone-900 tabular-nums">
            {formatDuration(stats.totalLectureMinutes)}
          </div>
          <div className="text-[10px] text-stone-400 font-medium mt-0.5">Fixed Recurring Anchors</div>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-xs hover:shadow-sm hover:border-stone-300 transition-all">
          <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1 mb-1">
            <Utensils className="w-3.5 h-3.5 text-amber-600" /> Mess & Meals
          </div>
          <div className="text-xl font-display font-semibold text-stone-900 tabular-nums">
            {formatDuration(stats.totalMealMinutes)}
          </div>
          <div className="text-[10px] text-stone-400 font-medium mt-0.5">Nutritional Windows</div>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-xs hover:shadow-sm hover:border-stone-300 transition-all">
          <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1 mb-1">
            <Bus className="w-3.5 h-3.5 text-stone-600" /> Tasks & Transit
          </div>
          <div className="text-xl font-display font-semibold text-stone-900 tabular-nums">
            {formatDuration(stats.totalTaskMinutes)}
          </div>
          <div className="text-[10px] text-stone-400 font-medium mt-0.5">Errands + Travel Buffer</div>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-xs hover:shadow-sm hover:border-stone-300 transition-all flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5 text-vela-600" /> Utilization
            </div>
            <div className="text-xl font-display font-semibold text-vela-600 tabular-nums">
              {stats.utilizationPercent}%
            </div>
            <div className="text-[10px] text-stone-400 font-medium mt-0.5">
              {formatDuration(stats.freeMinutes)} Unfilled
            </div>
          </div>
          {onReoptimizeDay && (
            <button
              onClick={onReoptimizeDay}
              className="mt-2 w-full bg-vela-600 hover:bg-vela-700 text-white font-bold text-[11px] py-1.5 px-2 rounded flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              title="Re-run scheduling engine to fill freed gaps with study blocks and dynamic tasks"
            >
              <Sparkles className="w-3 h-3 text-amber-300" /> Re-optimize Free Space
            </button>
          )}
          {hasExclusionsToday && onClearExclusions && (
            <button
              onClick={onClearExclusions}
              className="mt-1.5 w-full bg-white hover:bg-stone-50 text-stone-600 font-bold text-[11px] py-1.5 px-2 rounded border border-stone-200 flex items-center justify-center gap-1.5 transition-colors"
              title="Undo today's manual removals of meals, naps, pomodoro blocks, sleep, or decompression"
            >
              Restore Auto-Fill
            </button>
          )}
        </div>
      </div>

      {/* Unscheduled Warnings Banner */}
      {unscheduledItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded border border-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                {unscheduledItems.length} Item(s) Could Not Be Placed Automatically
              </h4>
              <ul className="mt-1 space-y-1 text-xs text-amber-800 font-medium">
                {unscheduledItems.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <strong className="font-bold">{item.title}:</strong> {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Interactive 24-Hour Timeline Canvas */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 md:p-6 shadow-xs relative">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-vela-600" />
            <span className="font-display font-semibold text-sm text-stone-800">
              Today, hour by hour
            </span>
          </div>
          <span className="text-[11px] font-medium text-stone-400 hidden sm:inline">
            Click empty space to add event • Click event for details
          </span>
        </div>

        {/* Timeline Grid Container */}
        <div className="relative flex min-h-[2880px]" ref={containerRef} onClick={handleTimelineClick}>
          {/* Hour Ruler (Left column) */}
          <div className="w-16 md:w-20 shrink-0 border-r border-stone-200 select-none">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-[120px] border-b border-stone-100 text-[10px] text-stone-400 font-bold pr-3 text-right pt-1"
              >
                {minutesToTime(hour * 60)}
              </div>
            ))}
          </div>

          {/* Events Area (Right column) */}
          <div className="flex-1 relative bg-stone-50/50 cursor-crosshair">
            {/* Horizontal Grid lines */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-[120px] border-b border-stone-200/60 pointer-events-none"
              />
            ))}

            {/* Current Real-Time Red Indicator Line */}
            {currentTimeMinutes !== null && (
              <div
                className="absolute left-0 right-0 z-20 border-t-2 border-red-500 flex items-center pointer-events-none transition-all duration-500"
                style={{ top: `${(currentTimeMinutes / 1440) * 100}%` }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.25 shadow" />
                <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs ml-2">
                  NOW {minutesToTime(currentTimeMinutes)}
                </span>
              </div>
            )}

            {/* Render Scheduled Events with Side-By-Side Overlap Column Positioning */}
            {(() => {
              // Group and calculate side-by-side column positions for overlapping events
              // MIN_VISUAL_MINUTES ensures that cards forced to min-height (44px = 22 mins) trigger column splits if overlapping
              const MIN_VISUAL_MINUTES = 22;
              const getEffectiveEndMinutes = (ev: ScheduledEvent) => {
                return Math.max(ev.endMinutes, ev.startMinutes + MIN_VISUAL_MINUTES);
              };

              const sorted = [...events].sort((a, b) => {
                if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
                return (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes);
              });

              const clusters: ScheduledEvent[][] = [];
              let currentCluster: ScheduledEvent[] = [];
              let clusterEnd = -1;

              for (const ev of sorted) {
                const effEnd = getEffectiveEndMinutes(ev);
                if (currentCluster.length === 0) {
                  currentCluster.push(ev);
                  clusterEnd = effEnd;
                } else if (ev.startMinutes < clusterEnd) {
                  currentCluster.push(ev);
                  clusterEnd = Math.max(clusterEnd, effEnd);
                } else {
                  clusters.push(currentCluster);
                  currentCluster = [ev];
                  clusterEnd = effEnd;
                }
              }
              if (currentCluster.length > 0) {
                clusters.push(currentCluster);
              }

              const positionedEvents: Array<{
                event: ScheduledEvent;
                topPercent: number;
                heightPercent: number;
                colIndex: number;
                totalCols: number;
              }> = [];

              for (const cluster of clusters) {
                const columns: ScheduledEvent[][] = [];
                for (const ev of cluster) {
                  let placed = false;
                  for (let c = 0; c < columns.length; c++) {
                    const lastInCol = columns[c][columns[c].length - 1];
                    if (getEffectiveEndMinutes(lastInCol) <= ev.startMinutes) {
                      columns[c].push(ev);
                      placed = true;
                      break;
                    }
                  }
                  if (!placed) {
                    columns.push([ev]);
                  }
                }

                const totalCols = columns.length;
                columns.forEach((colEvents, colIndex) => {
                  for (const ev of colEvents) {
                    const topPercent = (ev.startMinutes / 1440) * 100;
                    const durationMins = Math.max(15, ev.endMinutes - ev.startMinutes);
                    const heightPercent = (durationMins / 1440) * 100;

                    positionedEvents.push({
                      event: ev,
                      topPercent,
                      heightPercent,
                      colIndex,
                      totalCols,
                    });
                  }
                });
              }

              return positionedEvents.map(({ event, topPercent, heightPercent, colIndex, totalCols }) => {
                // Actual duration for display text; layout sizing separately floors
                // to 15m so very short events stay visible (see durationMins below).
                const actualDurationMins = event.endMinutes - event.startMinutes;
                const durationMins = Math.max(15, actualDurationMins);
                const styles = getCategoryStyles(event.category, event.title);
                const isShort = durationMins < 40;

                const widthPercent = (1 / totalCols) * 98;
                const leftPercent = (colIndex / totalCols) * 100 + 0.5;

                return (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    style={{
                      top: `${topPercent}%`,
                      height: `${heightPercent}%`,
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                    className={`absolute rounded-lg border shadow-xs transition-all z-10 cursor-pointer group min-h-[44px] ${
                      isShort ? 'px-2 py-1' : 'p-2.5 md:p-3'
                    } ${styles.bg} ${styles.border} ${styles.borderLeft} ${
                      event.isDraft || isDraftSchedule ? 'border-dashed border-2 border-amber-500' : ''
                    } ${
                      event.isCompleted ? 'opacity-60 grayscale' : event.isPast ? 'opacity-70 saturate-50 bg-stone-100/90' : ''
                    } hover:z-30 hover:shadow-md`}
                  >
                    {isShort ? (
                      /* Refined Compact Layout for Short Duration Cards (< 40m) */
                      <div className="flex flex-col justify-center gap-0.5 h-full overflow-hidden text-xs">
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <span className={`text-[8px] md:text-[9px] font-extrabold uppercase tracking-wider px-1 py-0.2 rounded border shrink-0 ${styles.badge}`}>
                              {event.category.replace('_', ' ')}
                            </span>
                            {event.isLocked && (
                              <Lock className="w-3 h-3 text-vela-900 opacity-70 shrink-0" title="Locked Anchor" />
                            )}
                            {event.isPinned && (
                              <Pin className="w-3 h-3 text-amber-600 fill-amber-500 shrink-0" title="Pinned Event Anchor" />
                            )}
                            <h5 className={`font-bold text-[11px] md:text-xs truncate leading-tight ${event.isCompleted ? 'line-through text-stone-500' : 'text-stone-800'}`}>
                              {event.title}
                            </h5>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            {!event.isLocked && onTogglePinEvent && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTogglePinEvent(event);
                                }}
                                className={`p-0.5 rounded border transition-colors ${
                                  event.isPinned
                                    ? 'bg-amber-500 text-white border-amber-600'
                                    : 'bg-white hover:bg-stone-100 text-stone-600 border-stone-300'
                                }`}
                                title={event.isPinned ? 'Unpin Event' : 'Pin Event & Recalculate'}
                              >
                                <Pin className="w-2.5 h-2.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleToggleComplete(e, event)}
                              className={`p-0.5 rounded border transition-colors ${
                                event.isCompleted
                                  ? 'bg-emerald-600 text-white border-emerald-700'
                                  : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
                              }`}
                              title={event.isCompleted ? 'Mark Incomplete' : 'Mark Completed'}
                            >
                              <Check className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventDelete(event.id);
                              }}
                              className="p-0.5 rounded bg-white hover:bg-red-50 text-stone-500 hover:text-red-600 border border-stone-300 transition-colors"
                              title="Delete Event"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Full Time Range clearly displayed on 2nd line */}
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-stone-700 min-w-0">
                          <Clock className="w-2.5 h-2.5 text-stone-500 shrink-0" />
                          <span className="truncate">
                            {formatTime12h(event.startTime)} – {formatTime12h(event.endTime)} ({formatDuration(actualDurationMins)})
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Standard Vertical Layout for Taller Cards (>= 40m) */
                      <div className="flex flex-col justify-between gap-1.5 h-full overflow-hidden">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${styles.badge}`}>
                                {event.category.replace('_', ' ')}
                              </span>
                              {event.isLocked && (
                                <span title="Fixed Anchor">
                                  <Lock className="w-3 h-3 text-vela-900 opacity-70" />
                                </span>
                              )}
                              {event.isPinned && (
                                <span title="Pinned to Time Slot" className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-0.5">
                                  <Pin className="w-2.5 h-2.5 fill-amber-600" /> Pinned
                                </span>
                              )}
                              {event.isCompleted && (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-0.5" title="Done (Immutable Anchor)">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done (Anchored)
                                </span>
                              )}
                              {!!event.frictionAppliedMinutes && event.frictionAppliedMinutes > 0 && (
                                <span className="bg-purple-100 text-purple-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-purple-200" title="Adaptive ML friction buffer added based on learned completion habits">
                                  +{event.frictionAppliedMinutes}m ML Buffer
                                </span>
                              )}
                            </div>

                            {/* Quick Action Buttons on hover */}
                            <div className="flex items-center gap-1 shrink-0">
                              {!event.isLocked && onTogglePinEvent && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePinEvent(event);
                                  }}
                                  className={`p-1 rounded border transition-colors ${
                                    event.isPinned
                                      ? 'bg-amber-500 text-white border-amber-600'
                                      : 'bg-white hover:bg-stone-100 text-stone-600 border-stone-300'
                                  }`}
                                  title={event.isPinned ? 'Unpin Event' : 'Pin Event & Recalculate'}
                                >
                                  <Pin className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={(e) => handleToggleComplete(e, event)}
                                className={`p-1 rounded border transition-colors ${
                                  event.isCompleted
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
                                }`}
                                title={event.isCompleted ? 'Mark Incomplete' : 'Mark Completed'}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEventDelete(event.id);
                                }}
                                className="p-1 rounded bg-white hover:bg-red-50 text-stone-500 hover:text-red-600 border border-stone-300 transition-colors"
                                title="Delete Event"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h5 className={`font-bold text-xs md:text-sm leading-tight text-stone-800 break-words ${event.isCompleted ? 'line-through text-stone-500' : ''}`}>
                            {event.title}
                          </h5>

                          <p className="text-[11px] font-semibold text-stone-600 flex items-center gap-1 pt-0.5">
                            <Clock className="w-3.5 h-3.5 text-vela-600 shrink-0" />
                            {formatTime12h(event.startTime)} — {formatTime12h(event.endTime)} ({formatDuration(actualDurationMins)})
                          </p>

                          {event.notes && (
                            <p className="text-[10px] text-stone-500 leading-normal line-clamp-2 pt-0.5">
                              {event.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
