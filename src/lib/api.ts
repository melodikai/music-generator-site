import func2url from '../../backend/func2url.json';

const MUSIC_URL = (func2url as Record<string, string>).music;
const AUTH_URL = (func2url as Record<string, string>).auth;

export type StartResult = {
  id: string;
  status: string;
  audio?: string | null;
  engine?: 'huggingface' | 'replicate' | 'browser' | 'vocal';
  caption?: string;
  prompt?: string;
  imageUrl?: string | null;
};

export type StatusResult = {
  id: string;
  status: string;
  audio: string | null;
  error?: string | null;
};

export const startGeneration = async (payload: {
  prompt: string;
  style?: string;
  mood?: string;
  vocal?: boolean;
  voice?: string;
  lyrics?: string;
  image?: string | null;
  duration?: number;
}): Promise<StartResult> => {
  const res = await fetch(MUSIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Не удалось запустить генерацию');
  return data;
};

export const checkGeneration = async (
  id: string,
  meta: Record<string, string> = {},
): Promise<StatusResult> => {
  const query = new URLSearchParams({ id, ...meta }).toString();
  const res = await fetch(`${MUSIC_URL}?${query}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка проверки статуса');
  return data;
};

export const saveLocalTrack = async (payload: {
  audio: string;
  email?: string;
  title?: string;
  prompt?: string;
  style?: string;
  mood?: string;
  imageUrl?: string | null;
  seconds?: number;
}): Promise<string | null> => {
  const res = await fetch(MUSIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'saveLocal', ...payload }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.audio || null;
};

export type SavedTrack = {
  id: string;
  title: string;
  prompt: string;
  style: string;
  mood: string;
  audio: string | null;
  image: string | null;
  fromPhoto: boolean;
  seconds: number;
  createdAt: string | null;
};

export const fetchSavedTracks = async (email = ''): Promise<SavedTrack[]> => {
  const res = await fetch(`${MUSIC_URL}?list=tracks&email=${encodeURIComponent(email)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.tracks || [];
};

export const saveProfile = async (email: string, name: string, plan = 'free') => {
  const res = await fetch(MUSIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'profile', email, name, plan }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user as { email: string; name: string; plan: string; used: number };
};

export type AuthUser = {
  email: string;
  name: string;
  plan: string;
  used: number;
  isAdmin?: boolean;
};

export const grantAdmin = async (email: string, key: string) => {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'grantAdmin', email, key }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Не удалось выдать права');
  return data;
};

const TOKEN_KEY = 'zvuchi_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const authRequest = async (payload: Record<string, unknown>) => {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': getToken() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Не удалось выполнить запрос');
  return data;
};

export const register = async (email: string, password: string, name: string) => {
  const data = await authRequest({ action: 'register', email, password, name });
  setToken(data.token);
  return data.user as AuthUser;
};

export const login = async (email: string, password: string) => {
  const data = await authRequest({ action: 'login', email, password });
  setToken(data.token);
  return data.user as AuthUser;
};

export const logout = async () => {
  await authRequest({ action: 'logout' }).catch(() => undefined);
  clearToken();
};

export const fetchMe = async (): Promise<AuthUser | null> => {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(AUTH_URL, { headers: { 'X-Auth-Token': token } });
  if (!res.ok) {
    clearToken();
    return null;
  }
  const data = await res.json();
  return data.user as AuthUser;
};

export type ShowcaseTrack = {
  id: string;
  title: string;
  style: string;
  mood: string;
  audio: string | null;
  image: string | null;
  seconds: number;
  plays: number;
  likes: number;
  author: string;
};

export const fetchShowcase = async (): Promise<ShowcaseTrack[]> => {
  const res = await fetch(`${MUSIC_URL}?list=showcase`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.tracks || [];
};

export const publishTrack = (trackId: string, email: string, isPublic: boolean) =>
  fetch(MUSIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'publish', trackId, email, public: isPublic }),
  });

export const likeTrack = (trackId: string) =>
  fetch(MUSIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'like', trackId }),
  });

export type Stem = { id: string; name: string; url: string };

export type StemsStatus = {
  id: string;
  status: string;
  stems: Stem[];
  error?: string | null;
};

