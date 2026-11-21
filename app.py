import os
import json
import uuid
import sqlite3
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, send_from_directory, session
from werkzeug.utils import secure_filename
from database import get_db, init_db

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cursova-secret-key-2026'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=365)

# --------------- Session-based user identity ---------------

def get_user_id():
    """Return a stable UUID for the current browser session (auto-created on first visit)."""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
        session.permanent = True
    return session['user_id']

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB max upload limit

ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
    'pdf', 'doc', 'docx', 'txt', 'md', 'rtf',
    'py', 'js', 'html', 'css', 'json', 'csv', 'xlsx', 'zip'
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ----------------- Helper Functions -----------------

def format_note_row(row, db):
    note = dict(row)
    # Fetch tags for this note
    tag_cursor = db.execute('''
        SELECT t.id, t.name, t.color
        FROM tags t
        JOIN note_tags nt ON t.id = nt.tag_id
        WHERE nt.note_id = ?
        ORDER BY t.name ASC
    ''', (note['id'],))
    note['tags'] = [dict(t) for t in tag_cursor.fetchall()]
    return note

def update_note_tags(db, note_id, tag_ids_or_names, user_id=None):
    # Remove existing associations
    db.execute('DELETE FROM note_tags WHERE note_id = ?', (note_id,))
    
    if not tag_ids_or_names:
        return

    for item in tag_ids_or_names:
        if isinstance(item, int) or (isinstance(item, str) and item.isdigit()):
            tag_id = int(item)
            db.execute('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)', (note_id, tag_id))
        elif isinstance(item, str) and item.strip():
            name = item.strip().lower()
            # Find or create tag for this specific user
            if user_id:
                cursor = db.execute('SELECT id FROM tags WHERE LOWER(name) = ? AND user_id = ?', (name, user_id))
            else:
                cursor = db.execute('SELECT id FROM tags WHERE LOWER(name) = ?', (name,))
            existing = cursor.fetchone()
            if existing:
                tag_id = existing['id']
            else:
                if user_id:
                    db.execute('INSERT INTO tags (name, user_id) VALUES (?, ?)', (name, user_id))
                else:
                    db.execute('INSERT INTO tags (name) VALUES (?)', (name,))
                tag_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
            db.execute('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)', (note_id, tag_id))

# ----------------- Web UI Route -----------------

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ----------------- REST API: Notes -----------------

@app.route('/api/notes', methods=['GET'])
def get_notes():
    db = get_db()
    
    # Query parameters
    search = request.args.get('q', '').strip()
    category_id = request.args.get('category_id')
    tag_ids = request.args.get('tags')  # Comma separated tag IDs
    material_type = request.args.get('type')
    is_pinned = request.args.get('is_pinned')
    is_archived = request.args.get('is_archived', '0')
    sort_by = request.args.get('sort_by', 'updated_at')
    order = request.args.get('order', 'desc').lower()

    if sort_by not in ['updated_at', 'created_at', 'title', 'type', 'id']:
        sort_by = 'updated_at'
    if order not in ['asc', 'desc']:
        order = 'desc'

    uid = get_user_id()
    conditions = ['n.is_archived = ?', 'n.user_id = ?']
    params = [1 if is_archived == '1' else 0, uid]

    if category_id:
        conditions.append('n.category_id = ?')
        params.append(category_id)

    if material_type:
        conditions.append('n.type = ?')
        params.append(material_type)

    if is_pinned in ['0', '1']:
        conditions.append('n.is_pinned = ?')
        params.append(int(is_pinned))

    if search:
        wildcard = f'%{search}%'
        conditions.append('''
            (n.title LIKE ? OR n.content LIKE ? OR n.url LIKE ? OR c.name LIKE ? OR
             n.id IN (
                 SELECT nt.note_id FROM note_tags nt 
                 JOIN tags t ON nt.tag_id = t.id 
                 WHERE t.name LIKE ?
             ))
        ''')
        params.extend([wildcard, wildcard, wildcard, wildcard, wildcard])

    if tag_ids:
        raw_tag_ids = [int(t) for t in tag_ids.split(',') if t.strip().isdigit()]
        if raw_tag_ids:
            placeholders = ','.join(['?'] * len(raw_tag_ids))
            conditions.append(f'''
                n.id IN (
                    SELECT note_id FROM note_tags 
                    WHERE tag_id IN ({placeholders})
                    GROUP BY note_id
                )
            ''')
            params.extend(raw_tag_ids)

    where_clause = ' AND '.join(conditions)

    # Pinned items always float to the top unless specifically sorting strictly
    order_clause = f'n.is_pinned DESC, n.{sort_by} {order.upper()}'

    query = f'''
        SELECT 
            n.*,
            c.name AS category_name,
            c.color AS category_color,
            c.icon AS category_icon
        FROM notes n
        LEFT JOIN categories c ON n.category_id = c.id
        WHERE {where_clause}
        ORDER BY {order_clause}
    '''

    cursor = db.execute(query, params)
    rows = cursor.fetchall()
    notes = [format_note_row(r, db) for r in rows]
    db.close()
    return jsonify({'status': 'success', 'count': len(notes), 'data': notes})

@app.route('/api/notes/<int:note_id>', methods=['GET'])
def get_note(note_id):
    db = get_db()
    uid = get_user_id()
    query = '''
        SELECT 
            n.*,
            c.name AS category_name,
            c.color AS category_color,
            c.icon AS category_icon
        FROM notes n
        LEFT JOIN categories c ON n.category_id = c.id
        WHERE n.id = ? AND n.user_id = ?
    '''
    row = db.execute(query, (note_id, uid)).fetchone()
    if not row:
        db.close()
        return jsonify({'status': 'error', 'message': 'Нотатку не знайдено'}), 404
    note = format_note_row(row, db)
    db.close()
    return jsonify({'status': 'success', 'data': note})

@app.route('/api/notes', methods=['POST'])
def create_note():
    db = get_db()
    
    # Can accept multipart/form-data (for file uploads) or application/json
    if request.is_json:
        data = request.get_json() or {}
        file = None
    else:
        data = request.form.to_dict()
        file = request.files.get('file')

    title = data.get('title', '').strip()
    if not title:
        db.close()
        return jsonify({'status': 'error', 'message': 'Назва нотатки є обов’язковою'}), 400

    content = data.get('content', '')
    category_id = data.get('category_id') or None
    note_type = data.get('type', 'text')
    url = data.get('url', '').strip() or None
    color = data.get('color', '#ffffff')
    is_pinned = 1 if str(data.get('is_pinned')).lower() in ['1', 'true', 'on'] else 0
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    file_path = None
    file_name = None
    file_size = None

    if file and file.filename != '':
        if allowed_file(file.filename):
            original_name = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
            saved_name = timestamp + original_name
            full_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
            file.save(full_path)
            
            file_path = f'/uploads/{saved_name}'
            file_name = original_name
            file_size = os.path.getsize(full_path)
            if note_type == 'text':
                note_type = 'file'

    uid = get_user_id()
    cursor = db.execute('''
        INSERT INTO notes (
            title, content, category_id, type, url, 
            file_path, file_name, file_size, color, 
            is_pinned, is_archived, created_at, updated_at, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    ''', (title, content, category_id, note_type, url, file_path, file_name, file_size, color, is_pinned, now, now, uid))
    
    note_id = cursor.lastrowid

    # Handle tags
    tags_data = data.get('tags')
    if tags_data:
        if isinstance(tags_data, str):
            try:
                tag_list = json.loads(tags_data)
            except Exception:
                tag_list = [t.strip() for t in tags_data.split(',') if t.strip()]
        else:
            tag_list = tags_data
        update_note_tags(db, note_id, tag_list, uid)

    db.commit()

    # Retrieve created note
    row = db.execute('''
        SELECT n.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
        FROM notes n
        LEFT JOIN categories c ON n.category_id = c.id
        WHERE n.id = ?
    ''', (note_id,)).fetchone()
    created_note = format_note_row(row, db)
    db.close()

    return jsonify({'status': 'success', 'message': 'Нотатку успішно створено', 'data': created_note}), 201

@app.route('/api/notes/<int:note_id>', methods=['PUT', 'POST'])
def update_note(note_id):
    db = get_db()
    uid = get_user_id()
    existing = db.execute('SELECT * FROM notes WHERE id = ? AND user_id = ?', (note_id, uid)).fetchone()
    if not existing:
        db.close()
        return jsonify({'status': 'error', 'message': 'Нотатку не знайдено'}), 404

    if request.is_json:
        data = request.get_json() or {}
        file = None
    else:
        data = request.form.to_dict()
        file = request.files.get('file')

    title = data.get('title', existing['title']).strip()
    if not title:
        db.close()
        return jsonify({'status': 'error', 'message': 'Назва нотатки не може бути порожньою'}), 400

    content = data.get('content', existing['content'])
    category_id = data.get('category_id', existing['category_id']) or None
    note_type = data.get('type', existing['type'])
    url = data.get('url', existing['url'])
    color = data.get('color', existing['color'])
    
    if 'is_pinned' in data:
        is_pinned = 1 if str(data.get('is_pinned')).lower() in ['1', 'true', 'on'] else 0
    else:
        is_pinned = existing['is_pinned']

    if 'is_archived' in data:
        is_archived = 1 if str(data.get('is_archived')).lower() in ['1', 'true', 'on'] else 0
    else:
        is_archived = existing['is_archived']

    file_path = existing['file_path']
    file_name = existing['file_name']
    file_size = existing['file_size']

    # Check if user requested to remove existing file
    if data.get('remove_file') in ['1', 'true', True]:
        if file_path:
            old_disk_path = os.path.join(BASE_DIR, file_path.lstrip('/'))
            if os.path.exists(old_disk_path):
                try:
                    os.remove(old_disk_path)
                except OSError:
                    pass
        file_path = None
        file_name = None
        file_size = None

    if file and file.filename != '':
        if allowed_file(file.filename):
            original_name = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
            saved_name = timestamp + original_name
            full_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
            file.save(full_path)
            
            # Remove previous file if exists
            if file_path:
                old_disk_path = os.path.join(BASE_DIR, file_path.lstrip('/'))
                if os.path.exists(old_disk_path):
                    try:
                        os.remove(old_disk_path)
                    except OSError:
                        pass

            file_path = f'/uploads/{saved_name}'
            file_name = original_name
            file_size = os.path.getsize(full_path)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    db.execute('''
        UPDATE notes SET
            title = ?, content = ?, category_id = ?, type = ?,
            url = ?, file_path = ?, file_name = ?, file_size = ?,
            color = ?, is_pinned = ?, is_archived = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
    ''', (title, content, category_id, note_type, url, file_path, file_name, file_size, color, is_pinned, is_archived, now, note_id, uid))

    # Update tags if provided
    if 'tags' in data:
        tags_data = data.get('tags')
        if isinstance(tags_data, str):
            try:
                tag_list = json.loads(tags_data)
            except Exception:
                tag_list = [t.strip() for t in tags_data.split(',') if t.strip()]
        else:
            tag_list = tags_data
        update_note_tags(db, note_id, tag_list, uid)

    db.commit()

    row = db.execute('''
        SELECT n.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
        FROM notes n
        LEFT JOIN categories c ON n.category_id = c.id
        WHERE n.id = ?
    ''', (note_id,)).fetchone()
    updated_note = format_note_row(row, db)
    db.close()

    return jsonify({'status': 'success', 'message': 'Нотатку успішно оновлено', 'data': updated_note})

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    db = get_db()
    uid = get_user_id()
    existing = db.execute('SELECT * FROM notes WHERE id = ? AND user_id = ?', (note_id, uid)).fetchone()
    if not existing:
        db.close()
        return jsonify({'status': 'error', 'message': 'Нотатку не знайдено'}), 404

    # Delete physical file if attached
    if existing['file_path']:
        disk_path = os.path.join(BASE_DIR, existing['file_path'].lstrip('/'))
        if os.path.exists(disk_path):
            try:
                os.remove(disk_path)
            except OSError:
                pass

    db.execute('DELETE FROM notes WHERE id = ? AND user_id = ?', (note_id, uid))
    db.commit()
    db.close()
    return jsonify({'status': 'success', 'message': 'Нотатку видалено'})

@app.route('/api/notes/<int:note_id>/pin', methods=['POST'])
def toggle_pin_note(note_id):
    db = get_db()
    uid = get_user_id()
    note = db.execute('SELECT is_pinned FROM notes WHERE id = ? AND user_id = ?', (note_id, uid)).fetchone()
    if not note:
        db.close()
        return jsonify({'status': 'error', 'message': 'Нотатку не знайдено'}), 404

    new_pin = 0 if note['is_pinned'] == 1 else 1
    db.execute('UPDATE notes SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', (new_pin, note_id, uid))
    db.commit()
    db.close()
    return jsonify({'status': 'success', 'is_pinned': new_pin})

@app.route('/api/notes/<int:note_id>/archive', methods=['POST'])
def toggle_archive_note(note_id):
    db = get_db()
    uid = get_user_id()
    note = db.execute('SELECT is_archived FROM notes WHERE id = ? AND user_id = ?', (note_id, uid)).fetchone()
    if not note:
        db.close()
        return jsonify({'status': 'error', 'message': 'Нотатку не знайдено'}), 404

    new_archive = 0 if note['is_archived'] == 1 else 1
    db.execute('UPDATE notes SET is_archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', (new_archive, note_id, uid))
    db.commit()
    db.close()
    return jsonify({'status': 'success', 'is_archived': new_archive})

# ----------------- REST API: Categories -----------------

@app.route('/api/categories', methods=['GET'])
def get_categories():
    db = get_db()
    uid = get_user_id()
    cursor = db.execute('''
        SELECT 
            c.*,
            COUNT(n.id) AS notes_count
        FROM categories c
        LEFT JOIN notes n ON c.id = n.category_id AND n.is_archived = 0 AND n.user_id = ?
        GROUP BY c.id
        ORDER BY c.name ASC
    ''', (uid,))
    categories = [dict(row) for row in cursor.fetchall()]
    db.close()
    return jsonify({'status': 'success', 'data': categories})

@app.route('/api/categories', methods=['POST'])
def create_category():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'status': 'error', 'message': 'Назва категорії є обов’язковою'}), 400

    icon = data.get('icon', 'folder').strip()
    color = data.get('color', '#3b82f6').strip()

    db = get_db()
    try:
        cursor = db.execute('INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)', (name, icon, color))
        cat_id = cursor.lastrowid
        db.commit()
        category = dict(db.execute('SELECT *, 0 as notes_count FROM categories WHERE id = ?', (cat_id,)).fetchone())
        db.close()
        return jsonify({'status': 'success', 'message': 'Категорію створено', 'data': category}), 201
    except sqlite3.IntegrityError:
        db.close()
        return jsonify({'status': 'error', 'message': 'Категорія з такою назвою вже існує'}), 409

@app.route('/api/categories/<int:cat_id>', methods=['PUT'])
def update_category(cat_id):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    icon = data.get('icon')
    color = data.get('color')

    if not name:
        return jsonify({'status': 'error', 'message': 'Назва категорії не може бути порожньою'}), 400

    db = get_db()
    try:
        db.execute('''
            UPDATE categories 
            SET name = ?, icon = COALESCE(?, icon), color = COALESCE(?, color) 
            WHERE id = ?
        ''', (name, icon, color, cat_id))
        db.commit()
        db.close()
        return jsonify({'status': 'success', 'message': 'Категорію оновлено'})
    except sqlite3.IntegrityError:
        db.close()
        return jsonify({'status': 'error', 'message': 'Категорія з такою назвою вже існує'}), 409

@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    db = get_db()
    db.execute('DELETE FROM categories WHERE id = ?', (cat_id,))
    db.commit()
    db.close()
    return jsonify({'status': 'success', 'message': 'Категорію видалено'})

# ----------------- REST API: Tags -----------------

@app.route('/api/tags', methods=['GET'])
def get_tags():
    db = get_db()
    uid = get_user_id()
    cursor = db.execute('''
        SELECT 
            t.*,
            COUNT(DISTINCT nt.note_id) AS notes_count
        FROM tags t
        LEFT JOIN note_tags nt ON t.id = nt.tag_id
        LEFT JOIN notes n ON nt.note_id = n.id AND n.is_archived = 0 AND n.user_id = ?
        WHERE t.user_id = ?
        GROUP BY t.id
        ORDER BY t.name ASC
    ''', (uid, uid))
    tags = [dict(row) for row in cursor.fetchall()]
    db.close()
    return jsonify({'status': 'success', 'data': tags})

@app.route('/api/tags', methods=['POST'])
def create_tag():
    data = request.get_json() or {}
    name = data.get('name', '').strip().lower()
    color = data.get('color', '#6366f1').strip()

    if not name:
        return jsonify({'status': 'error', 'message': 'Назва тегу є обов’язковою'}), 400

    db = get_db()
    uid = get_user_id()
    existing = db.execute('SELECT id FROM tags WHERE LOWER(name) = ? AND user_id = ?', (name, uid)).fetchone()
    if existing:
        db.close()
        return jsonify({'status': 'error', 'message': 'Тег з такою назвою вже існує'}), 409

    cursor = db.execute('INSERT INTO tags (name, color, user_id) VALUES (?, ?, ?)', (name, color, uid))
    tag_id = cursor.lastrowid
    db.commit()
    tag = dict(db.execute('SELECT *, 0 as notes_count FROM tags WHERE id = ?', (tag_id,)).fetchone())
    db.close()
    return jsonify({'status': 'success', 'message': 'Тег створено', 'data': tag}), 201

@app.route('/api/tags/<int:tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    db = get_db()
    uid = get_user_id()
    db.execute('DELETE FROM tags WHERE id = ? AND user_id = ?', (tag_id, uid))
    db.commit()
    db.close()
    return jsonify({'status': 'success', 'message': 'Тег видалено'})

# ----------------- REST API: Stats & Analytics -----------------

@app.route('/api/stats', methods=['GET'])
def get_stats():
    db = get_db()
    uid = get_user_id()
    total_notes = db.execute('SELECT COUNT(*) FROM notes WHERE is_archived = 0 AND user_id = ?', (uid,)).fetchone()[0]
    total_archived = db.execute('SELECT COUNT(*) FROM notes WHERE is_archived = 1 AND user_id = ?', (uid,)).fetchone()[0]
    total_pinned = db.execute('SELECT COUNT(*) FROM notes WHERE is_pinned = 1 AND is_archived = 0 AND user_id = ?', (uid,)).fetchone()[0]
    total_categories = db.execute('SELECT COUNT(*) FROM categories').fetchone()[0]
    total_tags = db.execute('SELECT COUNT(*) FROM tags WHERE user_id = ?', (uid,)).fetchone()[0]
    total_files = db.execute('SELECT COUNT(*) FROM notes WHERE file_path IS NOT NULL AND is_archived = 0 AND user_id = ?', (uid,)).fetchone()[0]

    types_cursor = db.execute('''
        SELECT type, COUNT(*) as count 
        FROM notes 
        WHERE is_archived = 0 AND user_id = ?
        GROUP BY type
    ''', (uid,))
    notes_by_type = {row['type']: row['count'] for row in types_cursor.fetchall()}

    db.close()
    return jsonify({
        'status': 'success',
        'data': {
            'total_notes': total_notes,
            'total_archived': total_archived,
            'total_pinned': total_pinned,
            'total_categories': total_categories,
            'total_tags': total_tags,
            'total_files': total_files,
            'notes_by_type': notes_by_type
        }
    })

# ----------------- Export / Backup API -----------------

@app.route('/api/export', methods=['GET'])
def export_data():
    db = get_db()
    uid = get_user_id()
    categories = [dict(c) for c in db.execute('SELECT * FROM categories').fetchall()]
    tags = [dict(t) for t in db.execute('SELECT * FROM tags WHERE user_id = ?', (uid,)).fetchall()]
    
    notes_raw = db.execute('SELECT * FROM notes WHERE user_id = ?', (uid,)).fetchall()
    notes = []
    for r in notes_raw:
        n = dict(r)
        tag_cur = db.execute('''
            SELECT t.name FROM tags t 
            JOIN note_tags nt ON t.id = nt.tag_id 
            WHERE nt.note_id = ?
        ''', (n['id'],))
        n['tag_names'] = [t['name'] for t in tag_cur.fetchall()]
        notes.append(n)

    db.close()

    export_json = {
        'version': '1.0',
        'export_date': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'categories': categories,
        'tags': tags,
        'notes': notes
    }
    return jsonify(export_json)

# Initialize database on startup
init_db()

if __name__ == '__main__':
    print("=" * 60)
    print("n0t3 запущено!")
    print("Локально на комп'ютері: http://127.0.0.1:5000")
    print("У домашній мережі (Wi-Fi): http://0.0.0.0:5000 (використовуйте локальний IP комп'ютера)")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
