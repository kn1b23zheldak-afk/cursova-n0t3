#!/bin/bash
# n0t3 — скрипт швидкого запуску для macOS

cd "$(dirname "$0")"

echo "======================================================================"
echo "   n0t3: Вебзастосунок нотаток та цифрових матеріалів"
echo "======================================================================"
echo ""

# Перевірка наявності python3
if ! command -v python3 &> /dev/null; then
    echo "[ПОМИЛКА] Python 3 не знайдено в системі! Встановіть його з python.org або через brew install python3."
    exit 1
fi

echo "[1/3] Перевірка та налаштування віртуального середовища..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

echo "[2/3] Перевірка та встановлення бібліотек..."
pip install -r requirements.txt --quiet

echo "[3/3] Запуск сервера..."
(sleep 1.5 && open "http://127.0.0.1:5000") &

python3 app.py
