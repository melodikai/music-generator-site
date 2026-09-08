import func2url from '../../backend/func2url.json';

const MUSIC_URL = (func2url as Record<string, string>).music;
const STEMS_URL = (func2url as Record<string, string>).stems;

export type StartResult = {
  id: string;
  status: string;
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

export type Stem = { id: string; name: string; url: string };

export type StemsStatus = {
  id: string;
  status: string;
  stems: Stem[];
  error?: string | null;
};

export const startStems = async (payload: {
  audioUrl?: string;
  audio?: string | null;
  stem?: string;
}): Promise<{ id: string; status: string; source: string }> => {
  const res = await fetch(STEMS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Не удалось запустить разделение');
  return data;
};

export const checkStems = async (id: string): Promise<StemsStatus> => {
  const res = await fetch(`${STEMS_URL}?id=${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка проверки статуса');
  return data;
};