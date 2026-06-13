"""
Módulo de conexión a PostgreSQL.

Implementa un pool de conexiones (ThreadedConnectionPool) y un ciclo de 
vida automático ligado al request context de Flask (teardown_appcontext),
lo que previene fugas de conexiones y mejora el rendimiento.
"""
import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
from flask import current_app, g

_pool = None

def init_app(app):
    """Inicializa el pool y registra el cierre de la base de datos."""
    app.teardown_appcontext(close_db)

def get_pool(cfg):
    """Retorna el pool global, inicializándolo si es necesario."""
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(
            minconn=1,
            maxconn=20,
            host=cfg['DB_HOST'],
            port=cfg['DB_PORT'],
            user=cfg['DB_USER'],
            password=cfg['DB_PASS'],
            dbname=cfg['DB_NAME'],
            connect_timeout=10
        )
    return _pool

class _PGConn:
    """
    Wrapper sobre psycopg2 que traduce cursor(dictionary=True)
    a cursor(cursor_factory=RealDictCursor).
    """
    def __init__(self, conn):
        self._conn = conn

    def cursor(self, dictionary=False, **kw):
        if dictionary:
            kw['cursor_factory'] = psycopg2.extras.RealDictCursor
        return self._conn.cursor(**kw)

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        # Ignoramos la llamada manual db.close() de los routes.
        # Flask lo gestionará en teardown_appcontext.
        pass

def get_db() -> _PGConn:
    """Retorna la conexión activa en la petición actual o crea una."""
    if 'db' not in g:
        pool = get_pool(current_app.config)
        conn = pool.getconn()
        cur = conn.cursor()
        cur.execute("SET lock_timeout = '8s'")
        cur.close()
        g.raw_conn = conn
        g.db = _PGConn(conn)
    return g.db

def close_db(e=None):
    """Cierra la conexión o la devuelve al pool."""
    db = g.pop('db', None)
    raw_conn = g.pop('raw_conn', None)
    
    if raw_conn is not None:
        global _pool
        if _pool is not None:
            try:
                # Hacer un rollback por si quedaron transacciones a medias
                raw_conn.rollback()
            except Exception:
                pass
            finally:
                _pool.putconn(raw_conn)
