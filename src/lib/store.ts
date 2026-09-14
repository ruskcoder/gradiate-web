import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PLATFORMS } from './constants';

type Platform = typeof PLATFORMS[number];

export interface BellSchedule {
  name: string;
  periods: Array<{
    period: number | string;
    startTime: string;
    endTime: string;
    name?: string;
  }>;
}

export interface TodoItem {
  id: string;
  title: string;
  dueDate: Date | null;
  completed: boolean;
  // Set on todos created automatically (e.g. from a missing assignment) so they
  // can be deduped against later refreshes. Absent on user-created todos.
  source?: string;
}

export interface AlertSettings {
  // Also raise a system notification (needs browser permission).
  browserNotifications: boolean;
  // Background refresh interval while the app is open; 0 = off.
  autoRefreshMinutes: number;
}

export interface Shortcut {
  id: string;
  title: string;
  url: string;
  image: string;
}

export interface User {
  loginType: '' | 'credentials' | 'classlink' | 'classlinkCredentials';
  username: string;
  password: string;
  platform: Platform;
  link: string;
  clsession: string;
  // ClassLink district code (trailing segment of a launchpad link), sent as
  // `code` for `classlinkCredentials` logins. Empty for other login types.
  code: string;
  // Stored answer to this account's ClassLink 2FA challenge (a fixed PIN string
  // or the chosen icon filename) so re-auth on page load is silent.
  clMFA: string;
  // Which kind of 2FA this account uses ('pin' | 'image' | '').
  mfaType: '' | 'pin' | 'image';
  // Multi-student portals (e.g. a PowerSchool parent account): the chosen
  // student's id, threaded into every data request; `students` is the full
  // roster so the header/settings can offer a switcher.
  studentId?: string;
  students?: Array<{ id: string; name: string }>;
  name: string;
  avatar: string;
  district: string;
  school: string;
  // Date of birth as the portal reports it (HAC/Skyward supply it from `/info`;
  // PowerSchool's guardian home carries none, so it stays empty). Only used to
  // fill the header of an exported unofficial transcript.
  dob: string;
  colorTheme: string;
  theme: 'light' | 'dark';
  color: string;
  gradesView: 'card' | 'list';
  showPageTitles?: boolean;
  matchThemeWithLogo?: boolean;
  hideColors?: boolean;
  numberDisplay?: 'decimal' | 'rounded' | 'letter' | 'letter+';
  animationsEnabled?: boolean;
  bellSchedules: BellSchedule[];
  lastLogin: Date | null;
  courseTypesByCourseName: Record<string, string>;
  deletedTranscriptCourses: string[];
  customCourses: Array<{ courseName: string; grade: string; type: string }>;
  rankDataPoints: Array<{ gpa: number | null; rank: number | null }>;
  todos: TodoItem[];
  shortcuts: Shortcut[];
  // Target average per class, keyed `${course}|${name}`.
  goals: Record<string, number>;
  // Free-form notes per class, keyed `${course}|${name}`.
  classNotes: Record<string, string>;
  alertSettings: AlertSettings;
  // Popup when a load finds changed averages or new assignments (same field as mobile).
  changeAlerts?: boolean;
  // Page opened after login / at the app root.
  defaultPage?: 'dashboard' | 'grades';
  // Which built-in bell schedule set has been applied (see lib/bell-schedules).
  bellSchedulesVersion?: number;
  // Create todos for missing assignments after each grades refresh.
  autoTodoFromMissing: boolean;
  // Name of the bell schedule the dashboard uses for "current period".
  activeBellSchedule: string;
  gradesStore: {
    initialTerm: string;
    termList: string[];
    // The cascading term hierarchy, persisted so "Load from Storage" can rebuild
    // the same nested subtabs offline instead of collapsing to a flat term row.
    termTree: any[];
    currentTerms: string[];
    hasSubterms: boolean;
    history: Record<string, Record<string, Array<{ loadedAt: number; average: any; categories: any; scores: any[] }>>>;
  };
}

/** Metadata describing the term hierarchy for a grades payload. */
export interface GradesTermMeta {
  termTree?: any[];
  currentTerms?: string[];
  hasSubterms?: boolean;
}

type GradesHistory = User['gradesStore']['history'];

/**
 * Push one snapshot into a term's per-course history, deduping against an
 * identical latest entry (refresh its timestamp instead of appending).
 */
function pushSnapshot(
  termBucket: Record<string, Array<{ loadedAt: number; average: any; categories: any; scores: any[] }>>,
  courseKey: string,
  snapshot: { loadedAt: number; average: any; categories: any; scores: any[] }
): void {
  const courseHistory = termBucket[courseKey] ? [...termBucket[courseKey]] : [];
  termBucket[courseKey] = courseHistory;
  const latest = courseHistory[courseHistory.length - 1];
  const unchanged =
    latest &&
    JSON.stringify(latest.average) === JSON.stringify(snapshot.average) &&
    JSON.stringify(latest.categories) === JSON.stringify(snapshot.categories) &&
    JSON.stringify(latest.scores) === JSON.stringify(snapshot.scores);
  if (unchanged) courseHistory[courseHistory.length - 1] = snapshot;
  else courseHistory.push(snapshot);
}

/**
 * Append this load's per-course snapshots into the term history, immutably —
 * platform-agnostic so one storage model serves every portal:
 *
 *  - Inline single-term data (HAC's /classes, or any /single-class detail):
 *    the class carries `average`/`categories`/`scores` for ONE term → stored
 *    under `term`.
 *  - Averages-only data (Skyward's /classes): the class carries an `averages`
 *    dict keyed by every term/subterm label and no scores → a numeric-average
 *    snapshot is recorded under EACH of those labels at once, so history,
 *    timeline and "Load from Storage" have every term without extra fetches.
 *
 * Shared by `addGradesStore` (resets initialTerm/termList) and
 * `addGradesStoreLoad` (preserves them).
 */
function mergeClassesIntoHistory(
  history: GradesHistory,
  term: string,
  classes: any[]
): GradesHistory {
  const newHistory = { ...history };
  const ensureTerm = (t: string) => {
    newHistory[t] = newHistory[t] ? { ...newHistory[t] } : {};
    return newHistory[t];
  };

  for (const classData of classes) {
    const courseKey = `${classData.course}|${classData.name}`;
    const hasDetail =
      (Array.isArray(classData.scores) && classData.scores.length > 0) ||
      (classData.categories && Object.keys(classData.categories).length > 0);
    const averagesDict =
      classData.averages && typeof classData.averages === 'object' ? classData.averages : null;

    if (!hasDetail && averagesDict) {
      // Averages-only: record a snapshot for every label that holds a number
      // (skips non-numeric marks like citizenship 'S' and blank columns).
      for (const label of Object.keys(averagesDict)) {
        const avg = averagesDict[label];
        if (avg === undefined || avg === null || avg === '' || isNaN(parseFloat(avg))) continue;
        pushSnapshot(ensureTerm(label), courseKey, {
          loadedAt: Date.now(),
          average: avg,
          categories: undefined,
          scores: undefined as any,
        });
      }
    } else {
      const average = classData.average ?? (averagesDict ? averagesDict[term] : undefined);
      pushSnapshot(ensureTerm(term), courseKey, {
        loadedAt: Date.now(),
        average,
        categories: classData.categories,
        scores: classData.scores,
      });
    }
  }

  return newHistory;
}

const DEFAULT_USER: User = {
  loginType: '',
  username: '',
  password: '',
  platform: 'hac',
  link: '',
  clsession: '',
  code: '',
  clMFA: '',
  mfaType: '',
  studentId: '',
  students: [],
  name: '',
  avatar: '',
  district: '',
  school: '',
  dob: '',
  colorTheme: 'default',
  theme: 'light',
  color: 'blue',
  gradesView: 'list',
  showPageTitles: true,
  matchThemeWithLogo: false,
  hideColors: false,
  numberDisplay: 'decimal',
  animationsEnabled: true,
  bellSchedules: [],
  lastLogin: null,
  courseTypesByCourseName: {},
  deletedTranscriptCourses: [],
  customCourses: [],
  rankDataPoints: [
    { gpa: null, rank: null },
    { gpa: null, rank: null }
  ],
  todos: [],
  shortcuts: [],
  goals: {},
  classNotes: {},
  alertSettings: {
    browserNotifications: false,
    autoRefreshMinutes: 0,
  },
  changeAlerts: true,
  defaultPage: 'dashboard',
  bellSchedulesVersion: 0,
  autoTodoFromMissing: false,
  activeBellSchedule: '',
  gradesStore: {
    initialTerm: '',
    termList: [],
    termTree: [],
    currentTerms: [],
    hasSubterms: false,
    history: {},
  },
};

/**
 * Stable identity of a saved account. Two logins with the same key are the same
 * account (re-adding one updates it instead of duplicating it). Matches the
 * cache scope in grades-api.ts.
 */
export const accountKey = (u: Pick<User, 'platform' | 'link' | 'username'> & { studentId?: string }) =>
  `${u.platform}|${u.link}|${u.username}|${u.studentId || ''}`;

interface Session {
  loginTime?: number;
  lastActivity?: number;
  [key: string]: any;
}

interface UserStore {
  users: User[];
  currentUserIndex: number;
  session: Session;
  cache: Record<string, any>;
  cacheTimestamp?: number | null;

  currentUser: () => User | null;

  setUsers: (users: User[]) => void;
  setCurrentUserIndex: (index: number) => void;
  /** Adds an account (or updates the matching saved one) and returns its index. */
  addUser: (user?: Partial<User>) => number;
  /** Make another saved account active. */
  switchUser: (index: number) => void;
  removeUser: (index: number) => void;
  changeUserData: (key: keyof User, value: any) => void;
  setSession: (session: Partial<Session>) => void;
  getCacheValue: (key: string) => any;
  setCacheValue: (key: string, value: any) => void;
  clearCache: () => void;
  invalidateCache: (endpoint: string) => void;
  addTodo: (todo: Omit<TodoItem, 'id'>) => void;
  updateTodo: (id: string, updates: Partial<TodoItem>) => void;
  removeTodo: (id: string) => void;
  toggleTodoComplete: (id: string) => void;
  addShortcut: (shortcut: Omit<Shortcut, 'id'>) => void;
  updateShortcut: (id: string, updates: Partial<Shortcut>) => void;
  removeShortcut: (id: string) => void;
  addGradesStore: (initialTerm: string, termList: string[], term: string, classes: any[], meta?: GradesTermMeta) => void;
  addGradesStoreLoad: (term: string, classes: any[]) => void;
  updateLatestGradesLoadTime: (term: string) => void;
  getGradesStore: () => {
    initialTerm: string;
    termList: string[];
    termTree: any[];
    currentTerms: string[];
    hasSubterms: boolean;
    history: GradesHistory;
  };
  clearGradesStore: () => void;
}

export const useStore = create<UserStore>()(
  persist(
    (set, get) => ({
      users: [],
      currentUserIndex: -1,
      session: {},
      cache: {},
      cacheTimestamp: null,

      currentUser: (): User | null => {
        const { users, currentUserIndex } = get();
        if (users.length === 0 || currentUserIndex < 0 || currentUserIndex >= users.length) {
          return null;
        }
        return users[currentUserIndex]!;
      },

      setUsers: (users: User[]) => {
        set({ users });
      },

      setCurrentUserIndex: (index: number) => {
        set({ currentUserIndex: index });
      },

      addUser: (user?: Partial<User>) => {
        const candidate = { ...DEFAULT_USER, ...user } as User;
        const existing = get().users.findIndex((u) => accountKey(u) === accountKey(candidate));
        if (existing !== -1) {
          // Same account signed in again: refresh its login details but keep its
          // history, todos and preferences.
          set((state) => {
            const users = [...state.users];
            users[existing] = { ...users[existing], ...user } as User;
            return { users };
          });
          return existing;
        }
        set((state) => ({ users: [...state.users, candidate] }));
        return get().users.length - 1;
      },

      switchUser: (index: number) => {
        const { users, currentUserIndex } = get();
        if (index < 0 || index >= users.length || index === currentUserIndex) return;
        // The API session belongs to the portal login of the previous account.
        // The response cache is scoped per account, so it can stay.
        set({ currentUserIndex: index, session: {} });
      },

      removeUser: (index: number) => {
        set((state) => {
          if (index < 0 || index >= state.users.length) return {};
          const newUsers = state.users.filter((_, i) => i !== index);
          const removingCurrent = index === state.currentUserIndex;
          let newIndex = state.currentUserIndex;

          // Removing an account listed before the active one shifts it down.
          if (index < newIndex) newIndex -= 1;
          if (newIndex >= newUsers.length) newIndex = newUsers.length - 1;

          if (!removingCurrent) return { users: newUsers, currentUserIndex: newIndex };

          const removedScope = `${accountKey(state.users[index]!)}::`;
          const cache: Record<string, any> = {};
          for (const key of Object.keys(state.cache)) {
            if (!key.startsWith(removedScope)) cache[key] = state.cache[key];
          }
          return {
            users: newUsers,
            currentUserIndex: newIndex,
            // The API session belongs to the removed account; drop it and its
            // cached responses so nothing leaks into the next account.
            session: {},
            cache,
          };
        });
      },

      changeUserData: (key: keyof User, value: any) => {
        set((state) => {
          const newUsers = [...state.users];
          if (newUsers[state.currentUserIndex]) {
            newUsers[state.currentUserIndex] = {
              ...newUsers[state.currentUserIndex],
              [key]: value,
            } as User;
          }
          return { users: newUsers };
        });
      },

      setSession: (session: Partial<Session>) => {
        set((state) => ({
          session: { ...state.session, ...session },
        }));
      },

      getCacheValue: (key: string) => {
        return get().cache[key];
      },

      setCacheValue: (key: string, value: any) => {
        set((state) => ({
          cache: { ...state.cache, [key]: value },
          cacheTimestamp: Date.now(),
        }));
      },

      clearCache: () => {
        set({ cache: {}, cacheTimestamp: null });
      },

      // Drop cached responses for one endpoint (keys are `scope::endpoint:options`)
      // so the next call re-fetches — used by background refresh.
      invalidateCache: (endpoint: string) => {
        set((state) => {
          const cache: Record<string, any> = {};
          for (const key of Object.keys(state.cache)) {
            if (!key.includes(`::${endpoint}:`)) cache[key] = state.cache[key];
          }
          return { cache };
        });
      },

      addTodo: (todo: Omit<TodoItem, 'id'>) => {
        set((state) => {
          const newUsers = [...state.users];
          if (newUsers[state.currentUserIndex]) {
            const id = Math.random().toString(36).substr(2, 9);
            const currentUser = newUsers[state.currentUserIndex]!;
            newUsers[state.currentUserIndex] = {
              ...currentUser,
              todos: [...(currentUser.todos || []), { ...todo, id }],
            } as User;
          }
          return { users: newUsers };
        });
      },

      updateTodo: (id: string, updates: Partial<TodoItem>) => {
        set((state) => {
          const newUsers = [...state.users];
          if (newUsers[state.currentUserIndex]) {
            const currentUser = newUsers[state.currentUserIndex]!;
            newUsers[state.currentUserIndex] = {
              ...currentUser,
              todos: (currentUser.todos || []).map((todo) =>
                todo.id === id ? { ...todo, ...updates } : todo
              ),
            } as User;
          }
          return { users: newUsers };
        });
      },

      removeTodo: (id: string) => {
        set((state) => {
          const newUsers = [...state.users];
          if (newUsers[state.currentUserIndex]) {
            const currentUser = newUsers[state.currentUserIndex]!;
            newUsers[state.currentUserIndex] = {
              ...currentUser,
              todos: (currentUser.todos || []).filter((todo) => todo.id !== id),
            } as User;
          }
          return { users: newUsers };
        });
      },

      toggleTodoComplete: (id: string) => {
        set((state) => {
          const newUsers = [...state.users];
          if (newUsers[state.currentUserIndex]) {
            const currentUser = newUsers[state.currentUserIndex]!;
            newUsers[state.currentUserIndex] = {
              ...currentUser,
              todos: (currentUser.todos || []).map((todo) =>
                todo.id === id ? { ...todo, completed: !todo.completed } : todo
              ),
            } as User;
          }
          return { users: newUsers };
        });
      },

      addShortcut: (shortcut: Omit<Shortcut, 'id'>) => {
        set((state) => {
          const newUsers = [...state.users];
          if (newUsers[state.currentUserIndex]) {
            const id = Math.random().toString(36).substr(2, 9);
            const currentUser = newUsers[state.currentUserIndex]!;
            newUsers[state.currentUserIndex] = {
              ...currentUser,
              shortcuts: [...(currentUser.shortcuts || []), { ...shortcut, id }],
            } as User;
          }
          return { users: newUsers };
        });
      },

      updateShortcut: (id: string, updates: Partial<Shortcut>) => {
        set((state) => {
          const newUsers = [...state.users];
          if (newUsers[state.currentUserIndex]) {
            const currentUser = newUsers[state.currentUserIndex]!;
            newUsers[state.currentUserIndex] = {
              ...currentUser,
              shortcuts: (currentUser.shortcuts || []).map((shortcut) =>
                shortcut.id === id ? { ...shortcut, ...updates } : shortcut
              ),
            } as User;
          }
          return { users: newUsers };
        });
      },

      removeShortcut: (id: string) => {
        set((state) => {
          const newUsers = [...state.users];
          if (newUsers[state.currentUserIndex]) {
            const currentUser = newUsers[state.currentUserIndex]!;
            newUsers[state.currentUserIndex] = {
              ...currentUser,
              shortcuts: (currentUser.shortcuts || []).filter((shortcut) => shortcut.id !== id),
            } as User;
          }
          return { users: newUsers };
        });
      },

      addGradesStore: (initialTerm: string, termList: string[], term: string, classes: any[], meta?: GradesTermMeta) => {
        set((state) => {
          const newUsers = [...state.users];
          const currentUser = newUsers[state.currentUserIndex];
          if (currentUser) {
            const prev = currentUser.gradesStore;
            newUsers[state.currentUserIndex] = {
              ...currentUser,
              gradesStore: {
                initialTerm,
                termList,
                // Persist the cascade (fall back to the previous values when a
                // payload omits them) so storage keeps the nested subtabs.
                termTree: meta?.termTree ?? prev.termTree ?? [],
                currentTerms: meta?.currentTerms ?? prev.currentTerms ?? [],
                hasSubterms: meta?.hasSubterms ?? prev.hasSubterms ?? false,
                history: mergeClassesIntoHistory(prev.history, term, classes),
              },
            } as User;
          }
          return { users: newUsers };
        });
      },

      addGradesStoreLoad: (term: string, classes: any[]) => {
        set((state) => {
          const newUsers = [...state.users];
          const currentUser = newUsers[state.currentUserIndex];
          if (currentUser) {
            newUsers[state.currentUserIndex] = {
              ...currentUser,
              gradesStore: {
                ...currentUser.gradesStore,
                history: mergeClassesIntoHistory(currentUser.gradesStore.history, term, classes),
              },
            } as User;
          }
          return { users: newUsers };
        });
      },

      updateLatestGradesLoadTime: (term: string) => {
        set((state) => {
          const newUsers = [...state.users];
          if (newUsers[state.currentUserIndex]) {
            const currentUser = newUsers[state.currentUserIndex]!;
            const newHistory = { ...currentUser.gradesStore.history };
            if (newHistory[term]) {
              newHistory[term] = { ...newHistory[term] };

              for (const courseKey in newHistory[term]) {
                const courseHistory = newHistory[term][courseKey];
                if (courseHistory && courseHistory.length > 0) {
                  const latestEntry = courseHistory[courseHistory.length - 1];
                  if (latestEntry) {
                    courseHistory[courseHistory.length - 1] = {
                      loadedAt: Date.now(),
                      average: latestEntry.average,
                      categories: latestEntry.categories,
                      scores: latestEntry.scores,
                    };
                  }
                }
              }
              newUsers[state.currentUserIndex] = {
                ...currentUser,
                gradesStore: {
                  ...currentUser.gradesStore,
                  history: newHistory,
                },
              } as User;
            }
          }
          return { users: newUsers };
        });
      },

      getGradesStore: () => {
        const emptyStore = {
          initialTerm: '', termList: [], termTree: [], currentTerms: [],
          hasSubterms: false, history: {} as GradesHistory,
        };
        const { users, currentUserIndex } = get();
        if (users.length === 0 || currentUserIndex < 0 || currentUserIndex >= users.length) {
          return emptyStore;
        }
        const store = users[currentUserIndex]?.gradesStore;
        if (!store) {
          return emptyStore;
        }
        return {
          initialTerm: store.initialTerm,
          termList: store.termList,
          termTree: store.termTree ?? [],
          currentTerms: store.currentTerms ?? [],
          hasSubterms: store.hasSubterms ?? false,
          history: store.history,
        };
      },

      clearGradesStore: () => {
        set((state) => {
          const newUsers = [...state.users];
          if (newUsers[state.currentUserIndex]) {
            const currentUser = newUsers[state.currentUserIndex]!;
            newUsers[state.currentUserIndex] = {
              ...currentUser,
              gradesStore: {
                initialTerm: '',
                termList: [],
                termTree: [],
                currentTerms: [],
                hasSubterms: false,
                history: {},
              },
            } as User;
          }
          return { users: newUsers };
        });
      },
    }),
    {
      name: 'user-store', 
      partialize: (state) => ({
        users: state.users,
        currentUserIndex: state.currentUserIndex,
      }),
      onRehydrateStorage: () => (persistedState) => {
        try {
          if (!persistedState || !Array.isArray(persistedState.users)) return

          const mergedUsers = persistedState.users.map((u: Partial<User>) => {
            return {
              ...DEFAULT_USER,
              ...u,
            } as User
          })

          let idx = -1
          const rawIdx: any = (persistedState as any).currentUserIndex
          if (typeof rawIdx === 'number') {
            idx = rawIdx
          } else if (typeof rawIdx === 'string' && rawIdx.trim() !== '') {
            const parsed = parseInt(rawIdx, 10)
            if (!isNaN(parsed)) idx = parsed
          }

          if (idx >= mergedUsers.length) {
            idx = mergedUsers.length - 1
          }
          if (idx < -1) {
            idx = -1
          }

          ;(persistedState as any).users = mergedUsers
          ;(persistedState as any).currentUserIndex = idx
        } catch (e) {
          console.error(e)
        }
      },
    }
  )
);

export const useCurrentUser = () => {
  return useStore((state) => {
    const { users, currentUserIndex } = state;
    if (users.length === 0 || currentUserIndex < 0 || currentUserIndex >= users.length) return null;
    return users[currentUserIndex];
  });
};

/** Route for the user's chosen start page. */
export const homePath = (user: User | null | undefined = useStore.getState().currentUser()) =>
  user?.defaultPage === 'grades' ? '/grades' : '/dashboard';

export const currentUser = () => {
  return useStore.getState().currentUser();
};

export const getSession = () => {
  return useStore.getState().session;
};

export const setSession = (session: Partial<Session>) => {
  useStore.getState().setSession(session);
};

