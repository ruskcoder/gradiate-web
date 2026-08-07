export const APP_NAME = 'Gradiate';
export const PLATFORMS = ['hac', 'skyward-legacy', 'powerschool'] as const;
export const PLATFORM_MAPPING: Record<string, string> = {
    hac: 'HAC',
    'skyward-legacy': 'Skyward Legacy',
    powerschool: 'PowerSchool'
};
export const DISTRICTS_URL = '/districts.json';
// Microsoft SSO is mobile-only (it needs a WebView cookie handoff a browser SPA
// can't do), so the web app offers credentials + ClassLink only.
export const LOGIN_TYPES = ['credentials', 'classlink', 'classlinkCredentials'] as const;

/** Optional per-method sign-in titles a district can declare (e.g. PowerSchool
 *  parent-vs-student). Keyed by method name. */
export interface LoginTitles {
  credentials?: string;
  classlink?: string;
  microsoft?: string;
}

/** The sign-in methods a district's portal offers. */
export interface LoginMethods {
  credentials: boolean;
  classlink: boolean;
  microsoft: boolean;
  // The ClassLink district code when the loginType declares it inline
  // ("classlink:katyisd"); '' when it must be derived from the link instead.
  classlinkCode: string;
}

/**
 * Parse a district's `loginType` into the set of methods it offers. districts.json
 * encodes multiple methods slash-separated ("credentials/classlink",
 * "credentials/microsoft"); a bare "credentials" means credentials-only. Because
 * the list declares this, a listed district never needs the `/authMethods` probe —
 * only the Custom flow (an arbitrary link) does. Microsoft is disabled on the web
 * (mobile-only), so it's parsed and surfaced only as a disabled hint button here.
 *
 * A `classlink` token may carry the district code inline as "classlink:<code>"
 * (e.g. "credentials/classlink:katyisd"); the code is pulled out so the ClassLink
 * field can prefill with it instead of guessing from the portal link.
 */
export function parseLoginMethods(loginType: string): LoginMethods {
  let classlinkCode = '';
  const names = String(loginType || 'credentials')
    .split('/')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((tok) => {
      const idx = tok.indexOf(':');
      const name = (idx === -1 ? tok : tok.slice(0, idx)).trim().toLowerCase();
      if (name === 'classlink' && idx !== -1) classlinkCode = tok.slice(idx + 1).trim();
      return name;
    });
  return {
    credentials: names.length === 0 || names.includes('credentials'),
    classlink: names.includes('classlink'),
    microsoft: names.includes('microsoft'),
    classlinkCode,
  };
}

// The ClassLink launchpad prefix shown before the editable part of the link
// field. Users only type their district code (e.g. `katyisd`); the full link is
// `CLASSLINK_LAUNCHPAD_BASE + code`.
export const CLASSLINK_LAUNCHPAD_BASE = 'launchpad.classlink.com/';

/** Pull the district `code` out of a ClassLink launchpad link. */
export function classlinkCodeFromLink(link: string): string {
  if (!link) return '';
  const cleaned = link
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^launchpad\.classlink\.com\//i, '')
    .replace(/^\/+/, '');
  return cleaned.split(/[/?#]/)[0]!.trim();
}
export const API_URL = import.meta.env.VITE_API_URL;
export const API_PLATFORM_ENDPOINTS: Record<typeof PLATFORMS[number], string> = {
    hac: '/hac/',
    'skyward-legacy': '/skyward-legacy/',
    powerschool: '/powerschool/'
};
export const LOGIN_ENDPOINT = '/info';
export const DISTRICTS_ENDPOINT = '/districts';
export const AUTH_METHODS_ENDPOINT = '/authMethods';
export const CLASSES_ENDPOINT = '/classes';
export const SINGLE_CLASS_ENDPOINT = '/single-class';
export const ATTENDANCE_ENDPOINT = '/attendance';
export const SCHEDULE_ENDPOINT = '/schedule';
export const BELL_SCHEDULE_ENDPOINT = '/bellSchedule';
export const TRANSCRIPT_ENDPOINT = '/transcript';
export const REPORT_CARD_ENDPOINT = '/reportCard';
export const PROGRESS_REPORT_ENDPOINT = '/ipr';
export const TEACHERS_ENDPOINT = '/teachers';
