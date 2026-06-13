from flask import request
from flask_socketio import emit, join_room, leave_room
from .extensions import socketio

@socketio.on('connect')
def handle_connect():
    print(f"Cliente conectado: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Cliente desconectado: {request.sid}")

@socketio.on('join')
def handle_join(data):
    """
    El cliente emite 'join' con su user_id cuando se autentica.
    De esta forma puede recibir mensajes privados.
    """
    user_id = data.get('user_id')
    if user_id:
        room = f"user_{user_id}"
        join_room(room)
        print(f"Usuario {user_id} se unió a la sala {room}")
        emit('status', {'msg': f'Unido a la sala {room}'}, room=request.sid)

@socketio.on('leave')
def handle_leave(data):
    user_id = data.get('user_id')
    if user_id:
        room = f"user_{user_id}"
        leave_room(room)
        print(f"Usuario {user_id} abandonó la sala {room}")
