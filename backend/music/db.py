import os
from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.extras


def dsn() -> Optional[str]:
    return os.environ.get('EXTERNAL_DATABASE_URL') or os.environ.get('DATABASE_URL')


def connect():
    url = dsn()
    if not url:
        return None
    return psycopg2.connect(url)


def ensure_schema() -> None:
    conn = connect()
    if not conn:
        return
    with conn, conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                plan TEXT NOT NULL DEFAULT 'free',
                used_this_month INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS tracks (
                id SERIAL PRIMARY KEY,
                user_email TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL DEFAULT '',
                prompt TEXT NOT NULL DEFAULT '',
                style TEXT NOT NULL DEFAULT '',
                mood TEXT NOT NULL DEFAULT '',
                audio_url TEXT,
                image_url TEXT,
                from_photo BOOLEAN NOT NULL DEFAULT FALSE,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                prediction_id TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS tracks_user_idx ON tracks (user_email, created_at DESC);
            """
        )
    conn.close()


def save_track(row: Dict[str, Any]) -> None:
    conn = connect()
    if not conn:
        return
    with conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tracks
                (user_email, title, prompt, style, mood, audio_url, image_url,
                 from_photo, duration_seconds, prediction_id)
            VALUES ({})
            """.format(
                ', '.join(
                    [
                        _q(row.get('user_email', '')),
                        _q(row.get('title', '')),
                        _q(row.get('prompt', '')),
                        _q(row.get('style', '')),
                        _q(row.get('mood', '')),
                        _q(row.get('audio_url')),
                        _q(row.get('image_url')),
                        'TRUE' if row.get('from_photo') else 'FALSE',
                        str(int(row.get('duration_seconds') or 0)),
                        _q(row.get('prediction_id')),
                    ]
                )
            )
        )
    conn.close()


def list_tracks(email: str = '', limit: int = 50) -> List[Dict[str, Any]]:
    conn = connect()
    if not conn:
        return []
    where = f'WHERE user_email = {_q(email)}' if email else ''
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            f'SELECT * FROM tracks {where} ORDER BY created_at DESC LIMIT {int(limit)}'
        )
        rows = cur.fetchall()
    conn.close()
    return [
        {
            'id': str(r['id']),
            'title': r['title'],
            'prompt': r['prompt'],
            'style': r['style'],
            'mood': r['mood'],
            'audio': r['audio_url'],
            'image': r['image_url'],
            'fromPhoto': r['from_photo'],
            'seconds': r['duration_seconds'],
            'createdAt': r['created_at'].isoformat() if r['created_at'] else None,
        }
        for r in rows
    ]


def upsert_user(email: str, name: str, plan: str = 'free') -> Dict[str, Any]:
    conn = connect()
    if not conn:
        return {'email': email, 'name': name, 'plan': plan, 'used': 0}
    with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            f"""
            INSERT INTO users (email, name, plan)
            VALUES ({_q(email)}, {_q(name)}, {_q(plan)})
            ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
            RETURNING email, name, plan, used_this_month
            """
        )
        row = cur.fetchone()
    conn.close()
    return {
        'email': row['email'],
        'name': row['name'],
        'plan': row['plan'],
        'used': row['used_this_month'],
    }


def bump_usage(email: str) -> None:
    conn = connect()
    if not conn or not email:
        return
    with conn, conn.cursor() as cur:
        cur.execute(
            f'UPDATE users SET used_this_month = used_this_month + 1 WHERE email = {_q(email)}'
        )
    conn.close()


def _q(value: Any) -> str:
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"
