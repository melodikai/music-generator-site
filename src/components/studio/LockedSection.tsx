import Icon from '@/components/ui/icon';

type Props = {
  title: string;
  description: string;
  onRequestAuth: () => void;
};

const LockedSection = ({ title, description, onRequestAuth }: Props) => (
  <section className="px-4 pb-6 pt-10 sm:px-8">
    <div className="glass-panel animate-scale-in mx-auto max-w-[520px] rounded-2xl p-7 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/10">
        <Icon name="Lock" size={20} className="text-foreground/70" />
      </div>
      <h1 className="mt-4 font-display text-[24px] font-light tracking-[-0.02em] sm:text-[28px]">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-[380px] text-[0.95em] leading-[1.5] text-foreground/60">
        {description}
      </p>
      <button
        type="button"
        onClick={onRequestAuth}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[0.95em] text-primary-foreground transition-transform hover:scale-[1.03]"
      >
        <Icon name="Sparkles" size={15} />
        Зарегистрироваться бесплатно
      </button>
      <p className="mt-3 text-[0.8em] text-foreground/40">
        Займёт минуту — нужна только почта
      </p>
    </div>
  </section>
);

export default LockedSection;
