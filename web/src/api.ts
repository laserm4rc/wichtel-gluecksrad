export type Phase = 'setup' | 'open';

export interface EventInfo {
  title: string;
  budget: string;
  date: string;
  location: string;
}

export interface SessionUser {
  name: string;
  wheel: string[];
  /** Hat die Person schon einmal gedreht? Das Ergebnis selbst gibt es nur über spin(). */
  spun: boolean;
}

/** Anmeldestart: vorher ist das Anmeldeformular gesperrt. */
export interface LoginInfo {
  open: boolean;
  /** ISO-Zeitstempel oder null = sofort */
  opensAt: string | null;
  /** Zeitzone für die Anzeige, z. B. "Europe/Berlin" */
  timeZone: string;
}

export interface Session {
  event: EventInfo;
  phase: Phase;
  login: LoginInfo;
  user: SessionUser | null;
}

export interface AdminParticipant {
  id: number;
  name: string;
  password: string;
  /** Erste/letzte Anmeldung mit dem aktuellen Passwort (UTC, "YYYY-MM-DD HH:MM:SS") */
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  loginCount: number;
  spunAt: string | null;
}

export interface AdminAssignment {
  giverId: number;
  giver: string;
  /** Fehlt, wenn die Zuteilung für diese Rolle verdeckt oder ausgeblendet ist */
  receiverId?: number;
  receiver?: string;
  spunAt: string | null;
}

export type AdminRole = 'main' | 'co';
/** visible = Hauptadmin, covered = Co-Admin muss aufdecken, hidden = Co-Admin sieht nichts */
export type AssignmentsVisibility = 'visible' | 'covered' | 'hidden';
export type CoAdminVisibility = Exclude<AssignmentsVisibility, 'visible'>;

export interface AdminState {
  role: AdminRole;
  assignmentsVisibility: AssignmentsVisibility;
  event: EventInfo;
  baseUrl: string;
  phase: Phase;
  /** Wechselt bei jeder neuen Auslosung */
  drawId: string | null;
  login: LoginInfo;
  participants: AdminParticipant[];
  exclusions: { a: number; b: number }[];
  assignments: AdminAssignment[];
  /** Nur für den Hauptadmin */
  coAdmin?: { enabled: boolean; visibility: CoAdminVisibility };
  /** Nur direkt nach dem Anlegen/Erneuern des Co-Admin-Passworts */
  newCoAdminPassword?: string;
}

export interface RevealResult {
  drawId: string | null;
  assignments: { giverId: number; receiverId: number; receiver: string }[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Teilnehmer-Schlüssel nur im Arbeitsspeicher: Nach jedem Neuladen der Seite
 * ist er weg und man muss sich neu anmelden. Das ist so gewollt.
 */
let token: string | null = null;

/**
 * Admin-Schlüssel dagegen im Browser gespeichert, damit ein Reload nicht abmeldet.
 * Der Server liefert bei jeder Anfrage einen frischen Schlüssel; nach 30 Minuten ohne Aktivität läuft er ab.
 */
const ADMIN_TOKEN_KEY = 'wichtel-admin-token';
let adminToken: string | null = readStoredAdminToken();

function readStoredAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setAdminToken(value: string | null) {
  adminToken = value;
  try {
    if (value) localStorage.setItem(ADMIN_TOKEN_KEY, value);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Ohne Speicher gilt die Anmeldung eben nur bis zum Reload
  }
}

async function send(method: Method, path: string, auth: string | null, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body) headers['content-type'] = 'application/json';
  if (auth) headers.authorization = `Bearer ${auth}`;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Keine Verbindung zum Server.', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error ?? 'Unbekannter Fehler.', res.status);
  }
  return res;
}

async function request<T>(method: Method, path: string, body?: unknown, auth: string | null = token): Promise<T> {
  const res = await send(method, path, auth, body);
  return (await res.json()) as T;
}

export const api = {
  session: () => request<Session>('GET', '/api/session'),
  login: async (password: string) => {
    const data = await request<{ token: string }>('POST', '/api/login', { password });
    token = data.token;
  },
  logout: () => {
    token = null;
  },
  spin: () => request<{ receiver: string }>('POST', '/api/spin'),
};

/** Admin-Anfrage: übernimmt den frischen Schlüssel aus der Antwort, meldet bei 401 ab. */
async function adminSend(method: Method, path: string, body?: unknown): Promise<Response> {
  try {
    const res = await send(method, `/api/admin${path}`, adminToken, body);
    const fresh = res.headers.get('x-admin-token');
    if (fresh) setAdminToken(fresh);
    return res;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) setAdminToken(null);
    throw err;
  }
}

const admin = async <T = AdminState>(method: Method, path: string, body?: unknown) =>
  (await (await adminSend(method, path, body)).json()) as T;

export const adminApi = {
  isLoggedIn: () => adminToken !== null,
  login: async (password: string) => {
    const data = await request<{ token: string; role: AdminRole }>('POST', '/api/admin/login', { password }, null);
    setAdminToken(data.token);
  },
  logout: () => setAdminToken(null),
  state: () => admin('GET', '/state'),
  addParticipant: (name: string, password?: string) => admin('POST', '/participants', { name, password }),
  removeParticipant: (id: number) => admin('DELETE', `/participants/${id}`),
  resetPassword: (id: number, password?: string) => admin('POST', `/participants/${id}/password`, { password }),
  addExclusion: (a: number, b: number) => admin('POST', '/exclusions', { a, b }),
  removeExclusion: (a: number, b: number) => admin('DELETE', `/exclusions/${a}/${b}`),
  startDraw: () => admin('POST', '/draw/start'),
  redraw: () => admin('POST', '/draw/redraw'),
  resetDraw: () => admin('POST', '/draw/reset'),
  /** Verdeckte Namen aufdecken: einen (giverId) oder alle */
  reveal: (giverId?: number) => admin<RevealResult>('POST', '/reveal', giverId === undefined ? {} : { giverId }),
  saveEvent: (event: EventInfo) => admin('PUT', '/event', event),
  /** Anmeldestart setzen (Ortszeit "YYYY-MM-DDTHH:mm" in der Event-Zeitzone) oder mit null entfernen */
  setLoginOpensAt: (local: string | null) => admin('PUT', '/login-opens', local ? { local } : { opensAt: null }),
  setCoAdminPassword: (password?: string) => admin('POST', '/coadmin/password', { password }),
  setCoAdminVisibility: (visibility: CoAdminVisibility) => admin('PUT', '/coadmin/visibility', { visibility }),
  removeCoAdmin: () => admin('DELETE', '/coadmin'),
  /** Lädt die CSV mit dem Admin-Schlüssel und bietet sie zum Speichern an. */
  downloadCsv: async () => {
    const res = await adminSend('GET', '/export.csv');
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wichtel-zuteilung.csv';
    link.click();
    URL.revokeObjectURL(url);
  },
};
