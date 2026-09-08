import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import SiteFooter from '@/components/studio/SiteFooter';

const SECTIONS = [
  {
    title: '1. Какие данные мы собираем',
    text: 'При регистрации мы сохраняем ваше имя, адрес электронной почты и зашифрованный пароль. При работе сервиса сохраняются созданные треки, тексты описаний и загруженные вами изображения.',
  },
  {
    title: '2. Зачем нужны эти данные',
    text: 'Данные используются, чтобы вы могли войти в аккаунт, видеть свою историю треков, скачивать созданные файлы и получать поддержку. Мы не передаём персональные данные третьим лицам и не используем их для рекламы.',
  },
  {
    title: '3. Где хранятся данные',
    text: 'Учётные записи и история генераций хранятся в защищённой базе данных. Аудиофайлы и изображения размещаются в облачном хранилище. Пароли хранятся только в виде необратимого хеша.',
  },
  {
    title: '4. Публикация треков',
    text: 'Трек попадает в публичную витрину только если вы сами отметили его как публичный. В любой момент вы можете снять публикацию в личном кабинете.',
  },
  {
    title: '5. Права на созданную музыку',
    text: 'Музыка генерируется моделями со свободной лицензией и не содержит чужих записей. Исключительные права на созданный трек принадлежат вам, включая коммерческое использование.',
  },
  {
    title: '6. Удаление данных',
    text: 'Вы можете запросить удаление аккаунта и всех связанных материалов, написав на hello@zvuchi.ru. Мы удалим данные в течение 30 дней с момента обращения.',
  },
  {
    title: '7. Файлы cookie',
    text: 'Мы используем только технические файлы и локальное хранилище браузера, необходимые для сохранения активной сессии. Аналитика третьих сторон не подключена.',
  },
];

const Privacy = () => (
  <div className="min-h-screen w-full overflow-x-hidden bg-background p-2.5">
    <div className="mx-auto max-w-3xl rounded-[14px] bg-stage px-4 py-6 lg:px-8 lg:py-10">
      <Link
        to="/"
        className="flex items-center gap-2 text-[0.9em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icon name="ArrowLeft" size={16} />
        В студию
      </Link>

      <h1 className="mt-8 font-display text-4xl font-light tracking-[-0.02em] text-foreground">
        Политика конфиденциальности
      </h1>
      <p className="mt-3 text-[0.88em] text-muted-foreground">
        Действует с 1 сентября 2026 года · сервис «Звучи»
      </p>

      <div className="mt-8 space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-[1.02em] text-foreground">{s.title}</h2>
            <p className="mt-2 text-[0.92em] leading-relaxed text-muted-foreground">{s.text}</p>
          </section>
        ))}
      </div>

      <SiteFooter />
    </div>
  </div>
);

export default Privacy;
