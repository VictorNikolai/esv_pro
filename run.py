"""
Ex Scientia Veritas — Punto de entrada del servidor.

Uso:
    python run.py

Variables de entorno relevantes (en archivo .env):
    FLASK_ENV   development | production
    PORT        5000 (por defecto)
"""
import os
from dotenv import load_dotenv
from app    import create_app
from app.extensions import socketio

# Carga variables desde .env (si existe)
load_dotenv()

env = os.getenv('FLASK_ENV', 'development')
app = create_app(env)

if __name__ == '__main__':
    port   = int(os.getenv('PORT', 5000))
    debug  = env == 'development'

    print()
    print('  ======================================')
    print('  |  EX SCIENTIA VERITAS               |')
    print('  |  Sistema de Calibraciones          |')
    print('  ======================================')
    print(f'  Servidor  =>  http://127.0.0.1:{port}')
    print(f'  Entorno   =>  {env}')
    print(f'  Base de datos => {os.getenv("DB_NAME", "esv_calibraciones")}')
    print()

    socketio.run(app, host='127.0.0.1', port=port, debug=debug)
