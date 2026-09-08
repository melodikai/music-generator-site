import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional


def smtp_ready() -> bool:
    return bool(
        os.environ.get('SMTP_HOST')
        and os.environ.get('SMTP_USER')
        and os.environ.get('SMTP_PASSWORD')
    )


def send_reset_email(to_email: str, name: str, link: str) -> Optional[str]:
    """Отправляет письмо со ссылкой на смену пароля. Возвращает текст ошибки или None."""
    host = os.environ.get('SMTP_HOST') or ''
    user = os.environ.get('SMTP_USER') or ''
    password = os.environ.get('SMTP_PASSWORD') or ''
    port = int(os.environ.get('SMTP_PORT') or 465)

    if not (host and user and password):
        return 'no-smtp'

    greeting = f'Здравствуйте, {name}!' if name else 'Здравствуйте!'

    text = (
        f'{greeting}\n\n'
        'Вы запросили восстановление пароля в «Звучи».\n\n'
        f'Чтобы задать новый пароль, перейдите по ссылке:\n{link}\n\n'
        'Ссылка действует 1 час и сработает один раз.\n\n'
        'Если вы не запрашивали смену пароля — просто удалите это письмо, '
        'ваш текущий пароль останется прежним.\n\n'
        '— Команда «Звучи»'
    )

    html = f"""\
<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f2ee;font-family:Arial,Helvetica,sans-serif;color:#241c16">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <p style="margin:0 0 18px;font-size:22px;font-weight:600">Звучи</p>
    <p style="margin:0 0 14px;font-size:16px">{greeting}</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#4a3f36">
      Вы запросили восстановление пароля. Нажмите кнопку, чтобы задать новый.
    </p>
    <a href="{link}" style="display:inline-block;background:#241c16;color:#ffffff;
       text-decoration:none;padding:13px 26px;border-radius:12px;font-size:15px">
      Задать новый пароль
    </a>
    <p style="margin:22px 0 0;font-size:13px;line-height:1.55;color:#7a6c60">
      Ссылка действует 1 час и сработает один раз.<br>
      Если вы не запрашивали смену пароля, просто удалите это письмо — текущий пароль останется прежним.
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#a2968b;word-break:break-all">{link}</p>
  </div>
</body></html>"""

    message = EmailMessage()
    message['Subject'] = 'Восстановление пароля — Звучи'
    message['From'] = f'Звучи <{user}>'
    message['To'] = to_email
    message.set_content(text)
    message.add_alternative(html, subtype='html')

    context = ssl.create_default_context()

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as server:
                server.login(user, password)
                server.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=20) as server:
                server.starttls(context=context)
                server.login(user, password)
                server.send_message(message)
    except Exception as e:
        print(f'[mail] send failed: {type(e).__name__}: {e}')
        return 'send-failed'

    return None
