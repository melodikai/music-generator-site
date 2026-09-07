export type Track = {
  id: string;
  title: string;
  style: string;
  duration: string;
  bpm: number;
  createdAt: string;
  favorite: boolean;
  cover: string;
  prompt: string;
  audio?: string | null;
  fromPhoto?: boolean;
};

export const COVERS = [
  'linear-gradient(145deg, #d08a3c, #2a2521)',
  'linear-gradient(145deg, #7c93b8, #1c1a18)',
  'linear-gradient(145deg, #b8734f, #241f1b)',
  'linear-gradient(145deg, #8fa37c, #1f1d1a)',
  'linear-gradient(145deg, #c2a15c, #26211d)',
  'linear-gradient(145deg, #9c6f8f, #201c1a)',
];

export const STYLES = [
  'Лоу-фай',
  'Кинематографика',
  'Электроника',
  'Акустика',
  'Хип-хоп',
  'Джаз',
  'Эмбиент',
  'Поп',
];

export const MOODS = ['Спокойное', 'Тёплое', 'Драйвовое', 'Мечтательное', 'Тревожное'];

export const PROMPT_IDEAS = [
  'Тёплый лоу-фай для влога о городе, мягкий бит',
  'Кинематографичный подъём со струнными для финала ролика',
  'Лёгкая электроника для сторис небольшого кафе',
  'Спокойная заставка подкаста с мягким пианино, 30 секунд',
  'Драйвовый хип-хоп бит с живыми барабанами',
];

export const TYPING_PLACEHOLDER = 'Тёплый лоу-фай для влога о городе, мягкий бит';

export const INITIAL_TRACKS: Track[] = [
  {
    id: 't1',
    title: 'Вечерний трамвай',
    style: 'лоу-фай',
    duration: '2:48',
    bpm: 92,
    createdAt: 'Сегодня, 14:02',
    favorite: true,
    cover: COVERS[0],
    prompt: 'Тёплый лоу-фай для влога о городе, мягкий бит',
  },
  {
    id: 't2',
    title: 'Мягкое утро',
    style: 'заставка подкаста',
    duration: '0:32',
    bpm: 78,
    createdAt: 'Сегодня, 12:41',
    favorite: false,
    cover: COVERS[1],
    prompt: 'Спокойная заставка подкаста с мягким пианино',
  },
  {
    id: 't3',
    title: 'Северный ветер',
    style: 'кинематографика',
    duration: '2:05',
    bpm: 84,
    createdAt: 'Сегодня, 11:15',
    favorite: true,
    cover: COVERS[2],
    prompt: 'Кинематографичный подъём со струнными',
  },
  {
    id: 't4',
    title: 'Витрина',
    style: 'реклама',
    duration: '0:45',
    bpm: 120,
    createdAt: 'Вчера, 19:30',
    favorite: false,
    cover: COVERS[3],
    prompt: 'Лёгкая электроника для рекламы кафе',
  },
  {
    id: 't5',
    title: 'Пыль на пластинке',
    style: 'джаз',
    duration: '3:12',
    bpm: 96,
    createdAt: 'Вчера, 16:08',
    favorite: false,
    cover: COVERS[4],
    prompt: 'Тёплый джаз с контрабасом и щётками',
  },
  {
    id: 't6',
    title: 'Дальний свет',
    style: 'эмбиент',
    duration: '4:20',
    bpm: 70,
    createdAt: '5 сентября',
    favorite: true,
    cover: COVERS[5],
    prompt: 'Медленный эмбиент для медитации',
  },
];

const TITLE_PARTS_A = [
  'Тихий',
  'Дальний',
  'Тёплый',
  'Ночной',
  'Первый',
  'Бумажный',
  'Северный',
  'Медленный',
];

const TITLE_PARTS_B = [
  'горизонт',
  'проспект',
  'дождь',
  'вокзал',
  'снимок',
  'сентябрь',
  'маршрут',
  'вечер',
];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export const makeTrack = (
  prompt: string,
  style: string,
  index: number,
  extra?: { audio?: string | null; seconds?: number; fromPhoto?: boolean },
): Track => {
  const seconds = extra?.seconds ?? 30 + Math.floor(Math.random() * 180);
  return {
    id: `gen-${Date.now()}-${index}`,
    title: `${pick(TITLE_PARTS_A)} ${pick(TITLE_PARTS_B)}`,
    style: style.toLowerCase(),
    duration: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
    bpm: 68 + Math.floor(Math.random() * 60),
    createdAt: 'Только что',
    favorite: false,
    cover: COVERS[Math.floor(Math.random() * COVERS.length)],
    prompt,
    audio: extra?.audio ?? null,
    fromPhoto: extra?.fromPhoto,
  };
};

export const WAVE_HEIGHTS = [
  38, 66, 96, 52, 80, 34, 70, 100, 46, 62, 88, 40, 72, 54, 92, 36, 64, 48, 84, 30, 58, 76, 42, 68,
  50, 88, 32, 60, 44, 78,
];