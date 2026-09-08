import func2url from '../../backend/func2url.json';

const MUSIC_URL = (func2url as Record<string, string>).music;
const AUTH_URL = (func2url as Record<string, string>).auth;

export type Usage = {
  plan: 'guest' | 'free' | 'standard' | 'premium';
  planTitle: string;
  vocalLimit: number;
  vocalUsed: number;
  vocalLeft: number;
  freeLimit: number;
  freeUsed: number;
  freeLeft: number;
  maxSeconds: number;
  canDownload: boolean;
  canPublish: boolean;
  canStudio: boolean;
};

export const GUEST_USAGE: Usage = {
  plan: 'guest',
  planTitle: 'Без регистрации',
  vocalLimit: 0,
  vocalUsed: 0,
  vocalLeft: 0,
  freeLimit: 3,
  freeUsed: 0,
  freeLeft: 3,
  maxSeconds: 60,
  canDownload: false,
  canPublish: false,
  canStudio: false,
};

export const deviceId = (): string => {
  const key = 'zvuchi-device';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `d${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(key, id);
  }
  return id;
};

export class LimitError extends Error {
  code: string;
  usage?: Usage;

  constructor(message: string, code: string, usage?: Usage) {
    super(message);
    this.code = code;
    this.usage = usage;
  }
}

export const fetchUsage = async (email = ''): Promise<Usage> => {
  const query = new URLSearchParams({ list: 'usage', email, deviceId: deviceId() });
  try {
    const res = await fetch(`${MUSIC_URL}?${query}`);
    if (!res.ok) return GUEST_USAGE;
    return await res.json();
  } catch {
    return GUEST_USAGE;
  }
};

export type StartResult = {
  id: string;
  status: string;
  audio?: string | null;
  engine?: 'huggingface' | 'replicate' | 'browser' | 'vocal';
  caption?: string;
  prompt?: string;
  seconds?: number;
  imageUrl?: string | null;
  usage?: Usage;
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
  email?: string;
}): Promise<StartResult> => {
  const body = JSON.stringify({ ...payload, deviceId: deviceId() });

  if (body.length > 1_800_000) {
    throw new Error('Фото слишком большое — выберите файл поменьше');
  }

  let res: Response;
  try {
    res = await fetch(MUSIC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch {
    throw new Error('Нет связи с сервером — проверьте интернет и попробуйте ещё раз');
  }

  if (res.status === 413) {
    throw new Error('Фото слишком большое — выберите файл поменьше');
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 403 && data.code) {
    throw new LimitError(data.error || 'Лимит исчерпан', data.code, data.usage);
  }

  if (!res.ok) throw new Error(data.error || 'Не удалось запустить генерацию');
  return data;
};

export const checkGeneration = async (
  id: string,
  meta: Record<string, string> = {},
): Promise<StatusResult> => {
  const query = new URLSearchParams({ id, ...meta }).toString();
  try {
    const res = await fetch(`${MUSIC_URL}?${query}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка проверки статуса');
    return data;
  } catch {
    return { id, status: 'processing', audio: null };
  }
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
  if (payload.audio.length > 1_600_000) return null;
  try {
    const res = await fetch(MUSIC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveLocal', ...payload }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.audio || null;
  } catch {
    return null;
  }
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