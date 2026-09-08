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
            SELECT u.email, u.name, u.plan, u.used_this_month
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
    }


def find_user(email: str) -> Dict[str, Any]:
    conn = db.connect()
    if not conn:
        return {}
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            f'SELECT email, name, plan, used_this_month, password_hash, password_salt '
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
        'user': {'email': email, 'name': name, 'plan': 'free', 'used': 0},
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
        return respond(400, {'error': 'Неизвестное действие'})

    return respond(405, {'error': 'Метод не поддерживается'})
