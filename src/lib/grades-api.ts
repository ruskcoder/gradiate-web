import { LOGIN_TYPES, API_URL, API_PLATFORM_ENDPOINTS, LOGIN_ENDPOINT, DISTRICTS_ENDPOINT, AUTH_METHODS_ENDPOINT, PLATFORMS, CLASSES_ENDPOINT, SINGLE_CLASS_ENDPOINT, ATTENDANCE_ENDPOINT, SCHEDULE_ENDPOINT, BELL_SCHEDULE_ENDPOINT, TRANSCRIPT_ENDPOINT, REPORT_CARD_ENDPOINT, PROGRESS_REPORT_ENDPOINT, TEACHERS_ENDPOINT } from "@/lib/constants";
import { pathMerge } from "@/lib/utils";
import { setSession, currentUser, getSession, useStore } from "@/lib/store";
import { initializeGradesStore, addGradesLoad } from "@/lib/grades-store";
import { withGradeChangeDetection } from "@/lib/grade-alerts";

type Platform = typeof PLATFORMS[number];
type LoginType = typeof LOGIN_TYPES[number];

/** Identity of the signed-in account, so cached responses never leak across a
 *  sign-out / sign-in or account switch (the cache is one global map, not
 *  per-user). Without this, switching accounts showed the previous account's
 *  grades until a manual refresh. */
function userScope(): string {
  const u = currentUser();
  if (!u) return 'anon';
  return `${u.platform}|${u.link}|${u.username}|${u.studentId || ''}`;
}

function generateCacheKey(endpoint: string, options: Record<string, any> = {}): string {
  const optionsStr = Object.keys(options).length > 0 ? JSON.stringify(options) : 'no-options';
  return `${userScope()}::${endpoint}:${optionsStr}`;
}

function getCachedValue(key: string): any {
  return useStore.getState().getCacheValue(key);
}

function setCachedValue(key: string, value: any): void {
  useStore.getState().setCacheValue(key, value);
}

/**
 * Handles authentication errors by redirecting to login with username prefilled
 * Keeps user data intact, only requires password update
 */
function handleAuthError(response: Response, data: any, user: any): void {
  const msg: string = data?.message || '';
  const isAuthError = response.status === 401 ||
    // A data call needing a fresh ClassLink 2FA answer can't be resolved inline —
    // bounce to the login screen to re-verify.
    data?.mfaRequired === true ||
    msg.includes('Invalid') ||
    msg.includes('password') ||
    msg.includes('Session') ||
    msg.includes('PIN') ||
    msg.includes('image') ||
    msg.includes('two-factor') ||
    msg.includes('ClassLink');

  if (isAuthError && user?.username) {
    // Keep user in store, just redirect to login to update password
    const params = new URLSearchParams();
    params.set('username', user.username);
    params.set('reason', 'password_expired');
    if (user.district) params.set('district', user.district);
    if (user.link) params.set('link', user.link);
    if (user.platform) params.set('platform', user.platform);
    if (user.loginType) params.set('loginType', user.loginType);
    if (user.code) params.set('code', user.code);
    
    const loginUrl = `/login?${params.toString()}`;
    window.location.href = loginUrl;
    
    throw new Error('Password expired - redirecting to login');
  }
}

/**
 * Authenticate against a platform. Returns the raw API response. Two non-error
 * shapes the caller must handle:
 *   - `{ success: true, ... }`  — logged in.
 *   - `{ mfaRequired: true, mfaType, icons? }` — a ClassLink second factor is
 *     needed. The mid-challenge session is persisted here; the caller shows the
 *     2FA prompt and calls `login` again with `loginDetails.clMFA` set to finish.
 *
 * For `classlinkCredentials` the first attempt is sent as a *fresh* login (empty
 * session); only the 2FA follow-up (`clMFA` present) reuses the stored challenge
 * session, so a leftover session can't hijack a new ClassLink login.
 */
export async function login(
  platform: Platform,
  loginType: LoginType,
  loginDetails: Record<string, string>
) {
  const isClassLinkCreds = loginType === 'classlinkCredentials';
  const isMfaResume = isClassLinkCreds && !!loginDetails.clMFA;
  const session = isClassLinkCreds && !isMfaResume ? {} : getSession();

  const body = {
    loginType: loginType,
    loginData: loginDetails,
    options: {},
    session: session
  }

  const endpoint = pathMerge(API_URL, API_PLATFORM_ENDPOINTS[platform], LOGIN_ENDPOINT);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  // A 2FA challenge comes back as `success: false, mfaRequired: true`. Persist
  // the challenge session and hand it back rather than throwing.
  if (data?.mfaRequired) {
    if (data.session) setSession(data.session);
    return data;
  }

  if (!response.ok || data.success == false) {
    throw new Error(data.message || 'Login failed with status code ' + response.status);
  }
  if (data.session) setSession(data.session);
  return data;
}

/**
 * Ask the API whether a portal `link` fronts multiple districts (a shared HAC
 * login `<select>`). Used by the Custom-login flow's "fetch details" step.
 * Never throws — on any failure reports a single-district link.
 */
export async function fetchDistrictDetails(
  platform: Platform,
  link: string
): Promise<{ multiple: boolean; districts: { name: string; value: string }[] }> {
  try {
    const url = pathMerge(API_URL, API_PLATFORM_ENDPOINTS[platform], DISTRICTS_ENDPOINT);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginData: { link } }),
    });
    const data = await response.json();
    if (!response.ok || data.success === false) return { multiple: false, districts: [] };
    return { multiple: !!data.multiple, districts: data.districts || [] };
  } catch {
    return { multiple: false, districts: [] };
  }
}

/**
 * Probe an arbitrary (Custom-flow) portal `link` for the sign-in methods it
 * offers. Only PowerSchool distinguishes here — its portals may front a
 * credentials form (parent login), Microsoft SSO (student login), or both. HAC /
 * Skyward always report credentials-only. Never throws — on any failure reports
 * credentials-only so the form still works.
 */
export async function fetchAuthMethods(
  platform: Platform,
  link: string
): Promise<{ credentials: boolean; microsoft: boolean; ssoUrl: string | null }> {
  try {
    const url = pathMerge(API_URL, API_PLATFORM_ENDPOINTS[platform], AUTH_METHODS_ENDPOINT);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginData: { link } }),
    });
    const data = await response.json();
    if (!response.ok || data.success === false) return { credentials: true, microsoft: false, ssoUrl: null };
    return {
      credentials: data.credentials !== false,
      microsoft: !!data.microsoft,
      ssoUrl: data.ssoUrl || null,
    };
  } catch {
    return { credentials: true, microsoft: false, ssoUrl: null };
  }
}

/**
 * The shared body of every non-streaming, authenticated data fetch: check the
 * cache, POST `{ loginType, loginData, options, session }`, run the auth-error
 * handler (redirect to /login) on failure, persist the refreshed session,
 * cache, and return. The endpoints differ only in their path and `options`.
 */
async function fetchEndpoint(
  endpoint: string,
  label: string,
  options: Record<string, any> = {}
) {
  const user = currentUser();
  if (!user) {
    throw new Error('No user logged in');
  }

  // Multi-student portals: pin every request to the chosen student.
  if (user.studentId) options = { ...options, studentId: user.studentId };

  const cacheKey = generateCacheKey(endpoint, options);
  const cachedData = getCachedValue(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const body = {
    loginType: user.loginType,
    loginData: {
      username: user.username,
      password: user.password,
      link: user.link,
      clsession: user.clsession,
      // Carried so the API can silently re-run a ClassLink login (clearing 2FA
      // with the stored answer) if the portal session has expired.
      code: user.code,
      clMFA: user.clMFA
    },
    options,
    session: getSession()
  };

  const url = pathMerge(API_URL, API_PLATFORM_ENDPOINTS[user.platform], endpoint);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok || data.success == false) {
    handleAuthError(response, data, user);
    throw new Error(data.message || `Failed to fetch ${label} with status code ${response.status}`);
  }
  if (data.session) setSession(data.session);

  setCachedValue(cacheKey, data);

  return data;
}

export function getAttendance(date?: string) {
  return fetchEndpoint(ATTENDANCE_ENDPOINT, 'attendance', { date: date || '' });
}

/** Persist a /classes payload into history, alerting on anything that changed. */
function storeClasses(data: any, term?: string) {
  const storedTerm = term || data.term;
  withGradeChangeDetection(storedTerm, data.classes, () => {
    if (term) {
      addGradesLoad(term, data.classes);
    } else {
      initializeGradesStore(data.term, data.termList, data.term, data.classes, {
        termTree: data.termTree,
        currentTerms: data.currentTerms,
        hasSubterms: data.hasSubterms,
      });
    }
  });
}

export async function* getClasses(term?: string) {
  const user = currentUser();
  const session = getSession();
  if (!user) {
    throw new Error('No user logged in');
  }

  const options: Record<string, any> = { term: term || '' };
  if (user.studentId) options.studentId = user.studentId;
  const cacheKey = generateCacheKey(CLASSES_ENDPOINT, options);

  const cachedData = getCachedValue(cacheKey);
  if (cachedData) {
    yield cachedData;
    return;
  }

  const body = {
    loginType: user.loginType,
    loginData: {
      username: user.username,
      password: user.password,
      link: user.link,
      clsession: user.clsession,
      code: user.code,
      clMFA: user.clMFA
    },
    options: options,
    session: session,
    stream: true
  }

  const endpoint = pathMerge(API_URL, API_PLATFORM_ENDPOINTS[user.platform], CLASSES_ENDPOINT);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    handleAuthError(response, { message: 'Failed to fetch classes' }, user);
    throw new Error('Failed to fetch classes with status code ' + response.status);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  if (!reader) {
    throw new Error('Response body is not readable');
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';
      for (const chunk of chunks) {
        if (chunk.trim()) {
          const data = JSON.parse(chunk);

          if (data.percent !== undefined && data.message !== undefined) {
            yield {
              percent: data.percent,
              message: data.message
            };
          }

          if (data.success === true) {
            if (data.session) setSession(data.session);
            setCachedValue(cacheKey, data);
            storeClasses(data, term);
            yield data;
            return;
          }
        }
      }
      if (done) break;
    }

    if (buffer.trim()) {
      const data = JSON.parse(buffer);
      if (data.success === true) {
        if (data.session) setSession(data.session);
        setCachedValue(cacheKey, data);
        storeClasses(data, term);
        yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Fetch one class's detailed assignments/categories for a term. Used by portals
 * whose /classes response carries averages only (scoresIncluded: false), e.g.
 * Skyward. `term` is the effective label — a subterm (PR1) when one is selected,
 * otherwise the top-level term (1ST) — which the API routes to the right bucket.
 */
export function getSingleClass(course: string, term: string) {
  return fetchEndpoint(SINGLE_CLASS_ENDPOINT, 'class', { course, term });
}

export function getSchedule() {
  return fetchEndpoint(SCHEDULE_ENDPOINT, 'schedule');
}

export function getBellSchedule() {
  return fetchEndpoint(BELL_SCHEDULE_ENDPOINT, 'bell schedule');
}

export function getTranscript() {
  return fetchEndpoint(TRANSCRIPT_ENDPOINT, 'transcript');
}

export function getReportCard() {
  return fetchEndpoint(REPORT_CARD_ENDPOINT, 'report card');
}

export function getProgressReport() {
  return fetchEndpoint(PROGRESS_REPORT_ENDPOINT, 'progress report');
}

export function getTeachers() {
  return fetchEndpoint(TEACHERS_ENDPOINT, 'teachers');
}