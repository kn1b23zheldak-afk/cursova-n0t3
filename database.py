import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'notes.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript('''
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        icon TEXT DEFAULT 'folder',
        color TEXT DEFAULT '#3b82f6',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        user_id TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        type TEXT DEFAULT 'text',
        url TEXT,
        file_path TEXT,
        file_name TEXT,
        file_size INTEGER,
        color TEXT DEFAULT '#ffffff',
        is_pinned INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        user_id TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS note_tags (
        note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (note_id, tag_id)
    );
    ''')

    # Ensure user_id column exists
    cursor.execute("PRAGMA table_info(notes)")
    cols = [col[1] for col in cursor.fetchall()]
    if 'user_id' not in cols:
        cursor.execute("ALTER TABLE notes ADD COLUMN user_id TEXT DEFAULT 'admin'")
        cursor.execute("UPDATE notes SET user_id = 'admin' WHERE user_id IS NULL OR user_id = ''")

    cursor.execute("PRAGMA table_info(tags)")
    tag_cols = [col[1] for col in cursor.fetchall()]
    if 'user_id' not in tag_cols:
        cursor.execute("ALTER TABLE tags ADD COLUMN user_id TEXT DEFAULT 'admin'")
        cursor.execute("UPDATE tags SET user_id = 'admin' WHERE user_id IS NULL OR user_id = ''")

    # Seed demo data if categories is empty
    cursor.execute("SELECT COUNT(*) FROM categories")
    if cursor.fetchone()[0] == 0:
        seed_data(cursor)

    conn.commit()
    conn.close()

def seed_data(cursor):
    # Categories
    categories = [
        ("Навчання та курсові", "graduation-cap", "#3b82f6"),
        ("Програмування та IT", "code", "#10b981"),
        ("Корисні ресурси", "bookmark", "#8b5cf6"),
        ("Особисте", "user", "#f59e0b"),
        ("Проєкти та плани", "check-square", "#ef4444")
    ]
    cursor.executemany(
        "INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)",
        categories
    )

    # Tags
    tags = [
        ("курсова", "#3b82f6"),
        ("важливо", "#ef4444"),
        ("python", "#10b981"),
        ("веб-розробка", "#06b6d4"),
        ("документація", "#8b5cf6"),
        ("посилання", "#f59e0b"),
        ("архітектура", "#6366f1"),
        ("ідеї", "#ec4899")
    ]
    cursor.executemany(
        "INSERT INTO tags (name, color) VALUES (?, ?)",
        tags
    )

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Sample Notes
    sample_notes = [
        (
            "План виконання курсової роботи",
            "### Календарний графік та етапи розробки:\n\n- [x] Аналіз предметної області та технічного завдання\n- [x] Проєктування структури бази даних (SQLite)\n- [x] Створення прототипу користувацького інтерфейсу\n- [x] Розробка REST API бекенду на Python Flask\n- [ ] Реалізація розширеного пошуку та фільтрації за тегами\n- [ ] Написання пояснювальної записки та підготовка до захисту\n\n> **Важливо:** Не забути перевірити коректність збереження файлів та сортування за всіма параметрами.",
            1, # Навчання та курсові
            "todo",
            None,
            None,
            None,
            None,
            "#fef3c7",
            1, # is_pinned
            0,
            now,
            now,
            ["курсова", "важливо", "плани"]
        ),
        (
            "Архітектура вебзастосунку нотаток",
            "## Загальний опис архітектурного рішення\n\nВебзастосунок побудовано за клієнт-серверною архітектурою з використанням шаблону **RESTful API**.\n\n### Основні модулі:\n1. **Серверна частина (Backend):** Python 3.11 + Flask microframework.\n2. **База даних:** SQLite3 (з підтримкою реляційних зв'язків Many-to-Many через таблицю `note_tags`).\n3. **Клієнтська частина (Frontend):** Адаптивний інтерфейс на Tailwind CSS, інтерактивний JavaScript SPA для миттєвого пошуку та фільтрації.\n4. **Сховище цифрових матеріалів:** локальне захищене файлове сховище `uploads/`.\n\n### ER-структура:\n- `categories` (1) ───< (M) `notes`\n- `notes` (M) >─── `note_tags` ───< (M) `tags`",
            1, # Навчання та курсові
            "text",
            None,
            None,
            None,
            None,
            "#ffffff",
            1, # is_pinned
            0,
            now,
            now,
            ["курсова", "архітектура", "документація"]
        ),
        (
            "Офіційна документація Flask Documentation",
            "Головне джерело документації по мікрофреймворку Flask. Містить посібники по маршрутизації, роботі з HTTP-запитами, шаблонізатору Jinja2 та обробці завантаження файлів.",
            3, # Корисні ресурси
            "link",
            "https://flask.palletsprojects.com/",
            None,
            None,
            None,
            "#e0f2fe",
            0,
            0,
            now,
            now,
            ["python", "веб-розробка", "посилання", "документація"]
        ),
        (
            "Базовий приклад REST API ендпоінта",
            "```python\nfrom flask import Flask, jsonify, request\n\napp = Flask(__name__)\n\n@app.route('/api/notes', methods=['GET'])\ndef get_notes():\n    category = request.args.get('category')\n    search_query = request.args.get('q', '').strip()\n    # Логіка фільтрації та вибірки з БД\n    return jsonify({\n        'status': 'success',\n        'data': []\n    })\n\nif __name__ == '__main__':\n    app.run(debug=True, port=5000)\n```",
            2, # Програмування та IT
            "code",
            None,
            None,
            None,
            None,
            "#f1f5f9",
            0,
            0,
            now,
            now,
            ["python", "веб-розробка"]
        ),
        (
            "Корисні команди Git для контролю версій",
            "```bash\n# Ініціалізація та статус\ngit init\ngit status\n\n# Фіксація змін\ngit add .\ngit commit -m \"Додано модуль фільтрації нотаток за тегами\"\n\n# Робота з гілками\ngit checkout -b feature/search-filter\ngit branch -a\n```",
            2, # Програмування та IT
            "code",
            None,
            None,
            None,
            None,
            "#ffffff",
            0,
            0,
            now,
            now,
            ["документація", "важливо"]
        ),
        (
            "Ідеї для додаткового функціоналу",
            "1. Експорт нотаток у форматі Markdown або PDF\n2. Резервне копіювання бази даних у JSON-файл\n3. Підтримка темної та світлої теми оформлення\n4. Статистична панель активності користувача\n5. Швидке копіювання фрагментів коду в буфер обміну",
            5, # Проєкти та плани
            "text",
            None,
            None,
            None,
            None,
            "#fdf2f8",
            0,
            0,
            now,
            now,
            ["ідеї", "курсова"]
        )
    ]

    for title, content, cat_id, ntype, url, fpath, fname, fsize, color, pinned, arch, cr_at, up_at, note_tag_names in sample_notes:
        cursor.execute('''
            INSERT INTO notes (
                title, content, category_id, type, url, file_path, file_name, file_size,
                color, is_pinned, is_archived, user_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?)
        ''', (title, content, cat_id, ntype, url, fpath, fname, fsize, color, pinned, arch, cr_at, up_at))
        
        note_id = cursor.lastrowid
        for tname in note_tag_names:
            cursor.execute("SELECT id FROM tags WHERE name = ?", (tname,))
            row = cursor.fetchone()
            if row:
                cursor.execute("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)", (note_id, row[0]))

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully!")
