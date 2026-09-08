import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import SiteFooter from '@/components/studio/SiteFooter';
import { fetchShowcase, likeTrack, type ShowcaseTrack } from '@/lib/api';
import { cn } from '@/lib/utils';

const COVERS = [
  'linear-gradient(150deg, #f0d9c0, #b98a63)',
  'linear-gradient(150deg, #c8d6e5, #6b7f96)',
  'linear-gradient(150deg, #e8c9c9, #a86b6b)',
  'linear-gradient(150deg, #d6e0c8, #7f966b)',
];

const format = (sec: number) =>
  `${Math.floor((sec || 0) / 60)}:${String((sec || 0) % 60).padStart(2, '0')}`;

const Showcase = () => {
  const [tracks, setTracks] = useState<ShowcaseTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [liked, setLiked] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchShowcase()
      .then(setTracks)
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggle = (track: ShowcaseTrack) => {
    if (!track.audio) return;
    if (playing === track.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(track.audio);
    audio.onended = () => setPlaying(null);
    audio.play().catch(() => undefined);
    audioRef.current = audio;
    setPlaying(track.id);
  };

  const like = (track: ShowcaseTrack) => {
    if (liked.includes(track.id)) return;
    setLiked((prev) => [...prev, track.id]);
    setTracks((prev) =>
      prev.map((t) => (t.id === track.id ? { ...t, likes: t.likes + 1 } : t)),
    );
    likeTrack(track.id).catch(() => undefined);
  };

  const empty = useMemo(() => !loading && tracks.length === 0, [loading, tracks]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background p-2.5">
      <div className="mx-auto max-w-5xl rounded-[14px] bg-stage px-4 py-6 lg:px-8 lg:py-10">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-[0.9em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="ArrowLeft" size={16} />
            В студию
          </Link>
          <span className="text-[0.8em] uppercase tracking-[0.14em] text-muted-foreground">
            Витрина
          </span>
        </div>

        <h1 className="mt-8 font-display text-4xl font-light tracking-[-0.02em] text-foreground lg:text-5xl">
          Лучшие треки пользователей
        </h1>
        <p className="mt-3 max-w-xl text-[0.95em] leading-relaxed text-muted-foreground">
          Послушайте, что создают в Звучи по одному текстовому описанию или по фотографии.
          Регистрация не нужна — просто нажмите play.
        </p>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[0.92em] text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          <Icon name="AudioLines" size={16} />
          Создать свой трек
        </Link>

        {loading && (
          <p className="mt-10 text-[0.9em] text-muted-foreground">Загружаем подборку…</p>
        )}

        {empty && (
          <div className="mt-10 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
            <p className="text-[0.95em] text-foreground">Витрина скоро наполнится</p>
            <p className="mt-2 text-[0.88em] leading-relaxed text-muted-foreground">
              Здесь появятся треки, которые авторы отметили как публичные. Создайте свой и
              поделитесь им первым.
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {tracks.map((track, i) => (
            <article
              key={track.id}
              className="flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.06]"
            >
              <span
                className="h-14 w-14 flex-none rounded-xl bg-cover bg-center"
                style={
                  track.image
                    ? { backgroundImage: `url(${track.image})` }
                    : { background: COVERS[i % COVERS.length] }
                }
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.95em] text-foreground">
                  {track.title || 'Без названия'}
                </p>
                <p className="truncate text-[0.8em] text-muted-foreground">
                  {track.author} · {track.style || 'эксперимент'} · {format(track.seconds)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => like(track)}
                className={cn(
                  'flex flex-none items-center gap-1 rounded-full px-2 py-1 text-[0.8em] transition-colors',
                  liked.includes(track.id)
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon name="Heart" size={14} />
                {track.likes}
              </button>
              <button
                type="button"
                onClick={() => toggle(track)}
                aria-label="Слушать"
                className="grid h-10 w-10 flex-none place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
              >
                <Icon name={playing === track.id ? 'Pause' : 'Play'} size={16} />
              </button>
            </article>
          ))}
        </div>

        <SiteFooter />
      </div>
    </div>
  );
};

export default Showcase;
