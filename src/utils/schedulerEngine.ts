import {
  UserScheduleData,
  ScheduledEvent,
  ScheduleGenerationResult,
  UnscheduledItem,
  EventCategory,
  MealWindow,
  DynamicTask,
  WeeklyChore,
} from '../types';
import {
  timeToMinutes,
  minutesToTime,
  isOverlapping,
  formatDuration,
  getTodayStr,
  getPreviousDateStr,
  getPreviousDayOfWeek,
} from './timeUtils';
import { getEffectiveTaskDuration } from './habitML';

interface FreeInterval {
  start: number; // minutes from midnight (0..1440)
  end: number;
}

const SLACK_BUFFER_MINUTES = 10;

/**
 * Deterministic, modular scheduling engine that generates a 24-hour timeline.
 * 
 * Pipeline Stages:
 * 1. Spilling Overlap from Yesterday (Core sleep/anchors crossing midnight)
 * 2. Immutable Done & Pinned User Events
 * 3. Guilt-Free Decompression Wind-down
 * 4. Fixed Academic Anchors & One-Time Date Commitments
 * 5. Everyman Core Sleep (Current Day)
 * 6. Meal Windows (Breakfast, Lunch, Snacks, Dinner)
 * 7. Everyman Power Naps
 * 8. Dynamic Tasks, Errands & Assigned Chores (Best-fit with cascade buffer)
 * 9. Elastic Pomodoro Study & Mandatory Break Auto-fill
 * 10. Metrics & Utilization Summary
 */
export function generateOptimizedSchedule(
  data: UserScheduleData,
  dateStr: string,
  targetDayOfWeek: number // 0 = Sun, 1 = Mon, ..., 6 = Sat
): ScheduleGenerationResult {
  const events: ScheduledEvent[] = [];
  const unscheduledItems: UnscheduledItem[] = [];

  // Time awareness calculations
  const todayStr = getTodayStr();
  const isToday = dateStr === todayStr;
  const now = new Date();
  const currentMins = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

  // Track occupied minute intervals (0 to 1440)
  const occupiedIntervals: Array<{ start: number; end: number; id: string; category: EventCategory }> = [];

  // Process exclusion slots recorded for this date
  const excludedKeys = new Set((data.excludedSlots && data.excludedSlots[dateStr]) || []);
  for (const key of excludedKeys) {
    if (key.startsWith('pomo:')) {
      const [startStr, endStr] = key.slice(5).split('-');
      const s = Number(startStr);
      const e = Number(endStr);
      if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
        occupiedIntervals.push({ start: s, end: e, id: `excluded-${key}`, category: 'custom' });
      }
    }
  }

  // Helper: Check if a slot [start, end] is completely free
  const isSlotFree = (start: number, end: number): boolean => {
    if (start < 0 || end > 1440 || start >= end) return false;
    for (const occ of occupiedIntervals) {
      if (isOverlapping(start, end, occ.start, occ.end)) {
        return false;
      }
    }
    return true;
  };

  // Helper: Add event to internal state and occupied interval tracker
  const addEventToTimeline = (
    event: Omit<ScheduledEvent, 'dateStr' | 'startMinutes' | 'endMinutes'>
  ): ScheduledEvent => {
    const sMins = timeToMinutes(event.startTime);
    let eMins = timeToMinutes(event.endTime);
    if (event.endTime === '24:00') eMins = 1440;
    if (eMins <= sMins) eMins = sMins + 30; // fallback safety

    const isPast = isToday && eMins <= currentMins;

    const fullEvent: ScheduledEvent = {
      ...event,
      dateStr,
      startMinutes: sMins,
      endMinutes: eMins,
      isPast,
    };

    occupiedIntervals.push({ start: sMins, end: eMins, id: fullEvent.id, category: fullEvent.category });
    events.push(fullEvent);
    return fullEvent;
  };

  // Helper: Schedule an event that wraps past midnight on the same day canvas
  const scheduleWrappableEvent = (
    idBase: string,
    startTime: string,
    endTime: string,
    fields: Omit<ScheduledEvent, 'dateStr' | 'startMinutes' | 'endMinutes' | 'id' | 'startTime' | 'endTime'>
  ): boolean => {
    const sMins = timeToMinutes(startTime);
    const rawEnd = timeToMinutes(endTime);
    const wraps = rawEnd <= sMins;

    if (!wraps) {
      if (!isSlotFree(sMins, rawEnd)) return false;
      addEventToTimeline({ id: idBase, startTime, endTime, ...fields });
      return true;
    }

    const part1Free = isSlotFree(sMins, 1440);
    const part2Free = rawEnd > 0 ? isSlotFree(0, rawEnd) : true;
    if (!part1Free || !part2Free) return false;

    addEventToTimeline({ id: `${idBase}-p1`, startTime, endTime: '24:00', ...fields });
    if (rawEnd > 0) {
      addEventToTimeline({ id: `${idBase}-p2`, startTime: '00:00', endTime, ...fields });
    }
    return true;
  };

  // Helper: Schedule leading segment of an overnight anchor
  const scheduleLeadingSegment = (
    idBase: string,
    startTime: string,
    endTime: string,
    fields: Omit<ScheduledEvent, 'dateStr' | 'startMinutes' | 'endMinutes' | 'id' | 'startTime' | 'endTime'>
  ): boolean => {
    const sMins = timeToMinutes(startTime);
    const rawEnd = timeToMinutes(endTime);
    const wraps = rawEnd <= sMins;
    const segEndMins = wraps ? 1440 : rawEnd;
    if (!isSlotFree(sMins, segEndMins)) return false;
    addEventToTimeline({ id: wraps ? `${idBase}-p1` : idBase, startTime, endTime: wraps ? '24:00' : endTime, ...fields });
    return true;
  };

  // Helper: Schedule trailing segment of an overnight anchor
  const scheduleTrailingSegment = (
    idBase: string,
    endTime: string,
    fields: Omit<ScheduledEvent, 'dateStr' | 'startMinutes' | 'endMinutes' | 'id' | 'startTime' | 'endTime'>
  ): boolean => {
    const rawEnd = timeToMinutes(endTime);
    if (rawEnd <= 0) return true;
    if (!isSlotFree(0, rawEnd)) return false;
    addEventToTimeline({ id: `${idBase}-p2`, startTime: '00:00', endTime, ...fields });
    return true;
  };

  // Helper: Detect if a scheduled event's source parent has been deleted
  const isOrphanedEvent = (ev: ScheduledEvent): boolean => {
    if (ev.parentAnchorId && !data.fixedAnchors.some((a) => a.id === ev.parentAnchorId)) return true;
    if (ev.parentOneTimeId && !(data.oneTimeCommitments || []).some((o) => o.id === ev.parentOneTimeId)) return true;
    if (
      ev.parentTaskId &&
      !data.dynamicTasks.some((t) => t.id === ev.parentTaskId) &&
      !(data.weeklyChores || []).some((c) => c.id === ev.parentTaskId)
    ) {
      return true;
    }
    return false;
  };

  // Helper: Get free intervals sorted by start time
  const getSortedFreeIntervals = (minStartMins = 0): FreeInterval[] => {
    const sortedOcc = [...occupiedIntervals].sort((a, b) => a.start - b.start);
    const freeList: FreeInterval[] = [];

    let currentPointer = Math.max(0, minStartMins);
    for (const occ of sortedOcc) {
      if (occ.end <= currentPointer) continue;
      if (occ.start > currentPointer) {
        freeList.push({ start: currentPointer, end: occ.start });
      }
      currentPointer = Math.max(currentPointer, occ.end);
    }
    if (currentPointer < 1440) {
      freeList.push({ start: currentPointer, end: 1440 });
    }

    return freeList;
  };

  // -------------------------------------------------------------
  // STAGE 0: YESTERDAY'S OVERNIGHT SPILLOVER (Midnight Wraparound)
  // If yesterday had core sleep (e.g. 23:00 - 02:30), mark 00:00 - 02:30 today
  // -------------------------------------------------------------
  const previousDateStr = getPreviousDateStr(dateStr);
  const previousDayOfWeek = getPreviousDayOfWeek(targetDayOfWeek);

  // Yesterday's Core Sleep Spillover
  if (data.sleepConfig.enabled) {
    const prevExcluded = new Set((data.excludedSlots && data.excludedSlots[previousDateStr]) || []);
    if (!prevExcluded.has('core_sleep')) {
      const coreStartMins = timeToMinutes(data.sleepConfig.coreSleepStart);
      const coreDur = Math.max(30, data.sleepConfig.coreSleepDurationMinutes || 210);
      const coreEndMins = coreStartMins + coreDur;
      if (coreEndMins > 1440) {
        const spilloverMins = coreEndMins - 1440;
        if (spilloverMins > 0 && isSlotFree(0, spilloverMins)) {
          addEventToTimeline({
            id: `core-sleep-spillover-${dateStr}`,
            title: 'Core Sleep (Overnight Continuation)',
            category: 'core_sleep',
            startTime: '00:00',
            endTime: minutesToTime(spilloverMins),
            color: '#6366f1',
            isLocked: true,
            notes: 'Continued from previous night core sleep',
          });
        }
      }
    }
  }

  // Yesterday's Overnight Anchor Spillover
  for (const anchor of data.fixedAnchors) {
    const sMins = timeToMinutes(anchor.startTime);
    const rawEnd = timeToMinutes(anchor.endTime);
    if (rawEnd <= sMins && rawEnd > 0) {
      if (anchor.deletedDates && anchor.deletedDates.includes(previousDateStr)) continue;
      const recurredYesterday =
        !anchor.daysOfWeek || anchor.daysOfWeek.length === 0 || anchor.daysOfWeek.includes(previousDayOfWeek);
      if (!recurredYesterday) continue;

      const idBase = `anchor-${anchor.id}-${previousDateStr}`;
      if (!events.some((e) => e.id === `${idBase}-p2`)) {
        scheduleTrailingSegment(idBase, anchor.endTime, {
          title: anchor.title,
          category: 'lecture',
          color: anchor.color || (anchor.overrideSleep ? '#8b5cf6' : '#f59e0b'),
          isLocked: true,
          overrideSleep: anchor.overrideSleep,
          parentAnchorId: anchor.id,
          notes: anchor.location ? `Location: ${anchor.location}` : undefined,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // STAGE 1: IMMUTABLE DONE, PINNED & PAST USER EVENTS
  // -------------------------------------------------------------
  const existingDateEvents = data.scheduledEvents[dateStr] || [];

  // 1A. Completed / Done Events
  const doneEvents = existingDateEvents.filter(
    (ev) => (ev.isCompleted || ev.status === 'done') && !isOrphanedEvent(ev)
  );

  for (const doneEv of doneEvents) {
    if (isSlotFree(doneEv.startMinutes, doneEv.endMinutes)) {
      addEventToTimeline({
        ...doneEv,
        isCompleted: true,
        status: 'done',
        isLocked: true,
        isPinned: true,
      });
    }
  }

  // 1B. Pinned Events & Custom Manual Events
  const pinnedEvents = existingDateEvents.filter(
    (ev) =>
      !ev.isCompleted &&
      ev.status !== 'done' &&
      !isOrphanedEvent(ev) &&
      (ev.isPinned ||
        ev.id.startsWith('custom-event-') ||
        ev.id.startsWith('pinned-task-') ||
        (ev.isLocked && !['core_sleep', 'decompression', 'meal', 'nap', 'transit', 'chore'].includes(ev.category)))
  );

  for (const pinned of pinnedEvents) {
    if (isSlotFree(pinned.startMinutes, pinned.endMinutes)) {
      addEventToTimeline({
        ...pinned,
        isPinned: pinned.isPinned ?? false,
        isLocked: true,
      });
    }
  }

  // 1C. Existing Past / In-Progress Events for Today
  const pastEvents = existingDateEvents.filter(
    (ev) =>
      !ev.isCompleted &&
      ev.status !== 'done' &&
      !isOrphanedEvent(ev) &&
      !doneEvents.some((d) => d.id === ev.id) &&
      !pinnedEvents.some((p) => p.id === ev.id) &&
      isToday &&
      (ev.endMinutes <= currentMins || ev.startMinutes < currentMins)
  );

  for (const pastEv of pastEvents) {
    if (isSlotFree(pastEv.startMinutes, pastEv.endMinutes)) {
      addEventToTimeline({
        ...pastEv,
        isLocked: true,
        isPast: pastEv.endMinutes <= currentMins,
      });
    }
  }

  // 1C. Tasks pinned directly in dynamicTasks array for this date
  for (const task of data.dynamicTasks) {
    if (task.isPinned && task.pinnedDateStr === dateStr && task.pinnedStartTime) {
      const sMins = timeToMinutes(task.pinnedStartTime);
      const eMins = sMins + task.durationMinutes;
      if (isSlotFree(sMins, eMins)) {
        addEventToTimeline({
          id: `pinned-task-${task.id}-${dateStr}`,
          title: task.title,
          category: 'task',
          startTime: task.pinnedStartTime,
          endTime: minutesToTime(eMins),
          color: '#38bdf8',
          isLocked: true,
          isPinned: true,
          notes: task.notes ? `Pinned: ${task.notes}` : 'Pinned by user',
          parentTaskId: task.id,
        });
      } else {
        unscheduledItems.push({
          type: 'task',
          title: task.title,
          reason: `Pinned time (${task.pinnedStartTime}) conflicts with another locked event on timeline.`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // STAGE 2: SLEEP OVERRIDE BLOCKS & RECURRING ANCHORS
  // -------------------------------------------------------------
  const applicableAnchors = data.fixedAnchors.filter((anchor) => {
    if (anchor.deletedDates && anchor.deletedDates.includes(dateStr)) return false;
    if (!anchor.daysOfWeek || anchor.daysOfWeek.length === 0) return true;
    return anchor.daysOfWeek.includes(targetDayOfWeek);
  });

  const applicableOneTime = (data.oneTimeCommitments || []).filter(
    (otc) => otc.dateStr === dateStr
  );

  // Sleep Override Tracking
  const sleepOverrideBlocks: Array<{ start: number; end: number; title: string }> = [];
  const pushSleepOverrideBlock = (startTime: string, endTime: string, title: string) => {
    const sMins = timeToMinutes(startTime);
    const rawEnd = timeToMinutes(endTime);
    if (rawEnd <= sMins) {
      sleepOverrideBlocks.push({ start: sMins, end: 1440, title });
      if (rawEnd > 0) sleepOverrideBlocks.push({ start: 0, end: rawEnd, title });
    } else {
      sleepOverrideBlocks.push({ start: sMins, end: rawEnd, title });
    }
  };

  for (const anchor of applicableAnchors) {
    if (anchor.overrideSleep) {
      pushSleepOverrideBlock(anchor.startTime, anchor.endTime, anchor.title);
    }
  }
  for (const otc of applicableOneTime) {
    if (otc.overrideSleep) {
      pushSleepOverrideBlock(otc.startTime, otc.endTime, otc.title);
    }
  }

  const isOverriddenByLongTravel = (startMins: number, endMins: number): boolean => {
    for (const block of sleepOverrideBlocks) {
      if (isOverlapping(startMins, endMins, block.start, block.end)) {
        return true;
      }
    }
    return false;
  };

  // -------------------------------------------------------------
  // STAGE 3: GUILT-FREE WIND-DOWN (DECOMPRESSION)
  // -------------------------------------------------------------
  if (data.sleepConfig.enabled && !excludedKeys.has('decompression')) {
    const hasDecompression = events.some((e) => e.category === 'decompression' || e.id.startsWith('decompression-'));
    if (!hasDecompression) {
      const coreStartMins = timeToMinutes(data.sleepConfig.coreSleepStart);
      const decompMins = data.decompressionMinutes || 45;

      const decompStartMins = coreStartMins - decompMins;
      const decompEndMins = coreStartMins;

      if (!isToday || decompEndMins > currentMins) {
        if (decompStartMins < 0) {
          const part1Start = 1440 + decompStartMins;
          if (isSlotFree(part1Start, 1440)) {
            addEventToTimeline({
              id: `decompression-p1-${dateStr}`,
              title: 'Guilt-Free Wind-Down (Decompression)',
              category: 'decompression',
              startTime: minutesToTime(part1Start),
              endTime: '24:00',
              color: '#ec4899',
              isLocked: true,
              notes: `${decompMins}-min reserved downtime before core sleep`,
            });
          }
          if (decompEndMins > 0 && isSlotFree(0, decompEndMins)) {
            addEventToTimeline({
              id: `decompression-p2-${dateStr}`,
              title: 'Guilt-Free Wind-Down (Decompression)',
              category: 'decompression',
              startTime: '00:00',
              endTime: minutesToTime(decompEndMins),
              color: '#ec4899',
              isLocked: true,
              notes: `${decompMins}-min reserved downtime before core sleep`,
            });
          }
        } else {
          if (isSlotFree(decompStartMins, decompEndMins)) {
            addEventToTimeline({
              id: `decompression-${dateStr}`,
              title: 'Guilt-Free Wind-Down (Decompression)',
              category: 'decompression',
              startTime: minutesToTime(decompStartMins),
              endTime: minutesToTime(decompEndMins),
              color: '#ec4899',
              isLocked: true,
              notes: `${decompMins}-min reserved downtime prior to core sleep`,
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // STAGE 4: FIXED ACADEMIC ANCHORS & ONE-TIME COMMITMENTS
  // -------------------------------------------------------------
  for (const anchor of applicableAnchors) {
    const idBase = `anchor-${anchor.id}-${dateStr}`;
    if (events.some((e) => e.id === idBase || e.id === `${idBase}-p1`)) continue;
    const sMins = timeToMinutes(anchor.startTime);

    const anchorFields = {
      title: anchor.title,
      category: 'lecture' as const,
      color: anchor.color || (anchor.overrideSleep ? '#8b5cf6' : '#f59e0b'),
      isLocked: true,
      overrideSleep: anchor.overrideSleep,
      parentAnchorId: anchor.id,
      notes: anchor.location
        ? `Location: ${anchor.location}${anchor.overrideSleep ? ' (Override Sleep Enabled)' : ''}`
        : anchor.overrideSleep
        ? 'Override Sleep Enabled'
        : undefined,
    };

    const scheduled = scheduleLeadingSegment(idBase, anchor.startTime, anchor.endTime, anchorFields);

    if (!scheduled) {
      const rawEnd = timeToMinutes(anchor.endTime);
      const wrappedEnd = rawEnd <= sMins ? rawEnd + 1440 : rawEnd;
      if (!pinnedEvents.some((p) => isOverlapping(sMins, wrappedEnd, p.startMinutes, p.endMinutes))) {
        unscheduledItems.push({
          type: 'task',
          title: anchor.title,
          reason: `Conflicts with existing locked event (${anchor.startTime} - ${anchor.endTime})`,
        });
      }
    }
  }

  for (const otc of applicableOneTime) {
    if (events.some((e) => e.parentOneTimeId === otc.id || e.id.startsWith(`otc-${otc.id}-${dateStr}`))) continue;
    const sMins = timeToMinutes(otc.startTime);

    const scheduled = scheduleWrappableEvent(
      `otc-${otc.id}-${dateStr}`,
      otc.startTime,
      otc.endTime,
      {
        title: otc.title,
        category: otc.category || 'custom',
        color: otc.color || '#ec4899',
        isLocked: true,
        isCompleted: otc.isCompleted ?? false,
        status: otc.isCompleted ? 'done' : 'pending',
        overrideSleep: otc.overrideSleep,
        parentOneTimeId: otc.id,
        notes: otc.notes || (otc.location ? `Location: ${otc.location}` : undefined),
      }
    );

    if (!scheduled) {
      const rawEnd = timeToMinutes(otc.endTime);
      const wrappedEnd = rawEnd <= sMins ? rawEnd + 1440 : rawEnd;
      if (!pinnedEvents.some((p) => isOverlapping(sMins, wrappedEnd, p.startMinutes, p.endMinutes))) {
        unscheduledItems.push({
          type: 'task',
          title: otc.title,
          reason: `Conflicts with existing event (${otc.startTime} - ${otc.endTime})`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // STAGE 5: EVERYMAN CORE SLEEP (Current Day)
  // -------------------------------------------------------------
  if (data.sleepConfig.enabled && !excludedKeys.has('core_sleep')) {
    const hasCoreSleep = events.some((e) => e.category === 'core_sleep' || e.id.startsWith('core-sleep-'));
    if (!hasCoreSleep) {
      const coreStartMins = timeToMinutes(data.sleepConfig.coreSleepStart);
      const coreDur = Math.max(30, data.sleepConfig.coreSleepDurationMinutes || 210);
      const coreEndMins = coreStartMins + coreDur;
      const durFormatted = formatDuration(coreDur);

      const sleepOverridden = isOverriddenByLongTravel(coreStartMins, Math.min(1440, coreEndMins));

      if (!sleepOverridden && (!isToday || coreEndMins > currentMins)) {
        if (coreEndMins <= 1440) {
          if (isSlotFree(coreStartMins, coreEndMins)) {
            addEventToTimeline({
              id: `core-sleep-${dateStr}`,
              title: 'Core Sleep (Everyman Polyphasic)',
              category: 'core_sleep',
              startTime: minutesToTime(coreStartMins),
              endTime: minutesToTime(coreEndMins),
              color: '#6366f1',
              isLocked: true,
              notes: `${durFormatted} Deep Slow-Wave Sleep Phase`,
            });
          }
        } else {
          const part1End = 1440;
          const part2End = coreEndMins - 1440;

          if (isSlotFree(coreStartMins, part1End)) {
            addEventToTimeline({
              id: `core-sleep-p1-${dateStr}`,
              title: 'Core Sleep (Everyman Polyphasic)',
              category: 'core_sleep',
              startTime: minutesToTime(coreStartMins),
              endTime: '24:00',
              color: '#6366f1',
              isLocked: true,
              notes: `${durFormatted} Deep Slow-Wave Sleep Phase (Part 1)`,
            });
          }
          if (part2End > 0 && isSlotFree(0, part2End)) {
            addEventToTimeline({
              id: `core-sleep-p2-${dateStr}`,
              title: 'Core Sleep (Everyman Polyphasic - Continuation)',
              category: 'core_sleep',
              startTime: '00:00',
              endTime: minutesToTime(part2End),
              color: '#6366f1',
              isLocked: true,
              notes: `${durFormatted} Deep Slow-Wave Sleep Phase (Part 2)`,
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // STAGE 6: MEAL WINDOWS
  // -------------------------------------------------------------
  const scheduleMeal = (mealKey: 'breakfast' | 'lunch' | 'snacks' | 'dinner', meal: MealWindow) => {
    if (!meal || !meal.enabled) return;
    if (excludedKeys.has(`meal-${mealKey}`)) return;

    if (events.some((e) => e.id === `meal-${mealKey}-${dateStr}` || (e.category === 'meal' && e.title.toLowerCase().includes(meal.name.toLowerCase())))) {
      return;
    }

    const windowStartMins = timeToMinutes(meal.windowStart);
    const windowEndMins = timeToMinutes(meal.windowEnd);
    const dur = meal.durationMinutes || 60;

    if (isToday && windowEndMins <= currentMins) {
      return;
    }

    const scanStart = isToday ? Math.max(windowStartMins, currentMins) : windowStartMins;

    let scheduled = false;
    for (let t = scanStart; t <= windowEndMins - dur; t += 15) {
      if (isSlotFree(t, t + dur)) {
        addEventToTimeline({
          id: `meal-${mealKey}-${dateStr}`,
          title: `${meal.name} Window`,
          category: 'meal',
          startTime: minutesToTime(t),
          endTime: minutesToTime(t + dur),
          color: '#10b981',
          isLocked: true,
          notes: 'Nutrition & Metabolic Reset',
        });
        scheduled = true;
        break;
      }
    }

    if (!scheduled && (!isToday || windowEndMins > currentMins)) {
      unscheduledItems.push({
        type: 'meal',
        title: meal.name,
        reason: `No free ${dur}-minute slot available inside window ${meal.windowStart} - ${meal.windowEnd}`,
      });
    }
  };

  if (data.mealConfig) {
    if (data.mealConfig.breakfast) scheduleMeal('breakfast', data.mealConfig.breakfast);
    if (data.mealConfig.lunch) scheduleMeal('lunch', data.mealConfig.lunch);
    if (data.mealConfig.snacks) scheduleMeal('snacks', data.mealConfig.snacks);
    if (data.mealConfig.dinner) scheduleMeal('dinner', data.mealConfig.dinner);
  }

  // -------------------------------------------------------------
  // STAGE 7: EVERYMAN NAPS
  // -------------------------------------------------------------
  if (data.sleepConfig.enabled && data.sleepConfig.napsCount > 0) {
    const napsCount = data.sleepConfig.napsCount;
    const napDur = Math.max(10, data.sleepConfig.napDurationMinutes || 30);

    const defaultFallbacks = ['08:30', '13:30', '18:30', '22:00', '06:00', '11:00'];
    const preferredTimes: string[] = [];
    for (let i = 0; i < napsCount; i++) {
      preferredTimes.push(
        data.sleepConfig.preferredNapTimes[i] || defaultFallbacks[i % defaultFallbacks.length]
      );
    }

    for (let i = 0; i < napsCount; i++) {
      if (events.some((e) => e.id === `nap-${i + 1}-${dateStr}` || (e.category === 'nap' && e.title.includes(`#${i + 1}`)))) {
        continue;
      }
      if (excludedKeys.has(`nap-${i + 1}`)) continue;

      const preferredTimeStr = preferredTimes[i];
      const targetMins = timeToMinutes(preferredTimeStr);

      if (isToday && targetMins + napDur <= currentMins) continue;

      if (isOverriddenByLongTravel(targetMins, targetMins + napDur)) continue;

      let placed = false;
      const minAllowed = isToday ? currentMins : 0;

      if (targetMins >= minAllowed && isSlotFree(targetMins, targetMins + napDur)) {
        addEventToTimeline({
          id: `nap-${i + 1}-${dateStr}`,
          title: `Everyman Nap #${i + 1} (${napDur}m REM Refresh)`,
          category: 'nap',
          startTime: minutesToTime(targetMins),
          endTime: minutesToTime(targetMins + napDur),
          color: '#a855f7',
          isLocked: true,
          notes: `${napDur}-min power nap for memory consolidation`,
        });
        placed = true;
      } else {
        for (let offset = 15; offset <= 300; offset += 15) {
          const tryStart1 = targetMins + offset;
          if (tryStart1 >= minAllowed && tryStart1 + napDur <= 1440 && isSlotFree(tryStart1, tryStart1 + napDur)) {
            addEventToTimeline({
              id: `nap-${i + 1}-${dateStr}`,
              title: `Everyman Nap #${i + 1} (${napDur}m REM Refresh)`,
              category: 'nap',
              startTime: minutesToTime(tryStart1),
              endTime: minutesToTime(tryStart1 + napDur),
              color: '#a855f7',
              isLocked: true,
              notes: `Adjusted to nearby slot (${minutesToTime(tryStart1)})`,
            });
            placed = true;
            break;
          }

          const tryStart2 = targetMins - offset;
          if (tryStart2 >= minAllowed && tryStart2 + napDur <= 1440 && isSlotFree(tryStart2, tryStart2 + napDur)) {
            addEventToTimeline({
              id: `nap-${i + 1}-${dateStr}`,
              title: `Everyman Nap #${i + 1} (${napDur}m REM Refresh)`,
              category: 'nap',
              startTime: minutesToTime(tryStart2),
              endTime: minutesToTime(tryStart2 + napDur),
              color: '#a855f7',
              isLocked: true,
              notes: `Adjusted to nearby slot (${minutesToTime(tryStart2)})`,
            });
            placed = true;
            break;
          }
        }
      }

      if (!placed && (!isToday || targetMins > currentMins)) {
        unscheduledItems.push({
          type: 'nap',
          title: `Everyman Nap #${i + 1}`,
          reason: `Could not find an unblocked ${napDur}-min slot near ${preferredTimeStr}`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // STAGE 8: DYNAMIC TASKS, ERRANDS & ASSIGNED CHORES
  // -------------------------------------------------------------
  const alreadyPlacedTaskIds = new Set(
    events.filter((e) => e.parentTaskId).map((e) => e.parentTaskId)
  );

  const unpinnedTasks = data.dynamicTasks.filter((t) => {
    if (alreadyPlacedTaskIds.has(t.id)) return false;
    if (t.isPinned && t.pinnedDateStr !== dateStr) return false;
    if (t.isPinned && t.pinnedDateStr === dateStr) return false;
    if (t.scheduledStartDate && dateStr < t.scheduledStartDate) return false;
    if (t.scheduledEndDate && dateStr > t.scheduledEndDate) return false;
    return true;
  });

  const isErrandTask = (t: DynamicTask): boolean =>
    t.category?.toLowerCase() === 'errand' || t.title.toLowerCase().includes('errand');

  const sortedTasks = [...unpinnedTasks].sort((a, b) => {
    const pRank = { high: 1, medium: 2, low: 3 };
    const aErrand = isErrandTask(a);
    const bErrand = isErrandTask(b);
    if (aErrand !== bErrand) return aErrand ? -1 : 1;

    const rankDiff = pRank[a.priority] - pRank[b.priority];
    if (rankDiff !== 0) return rankDiff;

    const aDeadline = a.deadline ? timeToMinutes(a.deadline) : Infinity;
    const bDeadline = b.deadline ? timeToMinutes(b.deadline) : Infinity;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return b.durationMinutes - a.durationMinutes;
  });

  for (const task of sortedTasks) {
    const taskCategory = task.category || 'task';
    const { effectiveDuration: taskDur, frictionAdded } = getEffectiveTaskDuration(
      data.habitModel,
      taskCategory,
      task.durationMinutes
    );
    const transitBefore = task.transitBufferBeforeMinutes || 0;
    const transitAfter = task.transitBufferAfterMinutes || 0;
    const totalRequired = transitBefore + taskDur + transitAfter;

    const isErrand = isErrandTask(task);
    const errandMin = 600;  // 10:00 AM
    const errandMax = 1200; // 08:00 PM

    let searchMinMins = isToday ? currentMins : 0;
    let searchMaxMins = 1440;

    if (isErrand) {
      searchMinMins = Math.max(errandMin, isToday ? currentMins : 0);
      searchMaxMins = errandMax;
    }

    const deadlineMins = task.deadline ? timeToMinutes(task.deadline) : null;
    if (deadlineMins !== null) {
      searchMaxMins = Math.min(searchMaxMins, deadlineMins);
    }

    let scheduled = false;

    if (searchMinMins < searchMaxMins) {
      const freeIntervals = getSortedFreeIntervals(searchMinMins);

      let bestStart: number | null = null;
      let bestSlack = Infinity;

      for (const interval of freeIntervals) {
        let effectiveStart = Math.max(interval.start, searchMinMins);
        if (effectiveStart > 0 && effectiveStart === interval.start) {
          effectiveStart += SLACK_BUFFER_MINUTES;
        }

        let effectiveEnd = Math.min(interval.end, searchMaxMins);
        if (effectiveEnd < 1440 && effectiveEnd === interval.end) {
          effectiveEnd -= SLACK_BUFFER_MINUTES;
        }

        const availableDur = effectiveEnd - effectiveStart;

        if (availableDur >= totalRequired) {
          const slack = availableDur - totalRequired;
          if (slack < bestSlack) {
            bestSlack = slack;
            bestStart = effectiveStart;
          }
        }
      }

      if (bestStart !== null) {
        let cursor = bestStart;

        if (task.overrideSleep) {
          sleepOverrideBlocks.push({
            start: cursor,
            end: cursor + totalRequired,
            title: task.title,
          });
        }

        if (transitBefore > 0) {
          addEventToTimeline({
            id: `transit-before-${task.id}-${dateStr}`,
            title: `Transit to: ${task.title}`,
            category: 'transit',
            startTime: minutesToTime(cursor),
            endTime: minutesToTime(cursor + transitBefore),
            color: '#64748b',
            isLocked: false,
            parentTaskId: task.id,
            transitType: 'before',
          });
          cursor += transitBefore;
        }

        const notesList = [];
        if (task.notes) notesList.push(task.notes);
        if (task.overrideSleep) notesList.push('Override Sleep Enabled');
        if (frictionAdded > 0) notesList.push(`Adaptive ML Friction Buffer (+${frictionAdded}m)`);
        if (task.deadline) notesList.push(`Deadline: ${task.deadline}`);

        addEventToTimeline({
          id: `task-${task.id}-${dateStr}`,
          title: task.title,
          category: 'task',
          startTime: minutesToTime(cursor),
          endTime: minutesToTime(cursor + taskDur),
          color: task.overrideSleep ? '#8b5cf6' : '#38bdf8',
          isLocked: false,
          overrideSleep: task.overrideSleep,
          frictionAppliedMinutes: frictionAdded,
          notes: notesList.join(' • ') || undefined,
          parentTaskId: task.id,
        });
        cursor += taskDur;

        if (transitAfter > 0) {
          addEventToTimeline({
            id: `transit-after-${task.id}-${dateStr}`,
            title: `Return Transit from: ${task.title}`,
            category: 'transit',
            startTime: minutesToTime(cursor),
            endTime: minutesToTime(cursor + transitAfter),
            color: '#64748b',
            isLocked: false,
            parentTaskId: task.id,
            transitType: 'after',
          });
          cursor += transitAfter;
        }

        scheduled = true;
      }
    }

    if (!scheduled) {
      let reasonMsg: string;
      if (deadlineMins !== null && isToday && deadlineMins <= currentMins) {
        reasonMsg = `Deadline (${task.deadline}) has already passed today.`;
      } else if (deadlineMins !== null) {
        reasonMsg = `Requires a ${totalRequired}m contiguous block before its ${task.deadline} deadline, but none was found.`;
      } else if (isErrand) {
        reasonMsg = `Errands are strictly restricted to 10:00 AM - 08:00 PM window (Requires ${totalRequired}m contiguous block with slack buffer).`;
      } else {
        reasonMsg = `Requires contiguous block of ${totalRequired}m (${taskDur}m task + ${transitBefore + transitAfter}m travel buffer), but no free window fit this size.`;
      }

      unscheduledItems.push({
        type: 'task',
        title: task.title,
        reason: reasonMsg,
      });
    }
  }

  // Schedule Chores assigned to this date
  const assignedChoresForDate = (data.weeklyChores || []).filter(
    (c) => c.isScheduled && c.assignedDateStr === dateStr
  );

  for (const chore of assignedChoresForDate) {
    if (events.some((e) => e.parentTaskId === chore.id || e.id.startsWith(`chore-${chore.id}-${dateStr}`))) {
      continue;
    }

    if (chore.assignedStartTime && chore.assignedEndTime) {
      scheduleWrappableEvent(
        `chore-${chore.id}-${dateStr}`,
        chore.assignedStartTime,
        chore.assignedEndTime,
        {
          title: `Chore: ${chore.title}`,
          category: 'chore',
          color: '#eab308',
          isLocked: false,
          isChore: true,
          notes: chore.notes || 'Weekly Chore Pool',
          parentTaskId: chore.id,
        }
      );
    }
  }

  // -------------------------------------------------------------
  // STAGE 9: ELASTIC POMODORO STUDY SESSIONS WITH MANDATORY BREAKS
  // -------------------------------------------------------------
  if (data.pomodoroConfig.autoFillRemainingSlots) {
    let pomodoroIndex = 1;
    const freeIntervals = getSortedFreeIntervals(isToday ? currentMins : 0);

    for (const interval of freeIntervals) {
      let cursor = interval.start;
      let remainingInterval = interval.end - cursor;

      // A valid Pomodoro cycle requires at least 35 minutes total (e.g. min 25m study + 10m mandatory break).
      // Smaller remaining slots (like a 30m gap between a Nap and a Meal) are reserved as buffer/rest time.
      while (remainingInterval >= 35) {
        let studyMins = 50;
        let breakMins = 15;

        if (remainingInterval >= 65) {
          studyMins = 50;
          breakMins = 15;
        } else if (remainingInterval >= 50) {
          breakMins = 15;
          studyMins = remainingInterval - breakMins;
        } else {
          breakMins = 10;
          studyMins = remainingInterval - breakMins;
        }

        const workEnd = cursor + studyMins;
        if (!isSlotFree(cursor, workEnd)) {
          break;
        }

        while (events.some(e => e.id === `pomo-work-${pomodoroIndex}-${dateStr}` || e.id === `pomo-break-${pomodoroIndex}-${dateStr}`)) {
          pomodoroIndex++;
        }

        const isWorkExcluded =
          excludedKeys.has(`pomo:${cursor}-${workEnd}`) ||
          excludedKeys.has(`pomo-work-${pomodoroIndex}`) ||
          [...excludedKeys].some((k) => {
            if (!k.startsWith('pomo:')) return false;
            const parts = k.slice(5).split('-');
            if (parts.length === 2) {
              const s = parseInt(parts[0], 10);
              const e = parseInt(parts[1], 10);
              return !isNaN(s) && !isNaN(e) && Math.max(cursor, s) < Math.min(workEnd, e);
            }
            return false;
          });

        if (!isWorkExcluded) {
          addEventToTimeline({
            id: `pomo-work-${pomodoroIndex}-${dateStr}`,
            title: `Pomodoro Focus #${pomodoroIndex}: ${data.pomodoroConfig.defaultSubject || 'Deep Focus'}`,
            category: 'pomodoro_study',
            startTime: minutesToTime(cursor),
            endTime: minutesToTime(workEnd),
            color: '#f43f5e',
            isLocked: false,
            notes: `${studyMins}-minute elastic focus block`,
          });
        }

        let actualBreak = 0;
        if (breakMins >= 5 && !isWorkExcluded) {
          const breakEnd = workEnd + breakMins;
          const isBreakExcluded =
            excludedKeys.has(`pomo:${workEnd}-${breakEnd}`) ||
            excludedKeys.has(`pomo-break-${pomodoroIndex}`) ||
            [...excludedKeys].some((k) => {
              if (!k.startsWith('pomo:')) return false;
              const parts = k.slice(5).split('-');
              if (parts.length === 2) {
                const s = parseInt(parts[0], 10);
                const e = parseInt(parts[1], 10);
                return !isNaN(s) && !isNaN(e) && Math.max(workEnd, s) < Math.min(breakEnd, e);
              }
              return false;
            });

          if (!isBreakExcluded && breakEnd <= interval.end && isSlotFree(workEnd, breakEnd)) {
            addEventToTimeline({
              id: `pomo-break-${pomodoroIndex}-${dateStr}`,
              title: `Pomodoro Break #${pomodoroIndex}`,
              category: 'pomodoro_break',
              startTime: minutesToTime(workEnd),
              endTime: minutesToTime(breakEnd),
              color: '#14b8a6',
              isLocked: false,
              notes: `${breakMins}-minute mandatory cognitive break`,
            });
            actualBreak = breakMins;
          }
        }

        if (isWorkExcluded) {
          cursor = workEnd + breakMins;
        } else if (actualBreak === 0) {
          cursor = workEnd + (breakMins > 0 ? breakMins : 15);
        } else {
          cursor = workEnd + actualBreak;
        }

        pomodoroIndex++;
        remainingInterval = interval.end - cursor;
      }
    }
  }

  // -------------------------------------------------------------
  // STAGE 10: SORTING & METRICS SUMMARY
  // -------------------------------------------------------------
  events.sort((a, b) => a.startMinutes - b.startMinutes);

  let totalSleepMinutes = 0;
  let totalStudyMinutes = 0;
  let totalLectureMinutes = 0;
  let totalMealMinutes = 0;
  let totalTaskMinutes = 0;

  for (const ev of events) {
    const dur = ev.endMinutes - ev.startMinutes;
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

  const allocatedMinutes = events.reduce((acc, ev) => acc + (ev.endMinutes - ev.startMinutes), 0);
  const freeMinutes = Math.max(0, 1440 - allocatedMinutes);
  const utilizationPercent = Math.round((allocatedMinutes / 1440) * 100);

  return {
    events,
    unscheduledItems,
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

/**
 * Scans a 7-day week matrix and automatically slots Weekly Chores into the largest
 * available blocks of Free Time on days with the lowest total scheduled workload.
 */
export function scheduleWeeklyChores(
  data: UserScheduleData,
  weekDateStrs: string[]
): { updatedChores: WeeklyChore[]; updatedScheduledEvents: Record<string, ScheduledEvent[]> } {
  const updatedChores = data.weeklyChores.map((c) => ({ ...c }));
  const updatedScheduledEvents = { ...data.scheduledEvents };

  interface DayLoad {
    dateStr: string;
    dayOfWeek: number;
    totalScheduledMins: number;
    freeIntervals: FreeInterval[];
  }

  const dayLoads: DayLoad[] = weekDateStrs.map((dStr, idx) => {
    const dayOfWeek = (idx + 1) % 7;
    const res = generateOptimizedSchedule(data, dStr, dayOfWeek);
    const allocated = res.events.reduce((acc, ev) => acc + (ev.endMinutes - ev.startMinutes), 0);

    const occs = res.events.map((e) => ({ start: e.startMinutes, end: e.endMinutes }));
    occs.sort((a, b) => a.start - b.start);

    const freeInts: FreeInterval[] = [];
    let ptr = 420; // 07:00 AM start
    for (const o of occs) {
      if (o.end <= ptr) continue;
      if (o.start > ptr) {
        freeInts.push({ start: ptr, end: o.start });
      }
      ptr = Math.max(ptr, o.end);
    }
    if (ptr < 1320) {
      freeInts.push({ start: ptr, end: 1320 });
    }

    return {
      dateStr: dStr,
      dayOfWeek,
      totalScheduledMins: allocated,
      freeIntervals: freeInts,
    };
  });

  const pRank = { high: 1, medium: 2, low: 3 };
  updatedChores.sort((a, b) => pRank[a.priority] - pRank[b.priority] || b.durationMinutes - a.durationMinutes);

  for (const chore of updatedChores) {
    if (chore.isScheduled) continue;

    const sortedDays = [...dayLoads].sort((a, b) => a.totalScheduledMins - b.totalScheduledMins);

    let placed = false;
    for (const d of sortedDays) {
      for (const fi of d.freeIntervals) {
        const durAvailable = fi.end - fi.start;
        if (durAvailable >= chore.durationMinutes) {
          const sMins = fi.start;
          const eMins = sMins + chore.durationMinutes;

          chore.isScheduled = true;
          chore.assignedDateStr = d.dateStr;
          chore.assignedStartTime = minutesToTime(sMins);
          chore.assignedEndTime = minutesToTime(eMins);

          d.totalScheduledMins += chore.durationMinutes;
          fi.start = eMins;

          const dayEvents = updatedScheduledEvents[d.dateStr] || [];
          const newChoreEvent: ScheduledEvent = {
            id: `chore-${chore.id}-${d.dateStr}`,
            title: `Chore: ${chore.title}`,
            category: 'chore',
            startTime: chore.assignedStartTime,
            endTime: chore.assignedEndTime,
            startMinutes: sMins,
            endMinutes: eMins,
            dateStr: d.dateStr,
            color: '#eab308',
            isLocked: false,
            isChore: true,
            notes: chore.notes || 'Weekly Chore Pool',
            parentTaskId: chore.id,
          };

          updatedScheduledEvents[d.dateStr] = [...dayEvents, newChoreEvent].sort(
            (a, b) => a.startMinutes - b.startMinutes
          );

          placed = true;
          break;
        }
      }
      if (placed) break;
    }
  }

  return { updatedChores, updatedScheduledEvents };
}
