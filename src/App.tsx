import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { UserScheduleData, ScheduledEvent, EventCategory } from './types';
import {
  loadUserData,
  saveUserData,
  clearUserData,
  exportUserDataAsJSON,
  DEFAULT_USER_DATA,
} from './utils/storage';
import { generateOptimizedSchedule } from './utils/schedulerEngine';
import { getTodayStr } from './utils/timeUtils';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TimelineView } from './components/TimelineView';
import { FocusTimerModal } from './components/FocusTimerModal';
import { EventModal } from './components/EventModal';
import { UndoToast } from './components/UndoToast';
import { updateHabitFrictionOnTaskDone, getCategoryFrictionMultiplier } from './utils/habitML';
import { parse } from 'date-fns';

import { saveScheduleBySyncCode, db } from './lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { SyncModal } from './components/SyncModal';

// Categories with no stored per-occurrence identity of their own — always
// rebuilt fresh from sleep/meal/pomodoro settings, so deleting an instance
// has to be recorded as an exclusion (see buildExclusionKey) rather than a
// plain array removal.
const GENERATED_CATEGORIES = new Set<EventCategory>([
  'meal',
  'nap',
  'pomodoro_study',
  'pomodoro_break',
  'core_sleep',
  'decompression',
]);

export default function App() {
  const [userData, rawSetUserData] = useState<UserScheduleData>(() => loadUserData());

  // Wrapper setter that automatically injects updatedAt whenever any local edit is made
  const setUserData = useCallback((value: UserScheduleData | ((prev: UserScheduleData) => UserScheduleData)) => {
    rawSetUserData((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      return {
        ...next,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const [pastStates, setPastStates] = useState<UserScheduleData[]>([]);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);

  // Auto-dismiss any toast after a fixed delay. Centralized here (rather than a
  // setTimeout at each setToast call site) so every toast — undo, event saved,
  // Habit ML update — behaves consistently; previously only the undo toast had
  // an auto-dismiss timer and the rest stayed on screen indefinitely.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const [currentDateStr, setCurrentDateStr] = useState<string>(() => getTodayStr());
  const [activeTab, setActiveTab] = useState<'timeline' | 'focus'>('timeline');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Modals & Active Edit States
  const [editingEvent, setEditingEvent] = useState<ScheduledEvent | null>(null);
  const [creatingSlotTime, setCreatingSlotTime] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [draftEvents, setDraftEvents] = useState<ScheduledEvent[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncCode, setSyncCode] = useState<string | null>(() => localStorage.getItem('chronoscheduler_sync_code'));
  const hasLoadedCloudData = useRef(!syncCode);
  const lastSeenCloudTimestamp = useRef<string>('');

  // Sync state change handler
  const handleSyncCodeChange = (newCode: string | null) => {
    setSyncCode(newCode);
    if (newCode) {
      localStorage.setItem('chronoscheduler_sync_code', newCode);
      hasLoadedCloudData.current = false;
      lastSeenCloudTimestamp.current = '';
    } else {
      localStorage.removeItem('chronoscheduler_sync_code');
      hasLoadedCloudData.current = true;
      lastSeenCloudTimestamp.current = '';
    }
  };

  // Set up real-time Firebase syncing via Sync Code
  useEffect(() => {
    if (!syncCode) {
      hasLoadedCloudData.current = true;
      return;
    }

    const docRef = doc(db, 'sync_schedules', syncCode.toUpperCase().trim());
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data() as UserScheduleData;
        lastSeenCloudTimestamp.current = cloudData.updatedAt || '';

        rawSetUserData((prevLocal) => {
          const localTime = prevLocal.updatedAt ? new Date(prevLocal.updatedAt).getTime() : 0;
          const cloudTime = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;

          // If cloud timestamp is strictly newer, accept cloud data
          if (cloudTime > localTime) {
            return {
              ...prevLocal,
              ...cloudData,
              fixedAnchors: cloudData.fixedAnchors || [],
              oneTimeCommitments: cloudData.oneTimeCommitments || [],
              dynamicTasks: cloudData.dynamicTasks || [],
              weeklyChores: cloudData.weeklyChores || [],
              scheduledEvents: cloudData.scheduledEvents || {},
            };
          }
          // If local data is newer, keep local data and queue an upload to keep cloud in sync
          if (localTime > cloudTime) {
            saveScheduleBySyncCode(syncCode, prevLocal).catch((err) => {
              console.error('Failed to resolve newer local offline changes to cloud:', err);
            });
          }
          return prevLocal;
        });
      }
      hasLoadedCloudData.current = true;
    }, (err) => {
      console.error('Snapshot subscription error:', err);
      // Fail-safe: allow editing offline if we hit permission or network errors
      hasLoadedCloudData.current = true;
    });

    return unsubscribe;
  }, [syncCode]);

  // Helper to update UserData while pushing to Undo History Stack
  const updateUserDataWithHistory = (
    updater: (prev: UserScheduleData) => UserScheduleData,
    toastMsg?: string
  ) => {
    setUserData((prev) => {
      const next = updater(prev);
      setPastStates((history) => [...history.slice(-9), prev]); // cap at 10 states
      return next;
    });
    if (toastMsg) {
      setToast({ message: toastMsg, id: Date.now() });
    }
  };

  const handleUndo = () => {
    if (pastStates.length === 0) return;
    const previous = pastStates[pastStates.length - 1];
    setPastStates((prev) => prev.slice(0, -1));
    setUserData(previous);
    setToast({ message: 'Action undone!', id: Date.now() });
  };

  // Save to localStorage and push to cloud whenever userData changes
  useEffect(() => {
    saveUserData(userData);

    if (syncCode) {
      if (!hasLoadedCloudData.current) {
        // Prevent stale local data from overwriting cloud on startup/connect
        return;
      }

      const localTime = userData.updatedAt ? new Date(userData.updatedAt).getTime() : 0;
      const cloudTime = lastSeenCloudTimestamp.current ? new Date(lastSeenCloudTimestamp.current).getTime() : 0;

      // Only write to cloud if local is genuinely newer than what we last saw in the cloud
      if (localTime > cloudTime) {
        saveScheduleBySyncCode(syncCode, userData).then(() => {
          // Update last seen cloud timestamp to match what we just wrote
          lastSeenCloudTimestamp.current = userData.updatedAt || '';
        }).catch((err) => {
          console.error('Error syncing local change to cloud:', err);
        });
      }
    }
  }, [userData, syncCode]);

  // Derive target day of week (0=Sun, 1=Mon, ..., 6=Sat)
  const targetDayOfWeek = useMemo(() => {
    try {
      const d = parse(currentDateStr, 'yyyy-MM-dd', new Date());
      return d.getDay();
    } catch {
      return 1;
    }
  }, [currentDateStr]);

  // Compute schedule result for current date.
  // If user has saved/committed events for currentDateStr, use them directly (updating isPast and stats).
  // Otherwise, fallback to generating an optimized schedule fresh.
  const scheduleResult = useMemo(() => {
    const savedEvents = userData.scheduledEvents[currentDateStr];
    if (savedEvents !== undefined) {
      const todayStr = getTodayStr();
      const isToday = currentDateStr === todayStr;
      const now = new Date();
      const currentMins = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

      const events: ScheduledEvent[] = savedEvents.map((ev) => ({
        ...ev,
        dateStr: currentDateStr,
        isPast: isToday && ev.endMinutes <= currentMins,
      }));

      let totalSleepMinutes = 0;
      let totalStudyMinutes = 0;
      let totalLectureMinutes = 0;
      let totalMealMinutes = 0;
      let totalTaskMinutes = 0;

      for (const ev of events) {
        const dur = Math.max(0, ev.endMinutes - ev.startMinutes);
        if (ev.category === 'core_sleep' || ev.category === 'nap') {
          totalSleepMinutes += dur;
        } else if (ev.category === 'pomodoro_study') {
          totalStudyMinutes += dur;
        } else if (ev.category === 'lecture') {
          totalLectureMinutes += dur;
        } else if (ev.category === 'meal') {
          totalMealMinutes += dur;
        } else if (ev.category === 'task' || ev.category === 'transit' || ev.category === 'chore') {
          totalTaskMinutes += dur;
        }
      }

      const allocatedMinutes = events.reduce((acc, ev) => acc + Math.max(0, ev.endMinutes - ev.startMinutes), 0);
      const freeMinutes = Math.max(0, 1440 - allocatedMinutes);
      const utilizationPercent = Math.round((allocatedMinutes / 1440) * 100);

      return {
        events,
        unscheduledItems: [],
        stats: {
          totalSleepMinutes,
          totalStudyMinutes,
          totalLectureMinutes,
          totalMealMinutes,
          totalTaskMinutes,
          freeMinutes,
          utilizationPercent,
        },
      };
    }

    return generateOptimizedSchedule(userData, currentDateStr, targetDayOfWeek);
  }, [userData, currentDateStr, targetDayOfWeek]);

  // When in draft mode, update or generate draft events for whatever date is selected
  useEffect(() => {
    if (isDraftMode) {
      const fresh = generateOptimizedSchedule(userData, currentDateStr, targetDayOfWeek);
      const draftWithFlag = fresh.events.map((ev) => ({ ...ev, isDraft: true }));
      setDraftEvents(draftWithFlag);
    } else {
      setDraftEvents(null);
    }
  }, [currentDateStr, isDraftMode, targetDayOfWeek]);

  // Action: Generate / Re-optimize Schedule (saves into Draft state)
  const handleGenerateSchedule = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const updatedData: UserScheduleData = {
        ...userData,
        excludedSlots: {
          ...userData.excludedSlots,
          [currentDateStr]: (userData.excludedSlots?.[currentDateStr] || []).filter(
            (k) => !k.startsWith('pomo')
          ),
        },
      };
      setUserData(updatedData);
      const fresh = generateOptimizedSchedule(updatedData, currentDateStr, targetDayOfWeek);
      const draftWithFlag = fresh.events.map((ev) => ({ ...ev, isDraft: true }));
      setDraftEvents(draftWithFlag);
      setIsDraftMode(true);
      setIsGenerating(false);
    }, 200);
  };

  // Action: Commit Draft Schedule to Live Persistence
  const handleCommitDraft = () => {
    if (!draftEvents) return;
    const committedEvents = draftEvents.map((ev) => ({ ...ev, isDraft: false }));
    setUserData((prev) => ({
      ...prev,
      scheduledEvents: {
        ...prev.scheduledEvents,
        [currentDateStr]: committedEvents,
      },
    }));
    setIsDraftMode(false);
    setDraftEvents(null);
  };

  // Action: Discard Draft
  const handleDiscardDraft = () => {
    setIsDraftMode(false);
    setDraftEvents(null);
  };

  // Action: Toggle Pin Event & Recalculate
  const handleTogglePinEvent = (targetEvent: ScheduledEvent) => {
    const nextIsPinned = !targetEvent.isPinned;
    const currentList = draftEvents || scheduleResult.events;

    const nextEvents = currentList.map((ev) => {
      if (ev.id === targetEvent.id) {
        return {
          ...ev,
          isPinned: nextIsPinned,
          pinnedStartTime: nextIsPinned ? ev.startTime : undefined,
        };
      }
      return ev;
    });

    let updatedTasks = userData.dynamicTasks;
    if (targetEvent.parentTaskId) {
      updatedTasks = userData.dynamicTasks.map((t) => {
        if (t.id === targetEvent.parentTaskId) {
          return {
            ...t,
            isPinned: nextIsPinned,
            pinnedStartTime: nextIsPinned ? targetEvent.startTime : undefined,
            pinnedDateStr: nextIsPinned ? currentDateStr : undefined,
          };
        }
        return t;
      });
    }

    const updatedData: UserScheduleData = {
      ...userData,
      dynamicTasks: updatedTasks,
      scheduledEvents: {
        ...userData.scheduledEvents,
        [currentDateStr]: nextEvents,
      },
    };

    setUserData(updatedData);
    const fresh = generateOptimizedSchedule(updatedData, currentDateStr, targetDayOfWeek);
    const draftWithFlag = fresh.events.map((ev) => ({ ...ev, isDraft: true }));
    setIsDraftMode(true);
    setDraftEvents(draftWithFlag);
  };

  // Event updates (completion, drag, edit) with Habit ML learning
  const handleEventUpdate = (updatedEvent: ScheduledEvent) => {
    // Resolve completion from the incoming update only — never OR it against the
    // event's previous `status`, or un-completing an event could never actually
    // clear 'done' (status would stay 'done' forever since the old value survives
    // the ...updatedEvent spread untouched), permanently locking it as immutable
    // in future schedule regenerations and re-triggering the Habit ML update below.
    const resolvedIsCompleted = updatedEvent.isCompleted ?? (updatedEvent.status === 'done');

    const updatedEventWithStatus: ScheduledEvent = {
      ...updatedEvent,
      isCompleted: resolvedIsCompleted,
      status: resolvedIsCompleted ? 'done' : 'pending',
    };

    if (draftEvents) {
      setDraftEvents((prevDraft) => {
        if (!prevDraft) return null;
        const exists = prevDraft.some((ev) => ev.id === updatedEvent.id);
        return exists
          ? prevDraft.map((ev) =>
              ev.id === updatedEvent.id
                ? { ...updatedEventWithStatus, isDraft: true }
                : ev
            )
          : [...prevDraft, { ...updatedEventWithStatus, isDraft: true }];
      });
    }

    updateUserDataWithHistory((prev) => {
      const existingSavedEvents = prev.scheduledEvents[currentDateStr] || [];
      const currentActiveEvents = scheduleResult.events || [];

      // Determine base event list for today:
      // Start with existing saved events, but if updatedEvent isn't in existingSavedEvents,
      // merge with current active scheduleResult events so no generated events are lost.
      let baseList: ScheduledEvent[];
      if (existingSavedEvents.some((ev) => ev.id === updatedEvent.id)) {
        baseList = existingSavedEvents;
      } else {
        const savedIds = new Set(existingSavedEvents.map((ev) => ev.id));
        baseList = [
          ...existingSavedEvents,
          ...currentActiveEvents.filter((ev) => !savedIds.has(ev.id)),
        ];
      }

      const oldEvent = baseList.find((ev) => ev.id === updatedEvent.id);
      const wasCompleted = !!oldEvent && (oldEvent.isCompleted ?? oldEvent.status === 'done');
      const isNewlyCompleted = resolvedIsCompleted && !wasCompleted;

      const existsInBase = baseList.some((ev) => ev.id === updatedEvent.id);
      const nextEvents = existsInBase
        ? baseList.map((ev) => (ev.id === updatedEvent.id ? updatedEventWithStatus : ev))
        : [...baseList, updatedEventWithStatus];

      let nextHabitModel = prev.habitModel;

      let nextOneTimeCommitments = prev.oneTimeCommitments;
      if (updatedEvent.parentOneTimeId || updatedEvent.id.includes('otc-')) {
        const parentId = updatedEvent.parentOneTimeId || '';
        const cleanId = parentId.replace(/^otc-/, '');
        nextOneTimeCommitments = (prev.oneTimeCommitments || []).map((o) => {
          if (
            (parentId && o.id === parentId) ||
            (cleanId && o.id.replace(/^otc-/, '') === cleanId) ||
            updatedEvent.id.includes(o.id)
          ) {
            return { ...o, isCompleted: resolvedIsCompleted };
          }
          return o;
        });
      }

      let nextDynamicTasks = prev.dynamicTasks;
      const targetTaskId = updatedEvent.parentTaskId;
      if (targetTaskId || updatedEvent.id.includes('task-')) {
        const cleanId = (targetTaskId || '').replace(/^task-/, '');
        nextDynamicTasks = prev.dynamicTasks.map((t) => {
          if (
            (targetTaskId && t.id === targetTaskId) ||
            (cleanId && t.id.replace(/^task-/, '') === cleanId) ||
            updatedEvent.id.includes(t.id)
          ) {
            return { ...t, isCompleted: resolvedIsCompleted };
          }
          return t;
        });
      }

      if (isNewlyCompleted) {
        const plannedDuration = Math.max(
          10,
          updatedEvent.endMinutes - updatedEvent.startMinutes
        );
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        let actualDuration = plannedDuration;
        if (currentDateStr === todayStr) {
          const currentMins = now.getHours() * 60 + now.getMinutes();
          actualDuration = Math.max(10, currentMins - updatedEvent.startMinutes);
        }

        nextHabitModel = updateHabitFrictionOnTaskDone(
          prev.habitModel,
          updatedEvent.category,
          plannedDuration,
          actualDuration
        );

        const newMult = getCategoryFrictionMultiplier(nextHabitModel, updatedEvent.category);
        const percent = Math.round(newMult * 100);
        setToast({
          message: `Task completed! Habit ML updated ${updatedEvent.category} friction multiplier to ${percent}% (${newMult.toFixed(2)}x)`,
          id: Date.now(),
        });
      }

      return {
        ...prev,
        oneTimeCommitments: nextOneTimeCommitments,
        dynamicTasks: nextDynamicTasks,
        habitModel: nextHabitModel,
        scheduledEvents: {
          ...prev.scheduledEvents,
          [currentDateStr]: nextEvents,
        },
      };
    });
  };

  // Delete an event instance from today's schedule view.
  // Delete an event instance from today's schedule view.
  // Routes to specific handlers (anchor exceptions, task/chore deletions,
  // one-time commitment removal, or auto-generated slot exclusions) as appropriate.
  const handleEventDelete = (eventId: string) => {
    if (draftEvents) {
      setDraftEvents((prevDraft) => {
        if (!prevDraft) return null;
        return prevDraft.filter((ev) => ev.id !== eventId);
      });
    }

    const currentSaved = userData.scheduledEvents[currentDateStr] || [];
    const allEvents = [...currentSaved, ...scheduleResult.events];
    const targetEvent = allEvents.find((ev) => ev.id === eventId);

    if (targetEvent) {
      if (targetEvent.parentAnchorId || targetEvent.id.startsWith('anchor-')) {
        const anchorId = targetEvent.parentAnchorId || targetEvent.id;
        handleDeleteAnchorInstance(anchorId, targetEvent.dateStr || currentDateStr);
        return;
      }

      if (targetEvent.parentOneTimeId || targetEvent.id.startsWith('otc-')) {
        const otcId = targetEvent.parentOneTimeId || targetEvent.id;
        handleDeleteOneTimeCommitment(otcId);
        return;
      }

      if (
        targetEvent.parentTaskId ||
        targetEvent.id.startsWith('task-') ||
        targetEvent.id.startsWith('chore-')
      ) {
        const taskId = targetEvent.parentTaskId || targetEvent.id;
        handleDeleteDynamicTaskOrChore(taskId);
        return;
      }

      const exclusionKey = buildExclusionKey(targetEvent);
      if (exclusionKey || targetEvent.id.startsWith('pomo-')) {
        handleExcludeGeneratedSlot(targetEvent);
        return;
      }
    }

    updateUserDataWithHistory((prev) => {
      const currentEvents = prev.scheduledEvents[currentDateStr] || scheduleResult.events;
      const nextEvents = currentEvents.filter((ev) => ev.id !== eventId);
      return {
        ...prev,
        scheduledEvents: {
          ...prev.scheduledEvents,
          [currentDateStr]: nextEvents,
        },
      };
    }, 'Event removed');
  };

  // Delete a single instance of a recurring anchor (Exceptions). Adding the
  // date to deletedDates is what actually matters — the anchor still exists,
  // so Step 1 of the scheduler would otherwise just rebuild this exact
  // occurrence again on the very next render. Also purge any already-
  // committed copy of it (e.g. if the user had pinned or completed it),
  // since Step 0A-1's pull-forward doesn't consult deletedDates.
  const handleDeleteAnchorInstance = (anchorId: string, dateStr: string) => {
    updateUserDataWithHistory((prev) => {
      const cleanId = anchorId.replace(/^anchor-/, '').replace(/-p[12]$/, '');
      const matchedIds = new Set(
        prev.fixedAnchors
          .filter((a) => a.id === anchorId || a.id.replace(/^anchor-/, '') === cleanId)
          .map((a) => a.id)
      );
      matchedIds.add(anchorId);
      matchedIds.add(`anchor-${cleanId}`);
      matchedIds.add(cleanId);

      const updatedAnchors = prev.fixedAnchors.map((anchor) => {
        if (matchedIds.has(anchor.id) || anchor.id.replace(/^anchor-/, '') === cleanId) {
          const existing = anchor.deletedDates || [];
          if (!existing.includes(dateStr)) {
            return { ...anchor, deletedDates: [...existing, dateStr] };
          }
        }
        return anchor;
      });
      const dayEvents = prev.scheduledEvents[dateStr];
      const scheduledEvents = dayEvents
        ? {
            ...prev.scheduledEvents,
            [dateStr]: dayEvents.filter(
              (ev) => !ev.parentAnchorId || (!matchedIds.has(ev.parentAnchorId) && ev.parentAnchorId.replace(/^anchor-/, '') !== cleanId)
            ),
          }
        : prev.scheduledEvents;
      return { ...prev, fixedAnchors: updatedAnchors, scheduledEvents };
    }, `Instance canceled for ${dateStr}`);
    setDraftEvents(null);
  };

  // One-time commitments don't recur, so "delete" always means "remove it
  // entirely" — there's no single-occurrence concept to exclude.
  const handleDeleteOneTimeCommitment = (otcId: string) => {
    updateUserDataWithHistory((prev) => {
      const scheduledEvents: typeof prev.scheduledEvents = {};
      for (const [dateStr, events] of Object.entries(prev.scheduledEvents)) {
        scheduledEvents[dateStr] = events.filter((ev) => ev.parentOneTimeId !== otcId);
      }
      return {
        ...prev,
        oneTimeCommitments: (prev.oneTimeCommitments || []).filter((o) => o.id !== otcId),
        scheduledEvents,
      };
    }, 'Event deleted');
    setDraftEvents(null);
  };

  // Dynamic tasks and weekly chores are one-off todos, not day-scoped
  // recurrences, so deleting a rendered instance means removing the task/
  // chore itself. parentTaskId is shared between the two, so only one of
  // these filters ever actually matches for a given id.
  const handleDeleteDynamicTaskOrChore = (taskId: string) => {
    updateUserDataWithHistory((prev) => {
      const scheduledEvents: typeof prev.scheduledEvents = {};
      for (const [dateStr, events] of Object.entries(prev.scheduledEvents)) {
        scheduledEvents[dateStr] = events.filter((ev) => ev.parentTaskId !== taskId);
      }
      return {
        ...prev,
        dynamicTasks: prev.dynamicTasks.filter((t) => t.id !== taskId),
        weeklyChores: prev.weeklyChores.filter((c) => c.id !== taskId),
        scheduledEvents,
      };
    }, 'Task deleted');
    setDraftEvents(null);
  };

  // Builds the exclusion key for an auto-generated event's category (see
  // UserScheduleData.excludedSlots), or null if this category has no
  // per-occurrence identity to exclude by.
  const buildExclusionKey = (event: ScheduledEvent): string | null => {
    switch (event.category) {
      case 'decompression':
        return 'decompression';
      case 'core_sleep':
        return 'core_sleep';
      case 'meal': {
        const match = event.id.match(/^meal-(breakfast|lunch|snacks|dinner)-/);
        if (match) return `meal-${match[1]}`;
        const titleLower = event.title.toLowerCase();
        if (titleLower.includes('breakfast')) return 'meal-breakfast';
        if (titleLower.includes('lunch')) return 'meal-lunch';
        if (titleLower.includes('snack')) return 'meal-snacks';
        if (titleLower.includes('dinner')) return 'meal-dinner';
        return null;
      }
      case 'nap': {
        const match = event.id.match(/^nap-(\d+)-/);
        return match ? `nap-${match[1]}` : null;
      }
      case 'pomodoro_study':
      case 'pomodoro_break': {
        return `pomo:${event.startMinutes}-${event.endMinutes}`;
      }
      default:
        return null;
    }
  };

  // Meals/naps/pomodoro/core sleep/decompression have no per-occurrence
  // identity of their own — they're rebuilt fresh from settings every time.
  // To make a specific deleted instance actually stay gone, record its
  // exclusion key for this date so future regenerations skip recreating it,
  // instead of just removing the rendered copy (which the scheduler engine
  // itself already refuses to leave stale — see isOrphanedEvent).
  const handleExcludeGeneratedSlot = (event: ScheduledEvent) => {
    const key = buildExclusionKey(event);
    const dateStr = event.dateStr || currentDateStr;
    updateUserDataWithHistory((prev) => {
      const existing = (prev.excludedSlots && prev.excludedSlots[dateStr]) || [];
      const keysToAdd: string[] = [];
      if (key && !existing.includes(key)) {
        keysToAdd.push(key);
      }
      const pomoMatch = event.id.match(/^(pomo-(?:work|break)-\d+)/);
      if (pomoMatch && !existing.includes(pomoMatch[1]) && !keysToAdd.includes(pomoMatch[1])) {
        keysToAdd.push(pomoMatch[1]);
      }

      const newExcludedKeys = [...existing, ...keysToAdd];
      const excludedSlots = { ...(prev.excludedSlots || {}), [dateStr]: newExcludedKeys };
      const dayEvents = prev.scheduledEvents[dateStr] || scheduleResult.events;
      const scheduledEvents = {
        ...prev.scheduledEvents,
        [dateStr]: dayEvents.filter((ev) => ev.id !== event.id),
      };
      return { ...prev, excludedSlots, scheduledEvents };
    }, 'Removed from today\'s schedule');
    setDraftEvents(null);
  };

  // Undo all of today's manual removals of auto-generated blocks, letting
  // meals/naps/pomodoro/sleep/decompression fill back in normally.
  const handleClearExclusions = () => {
    updateUserDataWithHistory((prev) => {
      const excludedSlots = { ...(prev.excludedSlots || {}) };
      delete excludedSlots[currentDateStr];
      const scheduledEvents = { ...(prev.scheduledEvents || {}) };
      delete scheduledEvents[currentDateStr];
      return { ...prev, excludedSlots, scheduledEvents };
    }, 'Restored auto-fill for today');
    setDraftEvents(null);
  };

  // Delete entire recurring anchor series
  const handleDeleteAnchorSeries = (anchorId: string) => {
    updateUserDataWithHistory((prev) => {
      const cleanId = anchorId.replace(/^anchor-/, '').replace(/-p[12]$/, '');
      const deletedIds = new Set(
        prev.fixedAnchors
          .filter((a) => a.id === anchorId || a.id.replace(/^anchor-/, '') === cleanId)
          .map((a) => a.id)
      );
      deletedIds.add(anchorId);
      deletedIds.add(`anchor-${cleanId}`);
      deletedIds.add(cleanId);

      const scheduledEvents: typeof prev.scheduledEvents = {};
      for (const [dateStr, events] of Object.entries(prev.scheduledEvents)) {
        scheduledEvents[dateStr] = events.filter(
          (ev) => !ev.parentAnchorId || (!deletedIds.has(ev.parentAnchorId) && ev.parentAnchorId.replace(/^anchor-/, '') !== cleanId)
        );
      }
      return {
        ...prev,
        fixedAnchors: prev.fixedAnchors.filter(
          (a) => a.id !== anchorId && a.id.replace(/^anchor-/, '') !== cleanId
        ),
        scheduledEvents,
      };
    }, 'Recurring series deleted');
    setDraftEvents(null);
  };

  // Create custom manual event
  const handleSaveCustomEvent = (newEvent: ScheduledEvent) => {
    if (draftEvents) {
      setDraftEvents((prevDraft) => {
        if (!prevDraft) return null;
        const existingIndex = prevDraft.findIndex((ev) => ev.id === newEvent.id);
        if (existingIndex >= 0) {
          return prevDraft.map((ev, i) => (i === existingIndex ? { ...newEvent, isDraft: true } : ev));
        } else {
          return [...prevDraft, { ...newEvent, isDraft: true }];
        }
      });
    }

    updateUserDataWithHistory((prev) => {
      const currentEvents = prev.scheduledEvents[currentDateStr] || scheduleResult.events;
      const existingIndex = currentEvents.findIndex((ev) => ev.id === newEvent.id);
      let nextEvents: ScheduledEvent[];
      if (existingIndex >= 0) {
        nextEvents = currentEvents.map((ev, i) => (i === existingIndex ? newEvent : ev));
      } else {
        nextEvents = [...currentEvents, newEvent];
      }
      return {
        ...prev,
        scheduledEvents: {
          ...prev.scheduledEvents,
          [currentDateStr]: nextEvents,
        },
      };
    }, 'Event saved');
  };

      {/* Create / Edit Event Modal */}

  // Reset to Defaults
  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all schedule settings to defaults?')) {
      clearUserData();
      setUserData(DEFAULT_USER_DATA);
    }
  };

  // Export JSON
  const handleExport = () => {
    exportUserDataAsJSON(userData);
  };

  // Import JSON
  const handleImportTrigger = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === 'object') {
          setUserData(parsed);
          alert('Schedule configuration imported successfully!');
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-screen w-screen bg-stone-100 text-stone-900 flex flex-col font-sans select-none overflow-hidden">
      {/* Hidden File Input for JSON Backup Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="application/json"
        className="hidden"
      />

      {/* Top Header */}
      <Header
        currentDateStr={currentDateStr}
        onDateChange={setCurrentDateStr}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onGenerateSchedule={handleGenerateSchedule}
        onExport={handleExport}
        onImport={handleImportTrigger}
        onReset={handleResetToDefaults}
        isGenerating={isGenerating}
        isSyncActive={!!syncCode}
        userEmail={syncCode}
        onOpenSync={() => setIsSyncModalOpen(true)}
      />

      {/* Main Content Workspace (Sidebar + Viewport) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar Input Panel */}
        <Sidebar
          data={userData}
          onUpdateData={(newData) => updateUserDataWithHistory(() => newData)}
          onGenerateSchedule={handleGenerateSchedule}
          isOpen={isSidebarOpen}
          onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Viewport Content */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {activeTab === 'timeline' && (
            <TimelineView
              events={draftEvents || scheduleResult.events}
              unscheduledItems={scheduleResult.unscheduledItems}
              stats={scheduleResult.stats}
              currentDateStr={currentDateStr}
              isDraftSchedule={!!draftEvents}
              onCommitDraft={handleCommitDraft}
              onDiscardDraft={handleDiscardDraft}
              onReoptimizeDay={handleGenerateSchedule}
              onTogglePinEvent={handleTogglePinEvent}
              onEventClick={(ev) => setEditingEvent(ev)}
              onEventUpdate={handleEventUpdate}
              onEventDelete={handleEventDelete}
              onCreateSlotClick={(slotTime) => setCreatingSlotTime(slotTime)}
              hasExclusionsToday={!!userData.excludedSlots?.[currentDateStr]?.length}
              onClearExclusions={handleClearExclusions}
            />
          )}

          {activeTab === 'focus' && (
            <FocusTimerModal
              events={draftEvents || scheduleResult.events}
              onClose={() => setActiveTab('timeline')}
              onEventComplete={(eventId) => {
                const activeEvents = draftEvents || scheduleResult.events;
                const target = activeEvents.find((e) => e.id === eventId);
                if (target) {
                  handleEventUpdate({ ...target, isCompleted: true });
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Create / Edit Event Modal */}
      {(editingEvent || creatingSlotTime) && (
        <EventModal
          event={editingEvent}
          defaultStartTime={creatingSlotTime || '10:00'}
          dateStr={currentDateStr}
          onSave={handleSaveCustomEvent}
          onDelete={handleEventDelete}
          onDeleteAnchorInstance={handleDeleteAnchorInstance}
          onDeleteAnchorSeries={handleDeleteAnchorSeries}
          onExcludeGeneratedSlot={handleExcludeGeneratedSlot}
          onClose={() => {
            setEditingEvent(null);
            setCreatingSlotTime(null);
          }}
        />
      )}

      {/* Global Undo Toast */}
      {toast && (
        <UndoToast
          message={toast.message}
          onUndo={handleUndo}
          onClose={() => setToast(null)}
        />
      )}

      {/* Synchronization Modal */}
      {isSyncModalOpen && (
        <SyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          currentLocalData={userData}
          onCloudDataFetched={(cloudData) => {
            lastSeenCloudTimestamp.current = cloudData.updatedAt || '';
            hasLoadedCloudData.current = true;
            rawSetUserData(cloudData);
          }}
          syncCode={syncCode}
          onSyncCodeChange={handleSyncCodeChange}
        />
      )}
    </div>
  );
}
