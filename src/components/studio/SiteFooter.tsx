import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';

const SiteFooter = () => (
  <footer className="mt-10 border-t border-white/[0.07] px-4 py-7 lg:px-5">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-[420px]">
        <div className="flex items-center gap-3">
          <img src="/logo-fasie.png" alt="Фонд содействия инновациям" className="h-9 w-auto" />
          <span className="h-6 w-px bg-white/12" aria-hidden />
          <img
            src="/logo-put.png"
            alt="Платформа университетского технологического предпринимательства"
            className="h-9 w-auto opacity-70"
          />
        </div>
        <p className="mt-3 text-[0.7em] leading-[1.6] text-muted-foreground">
          Проект реализован при поддержке Фонда содействия инновациям в рамках программы
          «Студенческий стартап» Платформы университетского технологического предпринимательства
          федерального проекта «Технологии», входящего в состав национального проекта «Эффективная и
          конкурентная экономика».
        </p>
      </div>

      <div className="flex flex-col gap-2.5 text-[0.85em]">
        <span className="text-[0.82em] uppercase tracking-[0.14em] text-muted-foreground">
          Контакты
        </span>
        <a
          href="mailto:hello@zvuchi.ru"
          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon name="Mail" size={14} />
          hello@zvuchi.ru
        </a>
        <a
          href="https://t.me/zvuchi"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon name="Send" size={14} />
          Телеграм-канал
        </a>
      </div>

      <div className="flex flex-col gap-2.5 text-[0.85em]">
        <span className="text-[0.82em] uppercase tracking-[0.14em] text-muted-foreground">
          Документы
        </span>
        <Link
          to="/privacy"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Политика конфиденциальности
        </Link>
        <Link
          to="/showcase"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Лучшие треки
        </Link>
      </div>
    </div>

    <p className="mt-6 text-[0.75em] text-muted-foreground">
      © {new Date().getFullYear()} Звучи. Права на созданные треки принадлежат их авторам.
    </p>
  </footer>
);

export default SiteFooter;
