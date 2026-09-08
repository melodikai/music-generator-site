import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Track } from '@/lib/studio-data';
import { Stem, checkStems, startStems } from '@/lib/api';

type Props = {
  tracks: Track[];
};

type Lane = Stem & { volume: number; muted: boolean; solo: boolean };

const LANE_ICONS: Record<string, string> = {
  vocals: 'Mic',
  drums: 'Drum',
  bass: 'Waves',
  other: 'Piano',
  guitar: 'Guitar',
  piano: 'Piano',
  no_vocals: 'Music2',
};

const shape = (seed: number, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const v = Math.sin(seed * 1.7 + i * 0.42) * Math.cos(i * 0.13 + seed);
    return 22 + Math.abs(v) * 68;
  });

const fromSeconds = (v: number) =>
  `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;

const DawEditor = ({ tracks }: Props) => {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const audios = useRef<Record<string, HTMLAudioElement | null>>({});

  const ready = useMemo(() => tracks.filter((t) => t.audio), [tracks]);
  const source = ready.find((t) => t.id === sourceId) || null;
  const soloOn = lanes.some((l) => l.solo);

  useEffect(() => {
    Object.entries(audios.current).forEach(([id, el]) => {
      if (!el) return;
      const lane = lanes.find((l) => l.id === id);
      if (!lane) return;
      const audible = soloOn ? lane.solo : !lane.muted;
      el.volume = audible ? lane.volume / 100 : 0;
    });
  }, [lanes, soloOn]);

  useEffect(() => {
    Object.values(audios.current).forEach((el) => {
      if (!el) return;
      if (playing) el.play().catch(() => undefined);
      else el.pause();
    });
  }, [playing, lanes.length]);

  const seek = (value: number) => {
    setPosition(value);
    Object.values(audios.current).forEach((el) => {
      if (el) el.currentTime = value;
    });
  };

  const patch = (id: string, next: Partial<Lane>) =>
    setLanes((prev) => prev.map((l) => (l.id === id ? { ...l, ...next } : l)));

  const load = async (track: Track) => {
    if (busy || !track.audio) return;
    setSourceId(track.id);
    setPlaying(false);
    setPosition(0);
    setDuration(0);
    setLanes([]);
    setError(null);
    setBusy(true);
    setProgress(5);

    const timer = window.setInterval(() => setProgress((p) => (p >= 92 ? p : p + 1)), 900);

    try {
      const started = await startStems({ audioUrl: track.audio });
      let result: Stem[] = [];

      for (let i = 0; i < 90; i += 1) {
        await new Promise((r) => window.setTimeout(r, 3000));
        const state = await checkStems(started.id);
        if (state.status === 'succeeded') {
          result = state.stems;
          break;
        }
        if (state.status === 'failed' || state.status === 'canceled') {
          throw new Error('Не удалось разобрать этот трек на дорожки');
        }
      }

      if (!result.length) throw new Error('Разбор занял слишком много времени');
      setProgress(100);
      setLanes(result.map((s) => ({ ...s, volume: 85, muted: false, solo: false })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось открыть трек в студии');
    } finally {
      window.clearInterval(timer);
      setBusy(false);
    }
  };

  return (
    <section className="px-4 pb-6 pt-8 sm:px-8">
      <div className="mx-auto max-w-[720px] text-center">
        <h1 className="animate-rise font-display text-[30px] font-light leading-[1.08] tracking-[-0.03em] sm:text-[38px]">
          Студия
        </h1>
        <p className="animate-rise mx-auto mt-3 max-w-[470px] text-[0.98em] leading-[1.5] text-foreground/60">
          Разберите свой трек на дорожки и сведите заново: громкость, соло, отключение партий и
          выгрузка каждой дорожки отдельно.
        </p>
      </div>

      <div className="glass-panel animate-scale-in mx-auto mt-6 max-w-[720px] rounded-2xl p-4">
        <p className="mb-2 text-[0.72em] uppercase tracking-[0.14em] text-foreground/50">
          Выберите трек
        </p>
        {ready.length === 0 ? (
          <p className="text-[0.9em] text-foreground/60">
            Сначала создайте трек — он появится здесь и его можно будет отредактировать.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ready.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => load(t)}
                disabled={busy}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[0.82em] transition-colors disabled:opacity-50',
                  sourceId === t.id
                    ? 'bg-white/25 text-foreground'
                    : 'bg-white/10 text-foreground/70 hover:text-foreground',
                )}
              >
                {t.title}
              </button>
            ))}
          </div>
        )}

        {busy && (
          <div className="mt-4">
            <p className="mb-2 text-[0.85em] text-foreground/60">
              Разбираем «{source?.title}» на дорожки…
            </p>
            <div className="h-[4px] w-full overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full bg-foreground/70 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-[0.85em] text-destructive">{error}</p>}
      </div>

      {lanes.length > 0 && (
        <div className="mx-auto mt-5 max-w-[720px] rounded-2xl bg-card p-4 text-card-foreground">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Пауза' : 'Играть'}
              className="grid h-11 w-11 flex-none place-items-center rounded-full bg-black text-white transition-transform hover:scale-105"
            >
              <Icon name={playing ? 'Pause' : 'Play'} size={17} />
            </button>
            <button
              type="button"
              onClick={() => {
                seek(0);
                setPlaying(false);
              }}
              aria-label="В начало"
              className="grid h-9 w-9 flex-none place-items-center rounded-full bg-black/8 transition-colors hover:bg-black/15"
            >
              <Icon name="SkipBack" size={15} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.92em] font-medium">{source?.title}</p>
              <p className="text-[0.8em] text-card-muted">
                {lanes.length} дорожки · {fromSeconds(position)} / {fromSeconds(duration)}
              </p>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(duration))}
              value={Math.floor(position)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Перемотка"
              className="hidden h-1 w-[190px] cursor-pointer appearance-none rounded-full bg-black/15 accent-black sm:block"
            />
          </div>

          <div className="space-y-2">
            {lanes.map((lane, index) => {
              const audible = soloOn ? lane.solo : !lane.muted;
              const bars = shape(index + 1, 56);
              return (
                <div
                  key={lane.id}
                  className={cn(
                    'rounded-xl border border-black/10 px-3 py-2.5 transition-opacity',
                    !audible && 'opacity-40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[0.88em] font-medium">
                      <Icon
                        name={LANE_ICONS[lane.id] || 'AudioLines'}
                        size={13}
                        fallback="AudioLines"
                      />
                      <span className="truncate">{lane.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => patch(lane.id, { muted: !lane.muted })}
                      className={cn(
                        'rounded-md px-2 py-1 text-[0.74em] transition-colors',
                        lane.muted ? 'bg-black text-white' : 'bg-black/8 hover:bg-black/15',
                      )}
                    >
                      Выкл
                    </button>
                    <button
                      type="button"
                      onClick={() => patch(lane.id, { solo: !lane.solo })}
                      className={cn(
                        'rounded-md px-2 py-1 text-[0.74em] transition-colors',
                        lane.solo ? 'bg-black text-white' : 'bg-black/8 hover:bg-black/15',
                      )}
                    >
                      Соло
                    </button>
                    <a
                      href={lane.url}
                      download={`${lane.name}.mp3`}
                      aria-label={`Скачать ${lane.name}`}
                      className="grid h-7 w-7 flex-none place-items-center rounded-full text-card-muted transition-colors hover:bg-black/8 hover:text-card-foreground"
                    >
                      <Icon name="Download" size={14} />
                    </a>
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        seek(((e.clientX - rect.left) / rect.width) * duration);
                      }}
                      aria-label={`Перемотать по дорожке ${lane.name}`}
                      className="flex h-[26px] flex-1 items-center gap-[2px]"
                    >
                      {bars.map((h, i) => (
                        <span
                          key={i}
                          className={cn(
                            'flex-1 rounded-[1px] transition-colors',
                            duration && i / bars.length <= position / duration
                              ? 'bg-black/70'
                              : 'bg-black/18',
                          )}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={lane.volume}
                      onChange={(e) => patch(lane.id, { volume: Number(e.target.value) })}
                      aria-label={`Громкость ${lane.name}`}
                      className="h-1 w-[92px] flex-none cursor-pointer appearance-none rounded-full bg-black/15 accent-black"
                    />
                  </div>

                  <audio
                    ref={(el) => {
                      audios.current[lane.id] = el;
                    }}
                    src={lane.url}
                    preload="auto"
                    onLoadedMetadata={(e) =>
                      setDuration((d) => Math.max(d, e.currentTarget.duration || 0))
                    }
                    onTimeUpdate={(e) => {
                      if (index === 0) setPosition(e.currentTarget.currentTime);
                    }}
                    onEnded={() => {
                      if (index === 0) setPlaying(false);
                    }}
                    className="hidden"
                  />
                </div>
              );
            })}
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.78em] text-card-muted">
            <Icon name="ShieldCheck" size={13} />
            Все дорожки принадлежат вам
          </p>
        </div>
      )}
    </section>
  );
};

export default DawEditor;
