import React, { useState } from 'react';
import {
  UserScheduleData,
  FixedAnchor,
  DynamicTask,
  EverymanSleepConfig,
  PomodoroConfig,
  WeeklyChore,
  OneTimeCommitment,
  CategoryHabitData,
  ScheduledEvent,
} from '../types';
import {
  Plus,
  Trash2,
  Utensils,
  BookOpen,
  Repeat,
  Moon,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Bus,
  Layers,
  CheckSquare,
  Pin,
  PinOff,
  CalendarDays,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { formatDuration, formatTime12h, getTodayStr } from '../utils/timeUtils';
import { scheduleWeeklyChores } from '../utils/schedulerEngine';
import { addDays, format, parseISO } from 'date-fns';

interface SidebarProps {
  data: UserScheduleData;
  onUpdateData: (newData: UserScheduleData) => void;
  onGenerateSchedule: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  data,
  onUpdateData,
  onGenerateSchedule,
  isOpen,
  onToggleOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'anchors' | 'meals' | 'tasks' | 'onetime' | 'settings'>('anchors');

  // Lecture / Anchor Form State
  const [newAnchorTitle, setNewAnchorTitle] = useState('');
  const [newAnchorStart, setNewAnchorStart] = useState('09:00');
  const [newAnchorEnd, setNewAnchorEnd] = useState('10:30');
  const [newAnchorLocation, setNewAnchorLocation] = useState('');
  const [newAnchorDays, setNewAnchorDays] = useState<number[]>([1, 2, 3, 4, 5]); // Default Mon-Fri
  const [newAnchorOverrideSleep, setNewAnchorOverrideSleep] = useState(false);

  // One-Time Commitment Form State
  const [newOtcTitle, setNewOtcTitle] = useState('');
  const [newOtcDate, setNewOtcDate] = useState(getTodayStr());
  const [newOtcStart, setNewOtcStart] = useState('14:00');
  const [newOtcEnd, setNewOtcEnd] = useState('15:00');
  const [newOtcLocation, setNewOtcLocation] = useState('');
  const [newOtcOverrideSleep, setNewOtcOverrideSleep] = useState(false);

  // Dynamic Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [newTaskRequiresTransit, setNewTaskRequiresTransit] = useState(false);
  const [newTaskBufferBefore, setNewTaskBufferBefore] = useState(0);
  const [newTaskBufferAfter, setNewTaskBufferAfter] = useState(0);
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskCategory, setNewTaskCategory] = useState('Errand');
  const [newTaskOverrideSleep, setNewTaskOverrideSleep] = useState(false);
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskEndDate, setNewTaskEndDate] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  // Weekly Chores form state
  const [newChoreTitle, setNewChoreTitle] = useState('');
  const [newChoreDuration, setNewChoreDuration] = useState(30);
  const [newChorePriority, setNewChorePriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newChoreCategory, setNewChoreCategory] = useState('');

  // Strips already-committed events derived from a deleted source (anchor,
  // one-time commitment, task, or chore) out of scheduledEvents across every
  // date. The scheduler also refuses to re-render orphaned events, but this
  // keeps stored data from accumulating dead entries forever.
  const purgeScheduledEvents = (
    matches: (ev: ScheduledEvent) => boolean
  ): Record<string, ScheduledEvent[]> => {
    const next: Record<string, ScheduledEvent[]> = {};
    const entries = Object.entries(data.scheduledEvents) as [string, ScheduledEvent[]][];
    for (const [dateStr, events] of entries) {
      next[dateStr] = events.filter((ev) => !matches(ev));
    }
    return next;
  };

  // Add Fixed Lecture Anchor
  const handleAddAnchor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnchorTitle.trim()) return;

    const newAnchor: FixedAnchor = {
      id: `anchor-${Date.now()}`,
      title: newAnchorTitle.trim(),
      type: 'lecture',
      startTime: newAnchorStart,
      endTime: newAnchorEnd,
      location: newAnchorLocation.trim() || undefined,
      color: '#f59e0b',
      daysOfWeek: newAnchorDays.length > 0 ? newAnchorDays : [0, 1, 2, 3, 4, 5, 6],
      overrideSleep: newAnchorOverrideSleep,
    };

    onUpdateData({
      ...data,
      fixedAnchors: [...data.fixedAnchors, newAnchor],
    });

    setNewAnchorTitle('');
    setNewAnchorLocation('');
    setNewAnchorOverrideSleep(false);
  };

  const handleDeleteAnchor = (id: string) => {
    const cleanId = id.replace(/^anchor-/, '');
    onUpdateData({
      ...data,
      fixedAnchors: data.fixedAnchors.filter((a) => a.id !== id && a.id.replace(/^anchor-/, '') !== cleanId),
      scheduledEvents: purgeScheduledEvents((ev) => ev.parentAnchorId === id || (!!ev.parentAnchorId && ev.parentAnchorId.replace(/^anchor-/, '') === cleanId) || ev.id.includes(cleanId)),
    });
  };

  // Add One-Time Commitment
  const handleAddOneTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOtcTitle.trim() || !newOtcDate.trim()) return;

    const newOtc: OneTimeCommitment = {
      id: `otc-${Date.now()}`,
      title: newOtcTitle.trim(),
      dateStr: newOtcDate.trim(),
      startTime: newOtcStart,
      endTime: newOtcEnd,
      location: newOtcLocation.trim() || undefined,
      category: 'custom',
      color: '#ec4899',
      overrideSleep: newOtcOverrideSleep,
    };

    onUpdateData({
      ...data,
      oneTimeCommitments: [...(data.oneTimeCommitments || []), newOtc],
    });

    setNewOtcTitle('');
    setNewOtcLocation('');
    setNewOtcOverrideSleep(false);
  };

  const handleDeleteOneTime = (id: string) => {
    const cleanId = id.replace(/^otc-/, '');
    onUpdateData({
      ...data,
      oneTimeCommitments: (data.oneTimeCommitments || []).filter((otc) => otc.id !== id && otc.id.replace(/^otc-/, '') !== cleanId),
      scheduledEvents: purgeScheduledEvents((ev) => ev.parentOneTimeId === id || ev.parentOneTimeId === cleanId || ev.id.includes(id) || ev.id.includes(cleanId)),
    });
  };

  const handleToggleCompleteOneTime = (id: string) => {
    const cleanId = id.replace(/^otc-/, '');
    const otcList = data.oneTimeCommitments || [];
    const target = otcList.find((otc) => otc.id === id || otc.id.replace(/^otc-/, '') === cleanId);
    if (!target) return;

    const newCompleted = !target.isCompleted;
    const updatedOtcList = otcList.map((otc) => {
      if (otc.id === id || otc.id.replace(/^otc-/, '') === cleanId) {
        return { ...otc, isCompleted: newCompleted };
      }
      return otc;
    });

    const scheduledEvents: typeof data.scheduledEvents = {};
    for (const [dateStr, events] of Object.entries(data.scheduledEvents)) {
      scheduledEvents[dateStr] = (events as ScheduledEvent[]).map((ev) => {
        if (ev.parentOneTimeId === id || ev.parentOneTimeId === cleanId || ev.id.includes(id) || ev.id.includes(cleanId)) {
          return {
            ...ev,
            isCompleted: newCompleted,
            status: newCompleted ? 'done' : 'pending',
          };
        }
        return ev;
      });
    }

    onUpdateData({
      ...data,
      oneTimeCommitments: updatedOtcList,
      scheduledEvents,
    });
  };

  // Toggle Day of Week for Anchor
  const toggleAnchorDay = (dayNum: number) => {
    setNewAnchorDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort()
    );
  };

  // Add Dynamic Task
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const bufferBefore = newTaskRequiresTransit ? 10 : Number(newTaskBufferBefore) || 0;
    const bufferAfter = newTaskRequiresTransit ? 10 : Number(newTaskBufferAfter) || 0;

    const newTask: DynamicTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      durationMinutes: Number(newTaskDuration) || 30,
      transitBufferBeforeMinutes: bufferBefore,
      transitBufferAfterMinutes: bufferAfter,
      priority: newTaskPriority,
      category: newTaskCategory,
      overrideSleep: newTaskOverrideSleep,
      scheduledStartDate: newTaskStartDate.trim() || undefined,
      scheduledEndDate: newTaskEndDate.trim() || undefined,
      deadline: newTaskDeadline.trim() || undefined,
    };

    onUpdateData({
      ...data,
      dynamicTasks: [...data.dynamicTasks, newTask],
    });

    setNewTaskTitle('');
    setNewTaskRequiresTransit(false);
    setNewTaskOverrideSleep(false);
    setNewTaskStartDate('');
    setNewTaskEndDate('');
    setNewTaskDeadline('');
  };

  const handleDeleteTask = (id: string) => {
    const cleanId = id.replace(/^task-/, '');
    onUpdateData({
      ...data,
      dynamicTasks: data.dynamicTasks.filter((t) => t.id !== id && t.id.replace(/^task-/, '') !== cleanId),
      scheduledEvents: purgeScheduledEvents((ev) => ev.parentTaskId === id || ev.parentTaskId === cleanId || ev.id.includes(id) || ev.id.includes(cleanId)),
    });
  };

  const handleUnpinTask = (id: string) => {
    onUpdateData({
      ...data,
      dynamicTasks: data.dynamicTasks.map((t) =>
        t.id === id ? { ...t, isPinned: false, pinnedStartTime: undefined, pinnedDateStr: undefined } : t
      ),
    });
  };

  // Update Meal Config
  const handleMealChange = (
    mealKey: 'breakfast' | 'lunch' | 'snacks' | 'dinner',
    field: string,
    value: unknown
  ) => {
    onUpdateData({
      ...data,
      mealConfig: {
        ...data.mealConfig,
        [mealKey]: {
          ...data.mealConfig[mealKey],
          [field]: value,
        },
      },
    });
  };

  // Update Sleep Config
  const handleSleepChange = (field: keyof EverymanSleepConfig, value: unknown) => {
    onUpdateData({
      ...data,
      sleepConfig: {
        ...data.sleepConfig,
        [field]: value,
      },
    });
  };

  // Update Pomodoro Config
  const handlePomodoroChange = (field: keyof PomodoroConfig, value: unknown) => {
    onUpdateData({
      ...data,
      pomodoroConfig: {
        ...data.pomodoroConfig,
        [field]: value,
      },
    });
  };

  // Add Weekly Chore to the pool (unscheduled until distributed)
  const handleAddChore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChoreTitle.trim()) return;

    const newChore: WeeklyChore = {
      id: `chore-${Date.now()}`,
      title: newChoreTitle.trim(),
      durationMinutes: Number(newChoreDuration) || 30,
      priority: newChorePriority,
      category: newChoreCategory.trim() || undefined,
      isScheduled: false,
    };

    onUpdateData({
      ...data,
      weeklyChores: [...data.weeklyChores, newChore],
    });

    setNewChoreTitle('');
    setNewChoreDuration(30);
    setNewChoreCategory('');
  };

  const handleDeleteChore = (id: string) => {
    const cleanId = id.replace(/^chore-/, '');
    onUpdateData({
      ...data,
      weeklyChores: data.weeklyChores.filter((c) => c.id !== id && c.id.replace(/^chore-/, '') !== cleanId),
      scheduledEvents: purgeScheduledEvents((ev) => ev.parentTaskId === id || ev.parentTaskId === cleanId || ev.id.includes(id) || ev.id.includes(cleanId)),
    });
  };

  // Reset all chores back to unscheduled so they can be redistributed
  const handleResetChoreSchedule = () => {
    onUpdateData({
      ...data,
      weeklyChores: data.weeklyChores.map((c) => ({
        ...c,
        isScheduled: false,
        assignedDateStr: undefined,
        assignedStartTime: undefined,
        assignedEndTime: undefined,
      })),
    });
  };

  // Distribute unscheduled chores across the current Mon-Sun week's lightest days.
  // Only sets isScheduled/assignedDateStr/assignedStartTime/assignedEndTime on the
  // chore itself — the scheduling engine renders the chore event fresh from that on
  // every regeneration (Step 5 of generateOptimizedSchedule), so there's no need to
  // separately persist synthetic events into scheduledEvents here.
  const handleDistributeChores = () => {
    const today = parseISO(getTodayStr());
    const dayOfWeek = today.getDay(); // 0=Sun..6=Sat
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = addDays(today, -diffToMonday);
    const weekDateStrs = Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'));

    const { updatedChores } = scheduleWeeklyChores(data, weekDateStrs);
    onUpdateData({
      ...data,
      weeklyChores: updatedChores,
    });
  };

  return (
    <aside
      className={`bg-white border-r border-stone-200 text-stone-800 transition-all duration-300 flex flex-col z-20 shadow-sm ${
        isOpen ? 'w-full md:w-80 xl:w-80' : 'w-12'
      }`}
    >
      {/* Sidebar Header & Toggle */}
      <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-white">
        {isOpen && (
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-vela-600" />
            <span className="font-display font-semibold text-sm text-stone-800">
              Schedule Inputs
            </span>
          </div>
        )}
        <button
          onClick={onToggleOpen}
          className="p-1.5 hover:bg-stone-100 text-stone-400 hover:text-stone-700 rounded transition-colors ml-auto"
          title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {!isOpen ? (
        <div className="flex flex-col items-center py-4 gap-4 text-stone-400">
          <BookOpen className="w-5 h-5 text-stone-600" />
          <Utensils className="w-5 h-5 text-stone-600" />
          <Bus className="w-5 h-5 text-stone-600" />
          <CalendarDays className="w-5 h-5 text-stone-600" />
          <Moon className="w-5 h-5 text-stone-600" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Subtabs Header */}
          <div className="grid grid-cols-5 bg-stone-100 p-1 border-b border-stone-200 text-[11px] font-medium">
            <button
              onClick={() => setActiveTab('anchors')}
              className={`py-1.5 text-center rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
                activeTab === 'anchors'
                  ? 'bg-white text-vela-600 font-bold shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Repeat className="w-3.5 h-3.5 text-rose-600" />
              <span>Routines</span>
            </button>
            <button
              onClick={() => setActiveTab('meals')}
              className={`py-1.5 text-center rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
                activeTab === 'meals'
                  ? 'bg-white text-vela-600 font-bold shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Meals</span>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-1.5 text-center rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
                activeTab === 'tasks'
                  ? 'bg-white text-vela-600 font-bold shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Bus className="w-3.5 h-3.5" />
              <span>Errands</span>
            </button>
            <button
              onClick={() => setActiveTab('onetime')}
              className={`py-1.5 text-center rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
                activeTab === 'onetime'
                  ? 'bg-white text-pink-600 font-bold shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Events</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-1.5 text-center rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
                activeTab === 'settings'
                  ? 'bg-white text-vela-600 font-bold shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Engine</span>
            </button>
          </div>

          <div className="p-5 space-y-6 flex-1 overflow-y-auto">
            {/* TAB 1: FIXED LECTURES & ANCHORS */}
            {activeTab === 'anchors' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <span>Recurring Series ({data.fixedAnchors.length})</span>
                  </h3>
                </div>

                {/* Add Anchor Form */}
                <form onSubmit={handleAddAnchor} className="bg-stone-50 p-3 rounded-md border border-stone-200 space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                      Academic / Professional Subject
                    </label>

                    {/* IISc Subject Quick Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <span className="text-[10px] text-stone-400 font-bold uppercase">Subjects:</span>
                      {[
                        { code: 'CMO', full: 'CMO: Convex Optimization' },
                        { code: 'StoMa', full: 'StoMa: Stochastic Models' },
                        { code: 'LAA', full: 'LAA: Linear Algebra & Apps' },
                        { code: 'DSA', full: 'DSA: Data Structures & Algos' },
                        { code: 'DS', full: 'DS: Data Science' },
                      ].map((subj) => (
                        <button
                          key={subj.code}
                          type="button"
                          onClick={() => setNewAnchorTitle(subj.full)}
                          className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors ${
                            newAnchorTitle === subj.full
                              ? 'bg-vela-600 text-white border-vela-600'
                              : 'bg-vela-50 hover:bg-vela-100 text-vela-700 border-vela-200'
                          }`}
                        >
                          {subj.code}
                        </button>
                      ))}
                    </div>

                    {/* IISc Subject Select Dropdown */}
                    <select
                      value={newAnchorTitle}
                      onChange={(e) => setNewAnchorTitle(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 text-xs text-stone-800 font-medium focus:outline-none focus:border-vela-500 mb-1.5"
                    >
                      <option value="">-- Select or type below --</option>
                      <option value="CMO: Convex Optimization">CMO: Convex Optimization</option>
                      <option value="StoMa: Stochastic Models">StoMa: Stochastic Models</option>
                      <option value="LAA: Linear Algebra & Apps">LAA: Linear Algebra & Apps</option>
                      <option value="DSA: Data Structures & Algos">DSA: Data Structures & Algos</option>
                      <option value="DS: Data Science">DS: Data Science</option>
                    </select>

                    <input
                      type="text"
                      placeholder="e.g. CMO, StoMa, LAA, DSA, DS or custom title"
                      value={newAnchorTitle}
                      onChange={(e) => setNewAnchorTitle(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-stone-600 block mb-1">Start Time</label>
                      <input
                        type="time"
                        value={newAnchorStart}
                        onChange={(e) => setNewAnchorStart(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-stone-600 block mb-1">End Time</label>
                      <input
                        type="time"
                        value={newAnchorEnd}
                        onChange={(e) => setNewAnchorEnd(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">Location / Classroom</label>
                    <input
                      type="text"
                      placeholder="e.g. Hall B, Lab 402"
                      value={newAnchorLocation}
                      onChange={(e) => setNewAnchorLocation(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                    />
                  </div>

                  {/* Day of Week Selector */}
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                      Days of the Week (Routine Schedule)
                    </label>
                    <div className="flex items-center gap-1">
                      {[
                        { num: 1, label: 'Mon' },
                        { num: 2, label: 'Tue' },
                        { num: 3, label: 'Wed' },
                        { num: 4, label: 'Thu' },
                        { num: 5, label: 'Fri' },
                        { num: 6, label: 'Sat' },
                        { num: 0, label: 'Sun' },
                      ].map((d) => {
                        const isActive = newAnchorDays.includes(d.num);
                        return (
                          <button
                            key={d.num}
                            type="button"
                            onClick={() => toggleAnchorDay(d.num)}
                            className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${
                              isActive
                                ? 'bg-vela-600 text-white border-vela-600 shadow-xs'
                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        checked={newAnchorOverrideSleep}
                        onChange={(e) => setNewAnchorOverrideSleep(e.target.checked)}
                        className="rounded border-stone-300 text-vela-600 focus:ring-vela-500"
                      />
                      <span>Override sleep (e.g. long travel/overnight)</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-vela-600 hover:bg-vela-700 text-white font-bold text-xs py-2 rounded transition-colors flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Routine Anchor
                  </button>
                </form>

                {/* List of Anchors */}
                <div className="space-y-2">
                  {data.fixedAnchors.map((anchor) => (
                    <div
                      key={anchor.id}
                      className="bg-stone-50 border border-stone-200 p-3 rounded-md flex items-center justify-between group hover:border-vela-300 transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-stone-800">{anchor.title}</span>
                          <span className="text-[10px] bg-vela-100 text-vela-700 px-2 py-0.5 rounded font-semibold">Fixed</span>
                        </div>
                        <div className="text-xs text-stone-500">
                          {formatTime12h(anchor.startTime)} — {formatTime12h(anchor.endTime)}
                          {anchor.location && <span> ({anchor.location})</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAnchor(anchor.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Anchor Series"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: ONE-TIME DATE EVENTS */}
            {activeTab === 'onetime' && (() => {
              const allOtc = data.oneTimeCommitments || [];
              const activeOtc = allOtc.filter((o) => !o.isCompleted);
              const completedOtc = allOtc.filter((o) => o.isCompleted);

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                      <span>One-Time Date Events ({activeOtc.length})</span>
                    </h3>
                  </div>

                  {/* Add One-Time Commitment Form */}
                  <form onSubmit={handleAddOneTime} className="bg-stone-50 p-3 rounded-md border border-stone-200 space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                        Event / Appointment Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Doctor appointment, Midterm Exam, Interview"
                        value={newOtcTitle}
                        onChange={(e) => setNewOtcTitle(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-stone-600 block mb-1">Date (YYYY-MM-DD)</label>
                      <input
                        type="date"
                        value={newOtcDate}
                        onChange={(e) => setNewOtcDate(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-stone-600 block mb-1">Start Time</label>
                        <input
                          type="time"
                          value={newOtcStart}
                          onChange={(e) => setNewOtcStart(e.target.value)}
                          className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-stone-600 block mb-1">End Time</label>
                        <input
                          type="time"
                          value={newOtcEnd}
                          onChange={(e) => setNewOtcEnd(e.target.value)}
                          className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-stone-600 block mb-1">Location / Venue</label>
                      <input
                        type="text"
                        placeholder="e.g. Health Center, Room 101"
                        value={newOtcLocation}
                        onChange={(e) => setNewOtcLocation(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-700">
                        <input
                          type="checkbox"
                          checked={newOtcOverrideSleep}
                          onChange={(e) => setNewOtcOverrideSleep(e.target.checked)}
                          className="rounded border-stone-300 text-vela-600 focus:ring-vela-500"
                        />
                        <span>Override sleep rules for this date</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs py-2 rounded transition-colors flex items-center justify-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add One-Time Commitment
                    </button>
                  </form>

                  {/* List of Active One-Time Commitments */}
                  <div className="space-y-2">
                    {activeOtc.length === 0 ? (
                      <p className="text-xs text-stone-400 text-center py-2 italic">
                        {completedOtc.length > 0 ? 'All one-time events completed!' : 'No one-time date commitments added yet.'}
                      </p>
                    ) : (
                      activeOtc.map((otc) => (
                        <div
                          key={otc.id}
                          className="bg-stone-50 border border-stone-200 p-2.5 rounded-md flex items-center justify-between group hover:border-pink-300 transition-all gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => handleToggleCompleteOneTime(otc.id)}
                              className="p-1 text-stone-400 hover:text-emerald-600 transition-colors shrink-0"
                              title="Mark as Completed"
                            >
                              <Circle className="w-4 h-4" />
                            </button>
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-stone-800 truncate">{otc.title}</span>
                                <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded font-semibold">
                                  {otc.dateStr}
                                </span>
                              </div>
                              <div className="text-[11px] text-stone-500">
                                {formatTime12h(otc.startTime)} — {formatTime12h(otc.endTime)}
                                {otc.location && <span> ({otc.location})</span>}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteOneTime(otc.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                            title="Delete One-Time Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Completed Events Section */}
                  {completedOtc.length > 0 && (
                    <div className="pt-3 border-t border-stone-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Completed Events ({completedOtc.length})</span>
                        </h4>
                      </div>
                      <div className="space-y-1.5">
                        {completedOtc.map((otc) => (
                          <div
                            key={otc.id}
                            className="bg-stone-100/80 border border-stone-200 p-2.5 rounded-md flex items-center justify-between group opacity-75 hover:opacity-100 transition-all gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => handleToggleCompleteOneTime(otc.id)}
                                className="p-1 text-emerald-600 hover:text-stone-400 transition-colors shrink-0"
                                title="Mark as Incomplete"
                              >
                                <CheckCircle2 className="w-4 h-4 fill-emerald-100" />
                              </button>
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-stone-500 line-through truncate">{otc.title}</span>
                                  <span className="text-[10px] bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded font-medium">
                                    {otc.dateStr}
                                  </span>
                                </div>
                                <div className="text-[11px] text-stone-400">
                                  {formatTime12h(otc.startTime)} — {formatTime12h(otc.endTime)}
                                  {otc.location && <span> ({otc.location})</span>}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteOneTime(otc.id)}
                              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                              title="Delete One-Time Event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB 2: MEALS & MESS WINDOWS */}
            {activeTab === 'meals' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-amber-600" /> Mess & Meal Timings
                  </h3>
                </div>

                {(['breakfast', 'lunch', 'snacks', 'dinner'] as const).map((mealKey) => {
                  const meal = data.mealConfig[mealKey];
                  if (!meal) return null;
                  return (
                    <div
                      key={mealKey}
                      className="bg-stone-50 p-3 rounded-md border border-stone-200 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-stone-800 capitalize flex items-center gap-1.5">
                          {meal.name}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={meal.enabled}
                            onChange={(e) => handleMealChange(mealKey, 'enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-vela-600"></div>
                        </label>
                      </div>

                      {meal.enabled && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-stone-500 block mb-1">Start</label>
                            <input
                              type="time"
                              value={meal.windowStart}
                              onChange={(e) => handleMealChange(mealKey, 'windowStart', e.target.value)}
                              className="w-full bg-white border border-stone-200 rounded px-1.5 py-1 text-stone-800 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 block mb-1">End</label>
                            <input
                              type="time"
                              value={meal.windowEnd}
                              onChange={(e) => handleMealChange(mealKey, 'windowEnd', e.target.value)}
                              className="w-full bg-white border border-stone-200 rounded px-1.5 py-1 text-stone-800 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 block mb-1">Dur (min)</label>
                            <input
                              type="number"
                              min="15"
                              max="120"
                              value={meal.durationMinutes}
                              onChange={(e) => handleMealChange(mealKey, 'durationMinutes', Number(e.target.value))}
                              className="w-full bg-white border border-stone-200 rounded px-1.5 py-1 text-stone-800 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: DYNAMIC TASKS & ERRANDS */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <span>Dynamic Errands</span>
                  </h3>
                  <span className="text-[10px] text-stone-500 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded font-semibold">
                    {data.dynamicTasks.length} Tasks
                  </span>
                </div>

                {/* Add Task Form */}
                <form onSubmit={handleAddTask} className="bg-stone-50 p-3 rounded-md border border-stone-200 space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 block mb-1">Errand / Task Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Grocery Run, Library Book Return"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                      required
                    />
                  </div>

                  {/* Transit Buffer Checkbox */}
                  <div className="bg-vela-50/80 p-2 rounded border border-vela-200 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-stone-800">
                      <input
                        type="checkbox"
                        checked={newTaskRequiresTransit}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNewTaskRequiresTransit(checked);
                          if (checked) {
                            setNewTaskBufferBefore(10);
                            setNewTaskBufferAfter(10);
                          }
                        }}
                        className="rounded border-stone-300 text-vela-600 focus:ring-vela-500 w-4 h-4"
                      />
                      <span>Requires Transit (10m buffer before & after)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-stone-500 block mb-1">Dur (m)</label>
                      <input
                        type="number"
                        min="15"
                        max="300"
                        value={newTaskDuration}
                        onChange={(e) => setNewTaskDuration(Number(e.target.value))}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-stone-500 block mb-1">Buffer Before</label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        disabled={newTaskRequiresTransit}
                        value={newTaskRequiresTransit ? 10 : newTaskBufferBefore}
                        onChange={(e) => setNewTaskBufferBefore(Number(e.target.value))}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500 disabled:bg-stone-100 disabled:text-stone-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-stone-500 block mb-1">Buffer After</label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        disabled={newTaskRequiresTransit}
                        value={newTaskRequiresTransit ? 10 : newTaskBufferAfter}
                        onChange={(e) => setNewTaskBufferAfter(Number(e.target.value))}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500 disabled:bg-stone-100 disabled:text-stone-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-stone-500 block mb-1 font-semibold">Category</label>
                      <select
                        value={newTaskCategory}
                        onChange={(e) => setNewTaskCategory(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500 font-medium"
                      >
                        <option value="Errand">Errand (10AM - 8PM)</option>
                        <option value="Study">Study / Work</option>
                        <option value="Travel">Long Travel</option>
                        <option value="Personal">Personal</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-stone-500 block mb-1 font-semibold">Priority</label>
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as 'high' | 'medium' | 'low')}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500 font-medium"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-stone-500 block mb-1 font-semibold">Deadline (Optional)</label>
                      <input
                        type="time"
                        value={newTaskDeadline}
                        onChange={(e) => setNewTaskDeadline(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500 font-medium"
                      />
                      <span className="text-[9px] text-stone-400 block mt-0.5">Hard cutoff — must finish by this time</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-stone-500 block mb-1 font-semibold">Start Date (Optional)</label>
                      <input
                        type="date"
                        value={newTaskStartDate}
                        onChange={(e) => setNewTaskStartDate(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-stone-500 block mb-1 font-semibold">End Date (Optional)</label>
                      <input
                        type="date"
                        value={newTaskEndDate}
                        onChange={(e) => setNewTaskEndDate(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        checked={newTaskOverrideSleep}
                        onChange={(e) => setNewTaskOverrideSleep(e.target.checked)}
                        className="rounded border-stone-300 text-vela-600 focus:ring-vela-500"
                      />
                      <span>Override sleep (e.g. long travel/overnight)</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-vela-600 hover:bg-vela-700 text-white font-bold text-xs py-2 rounded transition-colors flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Dynamic Errand / Task
                  </button>
                </form>

                {/* List of Dynamic Tasks */}
                <div className="space-y-2">
                  {data.dynamicTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-stone-50 border border-stone-200 p-3 rounded-md flex items-center justify-between group hover:border-vela-300 transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-sm font-semibold text-stone-800">{task.title}</span>
                          <span className="text-xs text-stone-500 font-medium">{task.durationMinutes}m</span>
                        </div>
                        <div className="text-[10px] text-stone-400 flex items-center gap-2">
                          <span>
                            Buffer: {task.transitBufferBeforeMinutes + task.transitBufferAfterMinutes}m transit
                          </span>
                          {task.isPinned && (
                            <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded text-[9px] flex items-center gap-0.5">
                              <Pin className="w-2.5 h-2.5 fill-amber-600" /> Pinned
                            </span>
                          )}
                          {task.deadline && (
                            <span className="bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded text-[9px]">
                              Due {task.deadline}
                            </span>
                          )}
                        </div>
                        {(task.scheduledStartDate || task.scheduledEndDate) && (
                          <div className="text-[10px] text-vela-600 font-bold flex items-center gap-1 mt-1 bg-vela-50/50 px-1.5 py-0.5 rounded w-max">
                            <CalendarDays className="w-3 h-3 text-vela-500" />
                            <span>
                              Slot: {task.scheduledStartDate || 'Anytime'} — {task.scheduledEndDate || 'Anytime'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {task.isPinned && (
                          <button
                            onClick={() => handleUnpinTask(task.id)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                            title="Unpin Task"
                          >
                            <PinOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

{/* TAB 4: SLEEP & POMODORO CONFIG */}
            {activeTab === 'settings' && (
              <div className="space-y-5">
                {/* Cycle Summary Card */}
                <section>
                  <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Cycle Architecture</h3>
                  <div className="bg-stone-900 text-white p-3.5 rounded-lg space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="opacity-70">Core Sleep:</span>
                      <span className="font-bold text-vela-400">
                        {formatDuration(data.sleepConfig.coreSleepDurationMinutes || 210)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="opacity-70">Naps Schedule:</span>
                      <span className="font-bold text-sky-300">
                        {data.sleepConfig.napsCount}x ({data.sleepConfig.napDurationMinutes || 30}m each)
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-stone-800 pt-1.5 mt-1">
                      <span className="opacity-70">Pomodoro Ratio:</span>
                      <span className="font-bold text-emerald-400">Elastic 50-60m Study / 15-20m Break</span>
                    </div>
                  </div>
                </section>

                {/* 1. Core Sleep & Nap Settings */}
                <div className="bg-stone-50 p-3.5 rounded-md border border-stone-200 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                      <Moon className="w-3.5 h-3.5 text-vela-600" /> Sleep Parameters
                    </h4>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={data.sleepConfig.enabled}
                        onChange={(e) => handleSleepChange('enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-vela-600"></div>
                    </label>
                  </div>

                  {data.sleepConfig.enabled && (
                    <>
                      {/* Core Sleep Config */}
                      <div className="space-y-2 border-b border-stone-200 pb-3">
                        <span className="text-[11px] font-bold text-stone-700 block uppercase tracking-wide">
                          Core Sleep Configuration
                        </span>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-stone-500 font-semibold block mb-1">Core Start Time</label>
                            <input
                              type="time"
                              value={data.sleepConfig.coreSleepStart}
                              onChange={(e) => handleSleepChange('coreSleepStart', e.target.value)}
                              className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-stone-800 text-xs font-medium focus:border-vela-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 font-semibold block mb-1">
                              Duration (Minutes)
                            </label>
                            <input
                              type="number"
                              min="60"
                              max="480"
                              step="15"
                              value={data.sleepConfig.coreSleepDurationMinutes || 210}
                              onChange={(e) =>
                                handleSleepChange('coreSleepDurationMinutes', Math.max(30, Number(e.target.value)))
                              }
                              className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-stone-800 text-xs font-bold focus:border-vela-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Decompression Wind-Down Slot */}
                        <div className="pt-1">
                          <label className="text-[10px] text-stone-500 font-semibold block mb-1">
                            Guilt-Free Wind-Down Decompression (Mins)
                          </label>
                          <input
                            type="number"
                            min="15"
                            max="120"
                            step="15"
                            value={data.decompressionMinutes ?? 45}
                            onChange={(e) =>
                              onUpdateData({
                                ...data,
                                decompressionMinutes: Math.max(15, Number(e.target.value)),
                              })
                            }
                            className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-stone-800 text-xs font-bold focus:border-vela-500 focus:outline-none"
                          />
                          <span className="text-[10px] text-stone-400 block mt-0.5">
                            Automatically reserved before core sleep for downtime.
                          </span>
                        </div>

                        {/* Core Duration Quick Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-stone-400 font-semibold">Quick:</span>
                          {[
                            { label: '180m (3.0h)', val: 180 },
                            { label: '210m (3.5h)', val: 210 },
                            { label: '240m (4.0h)', val: 240 },
                            { label: '270m (4.5h)', val: 270 },
                          ].map((p) => (
                            <button
                              key={p.val}
                              type="button"
                              onClick={() => handleSleepChange('coreSleepDurationMinutes', p.val)}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                                data.sleepConfig.coreSleepDurationMinutes === p.val
                                  ? 'bg-vela-600 text-white border-vela-600 font-bold'
                                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Nap Settings */}
                      <div className="space-y-2.5">
                        <span className="text-[11px] font-bold text-stone-700 block uppercase tracking-wide">
                          Power Nap Parameters
                        </span>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-stone-500 font-semibold block mb-1">
                              Nap Frequency / Count
                            </label>
                            <select
                              value={data.sleepConfig.napsCount}
                              onChange={(e) => {
                                const newCount = Number(e.target.value);
                                const defaultFallbacks = ['08:30', '13:30', '18:30', '22:00', '06:00'];
                                const updatedTimes = [...data.sleepConfig.preferredNapTimes];
                                while (updatedTimes.length < newCount) {
                                  updatedTimes.push(defaultFallbacks[updatedTimes.length % defaultFallbacks.length]);
                                }
                                onUpdateData({
                                  ...data,
                                  sleepConfig: {
                                    ...data.sleepConfig,
                                    napsCount: newCount,
                                    preferredNapTimes: updatedTimes.slice(0, newCount),
                                  },
                                });
                              }}
                              className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-stone-800 text-xs font-semibold focus:border-vela-500 focus:outline-none"
                            >
                              <option value={1}>1 Nap per day</option>
                              <option value={2}>2 Naps per day</option>
                              <option value={3}>3 Naps per day (Default E3)</option>
                              <option value={4}>4 Naps per day</option>
                              <option value={5}>5 Naps per day</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] text-stone-500 font-semibold block mb-1">
                              Nap Duration (Min)
                            </label>
                            <input
                              type="number"
                              min="10"
                              max="60"
                              step="5"
                              value={data.sleepConfig.napDurationMinutes || 30}
                              onChange={(e) =>
                                handleSleepChange('napDurationMinutes', Math.max(5, Number(e.target.value)))
                              }
                              className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-stone-800 text-xs font-bold focus:border-vela-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Preferred Nap Center Times */}
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-semibold text-stone-500 block">
                            Target Nap Center Times ({data.sleepConfig.napsCount} slots)
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {Array.from({ length: data.sleepConfig.napsCount }).map((_, idx) => (
                              <div key={idx} className="space-y-0.5">
                                <span className="text-[9px] text-stone-400 font-bold block">Nap #{idx + 1}</span>
                                <input
                                  type="time"
                                  value={data.sleepConfig.preferredNapTimes[idx] || '12:00'}
                                  onChange={(e) => {
                                    const newTimes = [...data.sleepConfig.preferredNapTimes];
                                    newTimes[idx] = e.target.value;
                                    handleSleepChange('preferredNapTimes', newTimes);
                                  }}
                                  className="w-full bg-white border border-stone-200 rounded px-1.5 py-1 text-xs text-stone-800 font-semibold focus:border-vela-500 focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 2. Pomodoro & Focus Block Settings */}
                <div className="bg-stone-50 p-3.5 rounded-md border border-stone-200 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Pomodoro Study Engine
                    </h4>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={data.pomodoroConfig.autoFillRemainingSlots}
                        onChange={(e) => handlePomodoroChange('autoFillRemainingSlots', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-vela-600"></div>
                    </label>
                  </div>

                  {data.pomodoroConfig.autoFillRemainingSlots && (
                    <div className="space-y-3 text-xs">
                      <p className="text-[10px] text-stone-400 leading-snug">
                        Study blocks elastically fill free time (50-60m focus / 15-20m mandatory break) — sized automatically to fit whatever gap is available.
                      </p>

                      <div>
                        <label className="text-[10px] text-stone-500 font-semibold block mb-1">Default Study Subject / Focus</label>
                        <input
                          type="text"
                          value={data.pomodoroConfig.defaultSubject || ''}
                          onChange={(e) => handlePomodoroChange('defaultSubject', e.target.value)}
                          placeholder="e.g. Deep Research, Math Practice"
                          className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-stone-800 text-xs focus:border-vela-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Weekly Chores Pool Card */}
                <div className="bg-stone-50 border border-stone-200 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-amber-600" /> Weekly Chores Pool
                    </h4>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-snug">
                    Chores added here get auto-slotted into the lightest-loaded free time across this Mon-Sun week when you distribute them.
                  </p>

                  <div className="space-y-1.5">
                    {data.weeklyChores.length === 0 ? (
                      <div className="text-xs text-stone-400 italic">No chores in the pool yet.</div>
                    ) : (
                      data.weeklyChores.map((chore) => (
                        <div
                          key={chore.id}
                          className="flex items-center justify-between text-xs bg-white p-2 rounded border border-stone-200 gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-stone-700 truncate">{chore.title}</div>
                            <div className="text-[10px] text-stone-400 font-medium">
                              {chore.durationMinutes}m • {chore.priority}
                              {chore.isScheduled && chore.assignedDateStr
                                ? ` • ${chore.assignedDateStr} ${chore.assignedStartTime}-${chore.assignedEndTime}`
                                : ' • Unscheduled'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteChore(chore.id)}
                            className="p-1 rounded bg-white hover:bg-red-50 text-stone-500 hover:text-red-600 border border-stone-300 transition-colors shrink-0"
                            title="Delete Chore"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddChore} className="space-y-2 pt-1 border-t border-stone-200">
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        type="text"
                        placeholder="Chore title"
                        value={newChoreTitle}
                        onChange={(e) => setNewChoreTitle(e.target.value)}
                        className="col-span-2 bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                        required
                      />
                      <input
                        type="number"
                        min="10"
                        max="240"
                        value={newChoreDuration}
                        onChange={(e) => setNewChoreDuration(Number(e.target.value))}
                        className="bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                        title="Duration (minutes)"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={newChorePriority}
                        onChange={(e) => setNewChorePriority(e.target.value as 'high' | 'medium' | 'low')}
                        className="bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 font-medium focus:outline-none focus:border-vela-500"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Category (optional)"
                        value={newChoreCategory}
                        onChange={(e) => setNewChoreCategory(e.target.value)}
                        className="bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-vela-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full text-[11px] py-1.5 bg-white hover:bg-stone-100 text-stone-700 font-bold border border-stone-200 rounded transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Chore to Pool
                    </button>
                  </form>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleDistributeChores}
                      className="flex-1 text-[11px] py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded transition-colors"
                    >
                      Distribute This Week's Chores
                    </button>
                    <button
                      type="button"
                      onClick={handleResetChoreSchedule}
                      className="text-[11px] py-1.5 px-2 bg-white hover:bg-stone-100 text-stone-600 font-bold border border-stone-200 rounded transition-colors"
                      title="Clear all assignments so chores can be redistributed"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Adaptive Friction (Local Habit-Learning ML) Card */}
                <div className="bg-stone-50 border border-stone-200 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Adaptive Habit Analytics (Local Engine)
                    </h4>
                    <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded border border-purple-200">
                      ACTIVE (EMA)
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-snug">
                    Calculates rolling Exponential Moving Average (EMA) friction multipliers based on your actual task completion times vs planned durations.
                  </p>

                  <div className="space-y-1.5 pt-1">
                    {data.habitModel?.categories ? (
                      Object.entries(data.habitModel.categories).map(([catKey, habit]) => {
                        const h = habit as CategoryHabitData;
                        const multPercent = Math.round((h.frictionMultiplier || 1.0) * 100);
                        const isElevated = (h.frictionMultiplier || 1.0) > 1.05;
                        return (
                          <div
                            key={catKey}
                            className="flex items-center justify-between text-xs bg-white p-2 rounded border border-stone-200"
                          >
                            <div className="flex items-center gap-1.5 capitalize font-medium text-stone-700">
                              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                              {catKey.replace('_', ' ')}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-stone-400 font-medium">
                                {h.sampleCount || 0} samples
                              </span>
                              <span
                                className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                                  isElevated
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-stone-100 text-stone-700'
                                }`}
                              >
                                {h.frictionMultiplier?.toFixed(2)}x ({multPercent}%)
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-stone-400 italic">No habit data recorded yet.</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateData({
                        ...data,
                        habitModel: {
                          categories: {
                            task: { frictionMultiplier: 1.0, sampleCount: 0 },
                            pomodoro_study: { frictionMultiplier: 1.0, sampleCount: 0 },
                            chore: { frictionMultiplier: 1.0, sampleCount: 0 },
                            study: { frictionMultiplier: 1.0, sampleCount: 0 },
                            errands: { frictionMultiplier: 1.0, sampleCount: 0 },
                            morningroutine: { frictionMultiplier: 1.0, sampleCount: 0 },
                            custom: { frictionMultiplier: 1.0, sampleCount: 0 },
                          },
                        },
                      });
                    }}
                    className="w-full text-[10px] py-1 bg-white hover:bg-stone-100 text-stone-600 font-bold border border-stone-200 rounded transition-colors mt-2"
                  >
                    Reset ML Multipliers to 1.0x Baseline
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Footer Action */}
          <div className="p-6 border-t border-stone-100 bg-white">
            <button
              onClick={onGenerateSchedule}
              className="w-full py-3 bg-vela-600 hover:bg-vela-700 text-white font-bold rounded-xl shadow-lg shadow-vela-200 text-sm tracking-wide transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Schedule
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
