import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Track } from '@/lib/studio-data';

type Props = {
  track: Track;
  active: boolean;
  playing: boolean;
  onPlay: (track: Track) => void;
  onFavorite: (id: string) => void;
  delay?: number;
  detailed?: boolean;
};

const TrackCard = ({ track, active, playing, onPlay, onFavorite, delay = 0, detailed }: Props) => (
  <article
    className={cn(
      'group animate-rise flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 text-card-foreground shadow-[0_14px_34px_rgba(0,0,0,0.38)] transition-transform hover:-translate-y-0.5',
      active && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
    )}
    style={{ animationDelay: `${delay}s` }}
  >
    <button
      type="button"
      onClick={() => onPlay(track)}
      aria-label={`Слушать ${track.title}`}
      className="relative h-[34px] w-[34px] flex-none overflow-hidden rounded-lg"
      style={{ background: track.cover }}
    >
      <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <Icon name={active && playing ? 'Pause' : 'Play'} size={13} />
      </span>
    </button>
    <div className="min-w-0 flex-1">
      <span className="block truncate text-[0.9em] font-medium tracking-[-0.01em]">
        {track.title}
      </span>
      <span className="mt-0.5 block truncate text-[0.78em] text-card-muted">
        {track.style} · {track.duration}
        {detailed ? ` · ${track.createdAt}` : ''}
      </span>
    </div>
    <button
      type="button"
      onClick={() => onFavorite(track.id)}
      aria-label="В избранное"
      className="grid h-8 w-8 flex-none place-items-center rounded-full text-card-muted transition-colors hover:bg-black/5 hover:text-card-foreground"
    >
      <Icon
        name="Heart"
        size={14}
        className={cn(track.favorite && 'fill-current text-card-foreground')}
      />
    </button>
  </article>
);

export default TrackCard;
