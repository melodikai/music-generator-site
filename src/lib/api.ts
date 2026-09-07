import func2url from '../../backend/func2url.json';

const MUSIC_URL = (func2url as Record<string, string>).music;

export type StartResult = {
  id: string;
  status: string;
  caption?: string;
  prompt?: string;
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

export const checkGeneration = async (id: string): Promise<StatusResult> => {
  const res = await fetch(`${MUSIC_URL}?id=${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка проверки статуса');
  return data;
};
