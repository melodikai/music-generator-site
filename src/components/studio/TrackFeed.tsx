import { useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Track } from '@/lib/studio-data';
import TrackCard from './TrackCard';
import { SectionId } from './Sidebar';

type Props = {
  section: SectionId;
  tracks: Track[];
  activeId: string | null;
  playing: boolean;
  onPlay: (track: Track) => void;
  onFavorite: (id: string) => void;
  onSection: (id: SectionId) => void;
};

const TITLES: Record<SectionId, string> = {
  create: 'Готово сегодня',
  tracks: 'Мои треки',
  library: 'Библиотека',
  favorites: 'Избранное',
  history: 'История генераций',
  account: 'Личный кабинет',
  studio: 'Студия',
  stems: 'Разделение на дорожки',
};

const TrackFeed = ({
  section,
  tracks,
  activeId,
  playing,
  onPlay,
  onFavorite,
  onSection,
}: Props) => {
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    let base = tracks;
    if (section === 'favorites') base = tracks.filter((t) => t.favorite);
    if (section === 'create') base = tracks.slice(0, 3);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      base = base.filter(
        (t) => t.title.toLowerCase().includes(q) || t.style.toLowerCase().includes(q),
      );
    }
    return base;
  }, [tracks, section, query]);

  const compact = section === 'create';

  return (
    <section className="flex flex-col px-4 pb-6 pt-3.5 sm:px-8 md:px-10">
      <div className="flex items-baseline justify-between gap-3 px-0.5 pb-2.5">
        <span className="text-[0.78em] uppercase tracking-[0.14em] text-foreground/50">
          {TITLES[section]}
        </span>
        {compact ? (
          <button
            type="button"
            onClick={() => onSection('tracks')}
            className="text-[0.78em] uppercase tracking-[0.14em] text-foreground/50 transition-colors hover:text-foreground"
          >
            Все треки
          </button>
        ) : (
          <div className="glass-panel flex items-center gap-2 rounded-full px-3 py-1.5">
            <Icon name="Search" size={13} className="text-foreground/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск"
              aria-label="Поиск по трекам"
              className="w-24 bg-transparent text-[0.82em] text-foreground outline-none placeholder:text-foreground/40 sm:w-40"
            />
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-10 text-center">
          <Icon name="Music4" size={22} className="text-foreground/40" />
          <p className="text-[0.9em] text-foreground/60">Здесь пока пусто</p>
          <button
            type="button"
            onClick={() => onSection('create')}
            className="mt-1 rounded-full bg-primary px-4 py-2 text-[0.85em] text-primary-foreground transition-transform hover:scale-105"
          >
            Создать трек
          </button>
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-2.5 pb-2',
            compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-3',
          )}
        >
          {list.map((track, i) => (
            <TrackCard
              key={track.id}
              track={track}
              active={activeId === track.id}
              playing={playing}
              onPlay={onPlay}
              onFavorite={onFavorite}
              delay={Math.min(i, 6) * 0.05 + 0.2}
              detailed={!compact}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default TrackFeed;