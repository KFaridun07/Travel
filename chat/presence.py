# Кто сейчас на сайте: номер пользователя -> сколько у него открытых вкладок.
# Хранится в памяти, этого хватает, пока сервер работает одним процессом
connections = {}


def add_connection(user_id):
    connections[user_id] = connections.get(user_id, 0) + 1
    return connections[user_id] == 1


def remove_connection(user_id):
    connections[user_id] = connections.get(user_id, 1) - 1
    if connections[user_id] <= 0:
        del connections[user_id]
        return True
    return False


def is_online(user_id):
    return user_id in connections
