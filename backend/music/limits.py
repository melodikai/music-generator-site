import random
from typing import Any, Dict, Optional

import psycopg2
import psycopg2.extras

from db import connect, _q

MAX_SECONDS = 210
GUEST_SECONDS = 60
VOCAL_TYPICAL_MAX = 165

PLANS: Dict[str, Dict[str, Any]] = {
    'guest': {
        'title': 'Без регистрации',
        'vocalPerMonth': 0,
        'freePerDay': 3,
        'maxSeconds': GUEST_SECONDS,
        'canDownload': False,
        'canPublish': False,
        'canStudio': False,
    },
    'free': {
        'title': 'Бесплатный',
        'vocalPerMonth': 3,
        'freePerDay': 5,
        'maxSeconds': MAX_SECONDS,
        'canDownload': True,
        'canPublish': True,
        'canStudio': True,
    },
    'standard': {
        'title': 'Стандарт',
        'vocalPerMonth': 10,
        'freePerDay': 10,
        'maxSeconds': MAX_SECONDS,
        'canDownload': True,
        'canPublish': True,
        'canStudio': True,
    },
    'premium': {
        'title': 'Премиум',
        'vocalPerMonth': 30,
        'freePerDay': -1,
        'maxSeconds': MAX_SECONDS,
        'canDownload': True,
        'canPublish': True,
        'canStudio': True,
    },
}


def plan_config(plan: Optional[str]) -> Dict[str, Any]:
    return PLANS.get((plan or 'guest').lower(), PLANS['guest'])


def vocal_duration(requested: int) -> int:
    """Подбирает длину трека для платного движка: обычно короче, чтобы экономить."""
    limit = MAX_SECONDS if random.random() < 0.1 else VOCAL_TYPICAL_MAX
    return max(30, min(limit, requested or VOCAL_TYPICAL_MAX))


def _count(where: str) -> int:
    conn = connect()
    if not conn:
        return 0
    with conn, conn.cursor() as cur:
        cur.execute(f'SELECT COUNT(*) FROM generation_log WHERE {where}')
        row = cur.fetchone()
    conn.close()
    return int(row[0]) if row else 0


def vocal_used_month(email: str) -> int:
    if not email:
        return 0
    return _count(
        f"user_email = {_q(email)} AND kind = 'vocal' "
        "AND created_at >= date_trunc('month', NOW())"
    )


def free_used_today(email: str = '', device_id: str = '') -> int:
    if email:
        target = f'user_email = {_q(email)}'
    elif device_id:
        target = f"device_id = {_q(device_id)} AND user_email = ''"
    else:
        return 0
    return f_count(target)


def f_count(target: str) -> int:
    return _count(
        f"{target} AND kind = 'free' AND created_at >= date_trunc('day', NOW())"
    )


def log_generation(
    email: str, device_id: str, kind: str, engine: str, seconds: int
) -> None:
    conn = connect()
    if not conn:
        return
    with conn, conn.cursor() as cur:
        cur.execute(
            'INSERT INTO generation_log (user_email, device_id, kind, engine, seconds) '
            f'VALUES ({_q(email)}, {_q(device_id)}, {_q(kind)}, {_q(engine)}, {int(seconds)})'
        )
    conn.close()


def user_plan(email: str) -> str:
    if not email:
        return 'guest'
    conn = connect()
    if not conn:
        return 'free'
    with conn, conn.cursor() as cur:
        cur.execute(f'SELECT plan, is_admin FROM users WHERE email = {_q(email)}')
        row = cur.fetchone()
    conn.close()
    if not row:
        return 'free'
    if row[1]:
        return 'premium'
    return row[0] or 'free'


def usage_snapshot(email: str = '', device_id: str = '') -> Dict[str, Any]:
    """Собирает остатки лимитов для показа в интерфейсе."""
    plan = user_plan(email)
    cfg = plan_config(plan)

    vocal_used = vocal_used_month(email)
    free_used = free_used_today(email, device_id)
    free_limit = cfg['freePerDay']

    return {
        'plan': plan,
        'planTitle': cfg['title'],
        'vocalLimit': cfg['vocalPerMonth'],
        'vocalUsed': vocal_used,
        'vocalLeft': max(0, cfg['vocalPerMonth'] - vocal_used),
        'freeLimit': free_limit,
        'freeUsed': free_used,
        'freeLeft': -1 if free_limit < 0 else max(0, free_limit - free_used),
        'maxSeconds': cfg['maxSeconds'],
        'canDownload': cfg['canDownload'],
        'canPublish': cfg['canPublish'],
        'canStudio': cfg['canStudio'],
    }


def check_allowed(email: str, device_id: str, wants_vocal: bool) -> Dict[str, Any]:
    """Проверяет, можно ли запустить генерацию, и возвращает причину отказа."""
    plan = user_plan(email)
    cfg = plan_config(plan)

    if wants_vocal:
        if cfg['vocalPerMonth'] <= 0:
            return {
                'ok': False,
                'code': 'need_auth' if plan == 'guest' else 'need_upgrade',
                'error': 'Песни со словами доступны после бесплатной регистрации',
            }
        used = vocal_used_month(email)
        if used >= cfg['vocalPerMonth']:
            return {
                'ok': False,
                'code': 'need_upgrade',
                'error': (
                    f'Песни со словами на этот месяц закончились '
                    f'({used} из {cfg["vocalPerMonth"]}). Обновите тариф или '
                    'создайте инструментал — он без ограничений по словам.'
                ),
            }
        return {'ok': True, 'plan': plan, 'kind': 'vocal'}

    limit = cfg['freePerDay']
    if limit >= 0:
        used = free_used_today(email, device_id)
        if used >= limit:
            return {
                'ok': False,
                'code': 'need_auth' if plan == 'guest' else 'need_upgrade',
                'error': (
                    f'На сегодня лимит исчерпан ({used} из {limit}). '
                    + (
                        'Зарегистрируйтесь — станет 5 треков в день и песни со словами.'
                        if plan == 'guest'
                        else 'Лимит обновится завтра или выберите тариф побольше.'
                    )
                ),
            }
    return {'ok': True, 'plan': plan, 'kind': 'free'}
