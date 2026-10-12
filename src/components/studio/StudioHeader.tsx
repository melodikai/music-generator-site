import Icon from '@/components/ui/icon';

type Props = {
  onOpenMenu: () => void;
  onAccount: () => void;
};

const StudioHeader = ({ onOpenMenu, onAccount }: Props) => (
  <>
    <div className="flex items-center justify-between px-4 pt-3 lg:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Открыть меню"
        className="glass-panel grid h-9 w-9 place-items-center rounded-full text-foreground"
      >
        <Icon name="Menu" size={17} />
      </button>
      <span className="font-display text-[1.05em] font-medium tracking-[-0.02em]">
        Звучи
      </span>
      <button
        type="button"
        onClick={onAccount}
        aria-label="Личный кабинет"
        className="glass-panel grid h-9 w-9 place-items-center rounded-full text-foreground"
      >
        <Icon name="User" size={17} />
      </button>
    </div>

    <div className="mx-4 mt-3 flex flex-col gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4 lg:mx-5 lg:mt-4">
      <div className="flex flex-none items-center gap-3">
        <img
          src="/logo-fasie.png"
          alt="Фонд содействия инновациям"
          className="h-9 w-auto"
        />
        <span className="h-6 w-px bg-white/12" aria-hidden />
        <img
          src="/logo-put.png"
          alt="Платформа университетского технологического предпринимательства"
          className="h-8 w-auto opacity-70"
        />
      </div>
      <p className="text-[0.7em] leading-[1.55] tracking-[0.005em] text-muted-foreground sm:text-[0.72em]">
        Проект реализован при поддержке Фонда содействия инновациям в рамках программы
        «Студенческий стартап» Платформы университетского технологического
        предпринимательства федерального проекта «Технологии», входящего в состав
        национального проекта «Эффективная и конкурентная экономика».
      </p>
    </div>
  </>
);

export default StudioHeader;
