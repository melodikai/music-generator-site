import hashlib
import hmac
import json
import os
import re
import secrets
import time
from typing import Any, Dict

import psycopg2
import psycopg2.extras

import db
import mailer

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$')
SESSION_DAYS = 30


def respond(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': CORS,
        'isBase64Encoded': False,
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }


def ensure_auth_schema() -> None:
    db.ensure_schema()
    conn = db.connect()
    if not conn:
        return
    with conn, conn.cursor() as cur:
        cur.execute(
            """
            ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_email TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS sessions_email_idx ON sessions (user_email);
            """
        )
    conn.close()


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 120000).hex()


def create_session(email: str) -> str:
    token = secrets.token_urlsafe(32)
    conn = db.connect()
    if not conn:
        return token
    expires = int(time.time()) + SESSION_DAYS * 86400
    with conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO sessions (token, user_email, expires_at) "
            f"VALUES ({db._q(token)}, {db._q(email)}, to_timestamp({expires}))"
        )
    conn.close()
    return token


def user_by_token(token: str) -> Dict[str, Any]:
    conn = db.connect()
    if not conn or not token:
        return {}
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            f"""
            SELECT u.email, u.name, u.plan, u.used_this_month, u.is_admin
            FROM sessions s JOIN users u ON u.email = s.user_email
            WHERE s.token = {db._q(token)} AND s.expires_at > NOW()
            """
        )
        row = cur.fetchone()
    conn.close()
    if not row:
        return {}
    return {
        'email': row['email'],
        'name': row['name'],
        'plan': row['plan'],
        'used': row['used_this_month'],
        'isAdmin': bool(row['is_admin']),
    }


def find_user(email: str) -> Dict[str, Any]:
    conn = db.connect()
    if not conn:
        return {}
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            f'SELECT email, name, plan, used_this_month, password_hash, password_salt, is_admin '
            f'FROM users WHERE email = {db._q(email)}'
        )
        row = cur.fetchone()
    conn.close()
    return dict(row) if row else {}


def handle_register(body: Dict[str, Any]) -> Dict[str, Any]:
    email = str(body.get('email') or '').strip().lower()
    password = str(body.get('password') or '')
    name = str(body.get('name') or '').strip() or email.split('@')[0]

    if not EMAIL_RE.match(email):
        return respond(400, {'error': 'Введите корректный адрес электронной почты'})
    if len(password) < 6:
        return respond(400, {'error': 'Пароль должен быть не короче 6 символов'})

    ensure_auth_schema()
    if find_user(email):
        return respond(409, {'error': 'Такая почта уже зарегистрирована'})

    salt = secrets.token_hex(16)
    digest = hash_password(password, salt)

    conn = db.connect()
    if not conn:
        return respond(503, {'error': 'База данных пока не подключена'})
    with conn, conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO users (email, name, plan, password_hash, password_salt) "
            f"VALUES ({db._q(email)}, {db._q(name)}, 'free', {db._q(digest)}, {db._q(salt)})"
        )
    conn.close()

    token = create_session(email)
    return respond(200, {
        'token': token,
        'user': {'email': email, 'name': name, 'plan': 'free', 'used': 0, 'isAdmin': False},
    })


def handle_login(body: Dict[str, Any]) -> Dict[str, Any]:
    email = str(body.get('email') or '').strip().lower()
    password = str(body.get('password') or '')

    ensure_auth_schema()
    user = find_user(email)
    if not user or not user.get('password_hash'):
        return respond(401, {'error': 'Неверная почта или пароль'})

    digest = hash_password(password, user['password_salt'] or '')
    if not hmac.compare_digest(digest, user['password_hash']):
        return respond(401, {'error': 'Неверная почта или пароль'})

    token = create_session(email)
    return respond(200, {
        'token': token,
        'user': {
            'email': user['email'],
            'name': user['name'],
            'plan': user['plan'],
            'used': user['used_this_month'],
            'isAdmin': bool(user.get('is_admin')),
        },
    })


def handle_grant_admin(body: Dict[str, Any]) -> Dict[str, Any]:
    """Выдаёт права администратора владельцу проекта по секретному ключу."""
    secret = os.environ.get('ADMIN_SETUP_KEY') or ''
    provided = str(body.get('key') or '')
    email = str(body.get('email') or '').strip().lower()

    if not secret or not hmac.compare_digest(provided, secret):
        return respond(403, {'error': 'Неверный ключ администратора'})

    ensure_auth_schema()
    if not find_user(email):
        return respond(404, {'error': 'Сначала зарегистрируйте эту почту'})

    conn = db.connect()
    if not conn:
        return respond(503, {'error': 'База данных пока не подключена'})
    with conn, conn.cursor() as cur:
        cur.execute(
            f"UPDATE users SET is_admin = TRUE, plan = 'premium' WHERE email = {db._q(email)}"
        )
    conn.close()
    return respond(200, {'ok': True, 'email': email})


def ensure_reset_schema() -> None:
    conn = db.connect()
    if not conn:
        return
    with conn, conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS password_resets (
                token TEXT PRIMARY KEY,
                user_email TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                used_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS password_resets_email_idx
                ON password_resets (user_email, created_at DESC);
            """
        )
    conn.close()


def recent_reset_count(email: str) -> int:
    conn = db.connect()
    if not conn:
        return 0
    with conn, conn.cursor() as cur:
        cur.execute(
            f"SELECT COUNT(*) FROM password_resets WHERE user_email = {db._q(email)} "
            "AND created_at > NOW() - INTERVAL '15 minutes'"
        )
        row = cur.fetchone()
    conn.close()
    return int(row[0]) if row else 0


def handle_forgot(body: Dict[str, Any]) -> Dict[str, Any]:
    """Отправляет на почту ссылку для смены забытого пароля."""
    email = str(body.get('email') or '').strip().lower()
    origin = str(body.get('origin') or '').strip().rstrip('/')

    if not EMAIL_RE.match(email):
        return respond(400, {'error': 'Введите корректный адрес электронной почты'})

    ensure_auth_schema()
    ensure_reset_schema()

    done = {'ok': True, 'message': 'Если такая почта зарегистрирована, письмо уже отправлено'}

    user = find_user(email)
    if not user:
        return respond(200, done)

    if recent_reset_count(email) >= 3:
        return respond(429, {
            'error': 'Слишком много запросов. Подождите 15 минут и попробуйте снова.'
        })

    if not mailer.smtp_ready():
        return respond(503, {
            'error': 'Отправка писем пока не настроена. Обратитесь в поддержку.',
            'needSmtp': True,
        })

    token = secrets.token_urlsafe(32)
    expires = int(time.time()) + 3600

    conn = db.connect()
    if not conn:
        return respond(503, {'error': 'База данных пока не подключена'})
    with conn, conn.cursor() as cur:
        cur.execute(
            'INSERT INTO password_resets (token, user_email, expires_at) '
            f'VALUES ({db._q(token)}, {db._q(email)}, to_timestamp({expires}))'
        )
    conn.close()

    base = origin if origin.startswith('http') else 'https://zvuchi.ru'
    link = f'{base}/reset?token={token}'

    failed = mailer.send_reset_email(email, user.get('name') or '', link)
    if failed:
        return respond(502, {
            'error': 'Не удалось отправить письмо. Попробуйте позже или напишите в поддержку.'
        })

    return respond(200, done)


def handle_reset(body: Dict[str, Any]) -> Dict[str, Any]:
    """Устанавливает новый пароль по ссылке из письма."""
    token = str(body.get('token') or '').strip()
    password = str(body.get('password') or '')

    if len(password) < 6:
        return respond(400, {'error': 'Пароль должен быть не короче 6 символов'})

    ensure_auth_schema()
    ensure_reset_schema()

    conn = db.connect()
    if not conn:
        return respond(503, {'error': 'База данных пока не подключена'})

    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            f'SELECT user_email FROM password_resets WHERE token = {db._q(token)} '
            'AND used_at IS NULL AND expires_at > NOW()'
        )
        row = cur.fetchone()

    if not row:
        conn.close()
        return respond(400, {
            'error': 'Ссылка устарела или уже использована. Запросите новую.'
        })

    email = row['user_email']
    salt = secrets.token_hex(16)
    digest = hash_password(password, salt)

    with conn, conn.cursor() as cur:
        cur.execute(
            f'UPDATE users SET password_hash = {db._q(digest)}, '
            f'password_salt = {db._q(salt)} WHERE email = {db._q(email)}'
        )
        cur.execute(
            f'UPDATE password_resets SET used_at = NOW() WHERE token = {db._q(token)}'
        )
        cur.execute(f'DELETE FROM sessions WHERE user_email = {db._q(email)}')
    conn.close()

    user = find_user(email)
    session = create_session(email)

    return respond(200, {
        'token': session,
        'user': {
            'email': user['email'],
            'name': user['name'],
            'plan': user['plan'],
            'used': user['used_this_month'],
            'isAdmin': bool(user.get('is_admin')),
        },
    })


def handle_logout(token: str) -> Dict[str, Any]:
    conn = db.connect()
    if conn and token:
        with conn, conn.cursor() as cur:
            cur.execute(f'DELETE FROM sessions WHERE token = {db._q(token)}')
        conn.close()
    return respond(200, {'ok': True})


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Регистрация, вход по электронной почте и проверка активной сессии пользователя."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'isBase64Encoded': False, 'body': ''}

    headers = event.get('headers') or {}
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token') or ''

    if not db.dsn():
        return respond(503, {'error': 'База данных пока не подключена'})

    if method == 'GET':
        user = user_by_token(token)
        if not user:
            return respond(401, {'error': 'Сессия не найдена'})
        return respond(200, {'user': user})

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        action = body.get('action')
        if action == 'register':
            return handle_register(body)
        if action == 'login':
            return handle_login(body)
        if action == 'logout':
            return handle_logout(token)
        if action == 'grantAdmin':
            return handle_grant_admin(body)
        if action == 'forgot':
            return handle_forgot(body)
        if action == 'reset':
            return handle_reset(body)
        return respond(400, {'error': 'Неизвестное действие'})

    return respond(405, {'error': 'Метод не поддерживается'})