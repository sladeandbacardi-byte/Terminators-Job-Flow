export type MobileSession = {
  workerId: string;
  token: string;
  worker: { id: string; role?: string | null; [key: string]: unknown };
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const mobileKeys = ["mobile_worker_id", "mobile_session_token", "mobile_worker_data", "mobile_user_role", "mobile_user_type"];
const officeKeys = ["auth_token", "auth_user", "auth_user_role", "auth_user_type", "demo_mode", "selected_login_mode"];
const allIdentityKeys = [...mobileKeys, ...officeKeys];
let redirectingToLogin = false;

function browserStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function clearAllAuth(storage: StorageLike | null = browserStorage()) {
  if (!storage) return;
  // Keep the namespace reset in one operation so callers cannot accidentally
  // retain an identity from the other login mode.
  allIdentityKeys.forEach(key => storage.removeItem(key));
}

export function storeMobileSession(session: MobileSession, storage: StorageLike | null = browserStorage()) {
  if (!storage || !isSessionValue(session)) throw new Error("Cannot store an incomplete mobile session.");
  clearAllAuth(storage);
  storage.setItem("mobile_worker_id", session.workerId);
  storage.setItem("mobile_session_token", session.token);
  storage.setItem("mobile_worker_data", JSON.stringify(session.worker));
  storage.setItem("mobile_user_role", session.worker.role || "Technician");
  storage.setItem("mobile_user_type", "staff");
}

function isSessionValue(value: unknown): value is MobileSession {
  if (!value || typeof value !== "object") return false;
  const session = value as MobileSession;
  return typeof session.workerId === "string" && session.workerId.length > 0
    && typeof session.token === "string" && session.token.length > 0
    && !!session.worker && typeof session.worker === "object"
    && typeof session.worker.id === "string" && session.worker.id === session.workerId;
}

export function readMobileSession(storage: StorageLike | null = browserStorage()): MobileSession | null {
  if (!storage) return null;
  const values = allIdentityKeys.map(key => [key, storage.getItem(key)] as const);
  const hasOfficeState = values.some(([key, value]) => officeKeys.includes(key) && value !== null);
  const workerId = storage.getItem("mobile_worker_id");
  const token = storage.getItem("mobile_session_token");
  const workerData = storage.getItem("mobile_worker_data");
  const role = storage.getItem("mobile_user_role");
  const userType = storage.getItem("mobile_user_type");
  const hasAnyMobileState = mobileKeys.some(key => storage.getItem(key) !== null);
  if (hasOfficeState || !workerId || !token || !workerData || !role || userType !== "staff") {
    if (hasOfficeState || hasAnyMobileState) clearAllAuth(storage);
    return null;
  }
  try {
    const session = { workerId, token, worker: JSON.parse(workerData) };
    if (!isSessionValue(session)) throw new Error("Invalid mobile session");
    return session;
  } catch {
    clearAllAuth(storage);
    return null;
  }
}

export function redirectToLoginSelector() {
  if (redirectingToLogin || typeof window === "undefined") return;
  redirectingToLogin = true;
  window.location.replace("/");
}

export function expireMobileSession(storage: StorageLike | null = browserStorage()) {
  clearAllAuth(storage);
  redirectToLoginSelector();
}

export async function mobileFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const session = readMobileSession();
  if (!session) {
    expireMobileSession();
    throw new Error("Your mobile session is missing or invalid. Please sign in again.");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    expireMobileSession();
  }
  return response;
}

export async function validateMobileSession(session: MobileSession): Promise<boolean> {
  const response = await mobileFetch("/api/auth/mobile-session");
  if (!response.ok) {
    expireMobileSession();
    return false;
  }
  try {
    const payload = await response.json();
    const workerId = payload?.worker?.id ?? payload?.workerId;
    if (typeof workerId !== "string" || workerId !== session.workerId) {
      expireMobileSession();
      return false;
    }
    return true;
  } catch {
    expireMobileSession();
    return false;
  }
}