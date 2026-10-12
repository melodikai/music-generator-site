import { useEffect, useMemo, useRef, useState } from 'react';
import { detectStyle } from '@/lib/style-detect';
import { INITIAL_TRACKS, Track, makeTrack } from '@/lib/studio-data';
import type { SectionId } from '@/components/studio/Sidebar';
import {
  checkGeneration,
  fetchMe,
  fetchSavedTracks,
  logout,
  startGeneration,
  saveLocalTrack,
  fetchUsage,
  GUEST_USAGE,
  LimitError,
  type AuthUser,
  type Usage,
} from '@/lib/api';
import { blobToDataUrl, generateLocalTrack } from '@/lib/local-music';

export const useStudioPage = () => {
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [section, setSection] = useState<SectionId>('create');
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState('Лоу-фай');
  const [mood, setMood] = useState('Тёплое');
  const [withVocal, setWithVocal] = useState(false);
  const [voice, setVoice] = useState('any');
  const [lyrics, setLyrics] = useState('');
  const [styleText, setStyleText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(INITIAL_TRACKS[0].id);
  const [playing, setPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState({ name: 'Гость', email: '' });
  const [usage, setUsage] = useState<Usage>(GUEST_USAGE);
  const timer = useRef<number | null>(null);

  const activeTrack = useMemo(
    () => tracks.find((t) => t.id === activeId) ?? tracks[0] ?? null,
    [tracks, activeId],
  );

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    [],
  );

  useEffect(() => {
    fetchMe()
      .then((me) => {
        if (!me) return;
        setUser(me);
        setProfile({ name: me.name, email: me.email });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchUsage(profile.email).then(setUsage).catch(() => undefined);
  }, [profile.email]);

  useEffect(() => {
    if (!profile.email) return undefined;
    let cancelled = false;
    fetchSavedTracks(profile.email)
      .then((saved) => {
        if (cancelled || !saved.length) return;
        const restored: Track[] = saved.map((t, i) => ({
          id: t.id,
          title: t.title || `Трек ${i + 1}`,
          style: t.style || 'лоу-фай',
          duration: `${Math.floor((t.seconds || 47) / 60)}:${String((t.seconds || 47) % 60).padStart(2, '0')}`,
          bpm: 92,
          createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString('ru-RU') : 'Ранее',
          favorite: false,
          cover: 'linear-gradient(150deg, #f0d9c0, #b98a63)',
          prompt: t.prompt,
          audio: t.audio,
          fromPhoto: t.fromPhoto,
        }));
        setTracks((prev) => [...restored, ...prev]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile.email]);

  const handleGenerate = async () => {
    if (generating) return;
    const text = prompt.trim();
    if (!image && !lyrics.trim() && text.length < 8) {
      setError('Опишите музыку чуть подробнее — хотя бы 8 символов');
      return;
    }

    setError(null);
    setGenerating(true);
    setProgress(4);

    timer.current = window.setInterval(() => {
      setProgress((p) => (p >= 92 ? p : p + 1));
    }, 700);

    const stop = () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };

    try {
      const started = await startGeneration({
        prompt: text,
        style: styleText.trim() || style,
        mood,
        vocal: withVocal,
        voice,
        lyrics: lyrics.trim(),
        image,
        email: profile.email,
        duration: usage.maxSeconds,
      });

      if (started.usage) setUsage(started.usage);

      const usedStyle = started.style || detectStyle(text) || style;

      let audio: string | null = started.audio || null;
      let audios: string[] = audio ? [audio] : [];
      const localMode =
        started.engine !== 'vocal' &&
        (started.status === 'local' || started.engine === 'browser');

      const seconds = Math.min(started.seconds || usage.maxSeconds, usage.maxSeconds);

      if (!audio && localMode) {
        setProgress(55);
        const blob = await generateLocalTrack({
          prompt: started.prompt || text,
          style: usedStyle,
          mood,
          vocal: withVocal,
          seconds,
        });
        setProgress(80);
        const dataUrl = await blobToDataUrl(blob);
        const stored = profile.email
          ? await saveLocalTrack({
              audio: dataUrl,
              email: profile.email,
              title: text.slice(0, 40),
              prompt: text,
              style: usedStyle,
              mood,
              imageUrl: started.imageUrl,
              seconds,
            }).catch(() => null)
          : null;
        audio = stored || URL.createObjectURL(blob);
        audios = [audio];
      }

      const attempts = started.engine === 'vocal' ? 160 : 90;
      for (let i = 0; !audio && !localMode && i < attempts; i += 1) {
        await new Promise((r) => window.setTimeout(r, 3000));
        const state = await checkGeneration(started.id, {
          email: profile.email,
          title: started.prompt?.slice(0, 40) || text.slice(0, 40),
          prompt: started.prompt || text,
          style: usedStyle,
          mood,
          seconds: String(seconds),
          ...(started.imageUrl ? { imageUrl: started.imageUrl } : {}),
        });
        if (state.status === 'succeeded') {
          audio = state.audio;
          audios = state.audios?.length ? state.audios : state.audio ? [state.audio] : [];
          break;
        }
        if (state.status === 'failed' || state.status === 'canceled') {
          throw new Error(
            state.error ||
              'Движок не справился с этим запросом — попробуйте запустить ещё раз',
          );
        }
      }

      stop();
      if (!audio) throw new Error('Генерация заняла слишком много времени, попробуйте ещё раз');

      setProgress(100);
      const fresh = (audios.length ? audios : [audio]).map((url, n) =>
        makeTrack(started.prompt || text, usedStyle, tracks.length + n, {
          audio: url,
          seconds,
          fromPhoto: Boolean(image),
        }),
      );
      setTracks((prev) => [...fresh, ...prev]);
      setActiveId(fresh[0].id);
      setPlaying(true);
      setPrompt('');
      setImage(null);
      setSection('create');
      fetchUsage(profile.email).then(setUsage).catch(() => undefined);
    } catch (e) {
      stop();
      if (e instanceof LimitError) {
        if (e.usage) setUsage(e.usage);
        setError(e.message);
        if (e.code === 'need_auth') setAuthOpen(true);
      } else {
        setError(e instanceof Error ? e.message : 'Не удалось создать трек');
      }
    } finally {
      stop();
      setGenerating(false);
    }
  };

  const handlePlay = (track: Track) => {
    if (track.id === activeId) {
      setPlaying((p) => !p);
      return;
    }
    setActiveId(track.id);
    setPlaying(true);
  };

  const handleFavorite = (id: string) =>
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)));

  const handleSection = (id: SectionId) => {
    setMenuOpen(false);
    if (id === 'account') {
      if (user) setAccountOpen(true);
      else setAuthOpen(true);
      return;
    }
    setSection(id);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setProfile({ name: 'Гость', email: '' });
    setUsage(GUEST_USAGE);
    setAccountOpen(false);
  };

  return {
    tracks,
    section,
    setSection,
    prompt,
    setPrompt,
    image,
    setImage,
    style,
    setStyle,
    mood,
    setMood,
    withVocal,
    setWithVocal,
    voice,
    setVoice,
    lyrics,
    setLyrics,
    styleText,
    setStyleText,
    generating,
    progress,
    error,
    setError,
    playing,
    setPlaying,
    menuOpen,
    setMenuOpen,
    accountOpen,
    setAccountOpen,
    authOpen,
    setAuthOpen,
    user,
    setUser,
    profile,
    setProfile,
    usage,
    setUsage,
    activeTrack,
    handleGenerate,
    handlePlay,
    handleFavorite,
    handleSection,
    handleLogout,
  };
};

export type StudioPageState = ReturnType<typeof useStudioPage>;
