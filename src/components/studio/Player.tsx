import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Track, WAVE_HEIGHTS } from '@/lib/studio-data';

type Props = {
  track: Track | null;
  playing: boolean;
  onToggle: () => void;
  onFavorite: (id: string) => void;
};

const toSeconds = (value: string) => {
  const [m, s] = value.split(':').map(Number);
  return m * 60 + s;
};

const fromSeconds = (value: number) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

const Player = ({ track, playing, onToggle, onFavorite }: Props) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [position, setPosition] = useState(0);
  const [realDuration, setRealDuration] = useState(0);
  const hasAudio = Boolean(track?.audio);
  const total = realDuration || (track ? toSeconds(track.duration) : 0);

  useEffect(() => {
    setPosition(0);
    setRealDuration(0);
  }, [track?.id]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.play().catch(() => undefined);
    else el.pause();
  }, [playing, track?.id]);

  useEffect(() => {
    if (!playing || !track || hasAudio) return;
    const timer = window.setInterval(() => {
      setPosition((p) => (p + 1 >= total ? 0 : p + 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, track, total, hasAudio]);

  if (!track) return null;

  const ratio = total ? position / total : 0;

  const seek = (value: number) => {
    setPosition(value);
    if (audioRef.current) audioRef.current.currentTime = value;
  };

  const download = () => {
    if (!track.audio) return;
    const a = document.createElement('a');
    a.href = track.audio;
    a.download = `${track.title}.wav`;
    a.click();
  };

  return (
    <section className="px-4 pt-7 sm:px-8 md:px-10">
      <div
        className="animate-rise flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-card-foreground shadow-[0_18px_44px_rgba(0,0,0,0.42)] sm:gap-4"
        style={{ animationDelay: '0.27s' }}
      >
        <span
          className="h-[42px] w-[42px] flex-none rounded-[10px]"
          style={{ background: track.cover }}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? 'Пауза' : 'Воспроизвести'}
          className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-card-foreground text-card transition-transform hover:scale-110"
        >
          <Icon name={playing ? 'Pause' : 'Play'} size={12} />
        </button>
        <span className="min-w-0 max-w-[40%] flex-none">
          <span className="block truncate text-[0.95em] font-medium tracking-[-0.01em]">
            {track.title}
          </span>
          <span className="mt-0.5 block truncate text-[0.82em] text-card-muted">
            {track.style} · {track.bpm} BPM
          </span>
        </span>

        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seek(Math.round(((e.clientX - rect.left) / rect.width) * total));
          }}
          aria-label="Перемотать"
          className="hidden h-[26px] flex-1 items-center gap-[3px] sm:flex"
        >
          {WAVE_HEIGHTS.map((h, i) => {
            const active = i / WAVE_HEIGHTS.length <= ratio;
            return (
              <span
                key={i}
                className={cn(
                  'flex-1 rounded-[1px] bg-wave transition-opacity',
                  active ? 'opacity-85' : 'opacity-30',
                  playing && active && 'animate-wave-pulse',
                )}
                style={{ height: `${h}%`, animationDelay: `${i * 0.04}s` }}
              />
            );
          })}
        </button>

        <span className="ml-auto flex-none text-[0.82em] tabular-nums text-card-muted sm:ml-0">
          {fromSeconds(position)} / {fromSeconds(total)}
        </span>

        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            onClick={() => onFavorite(track.id)}
            aria-label="В избранное"
            className="grid h-8 w-8 place-items-center rounded-full text-card-muted transition-colors hover:bg-black/5 hover:text-card-foreground"
          >
            <Icon name={track.favorite ? 'Heart' : 'Heart'} size={15} className={cn(track.favorite && 'fill-current text-card-foreground')} />
          </button>
          <button
            type="button"
            onClick={download}
            disabled={!hasAudio}
            aria-label="Скачать трек"
            className="hidden h-8 w-8 place-items-center rounded-full text-card-muted transition-colors hover:bg-black/5 hover:text-card-foreground disabled:opacity-40 sm:grid"
          >
            <Icon name="Download" size={15} />
          </button>
        </div>
      </div>

      {hasAudio && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[0.78em] text-foreground/45">
          <Icon name="ShieldCheck" size={13} />
          Права на этот трек принадлежат вам — можно использовать где угодно
        </p>
      )}

      {track.audio && (
        <audio
          ref={audioRef}
          src={track.audio}
          preload="metadata"
          onLoadedMetadata={(e) => setRealDuration(Math.floor(e.currentTarget.duration || 0))}
          onTimeUpdate={(e) => setPosition(Math.floor(e.currentTarget.currentTime))}
          onEnded={onToggle}
          className="hidden"
        />
      )}
    </section>
  );
};

export default Player;