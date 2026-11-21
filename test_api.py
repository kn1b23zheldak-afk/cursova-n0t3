import unittest
import json
import io
from app import app
from database import init_db

class TestN0t3App(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_01_index_page(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'n0t3', response.data)

    def test_02_get_notes(self):
        response = self.client.get('/api/notes')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertGreaterEqual(data['count'], 0)

    def test_03_create_note(self):
        payload = {
            'title': 'Тестова нотатка для перевірки',
            'content': 'Це опис тестової нотатки з тегами #test',
            'type': 'text',
            'color': '#ffffff',
            'is_pinned': 1,
            'tags': ['тест', 'автоматизація']
        }
        response = self.client.post(
            '/api/notes',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['data']['title'], 'Тестова нотатка для перевірки')
        self.assertEqual(data['data']['is_pinned'], 1)
        self.assertEqual(len(data['data']['tags']), 2)
        self.note_id = data['data']['id']

        # Test toggle pin
        pin_res = self.client.post(f'/api/notes/{self.note_id}/pin')
        self.assertEqual(pin_res.status_code, 200)
        pin_data = pin_res.get_json()
        self.assertEqual(pin_data['is_pinned'], 0)

        # Test search
        search_res = self.client.get('/api/notes?q=Тестова')
        search_data = search_res.get_json()
        self.assertGreaterEqual(search_data['count'], 1)

        # Test delete note
        del_res = self.client.delete(f'/api/notes/{self.note_id}')
        self.assertEqual(del_res.status_code, 200)

    def test_04_categories_api(self):
        response = self.client.get('/api/categories')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertGreater(len(data['data']), 0)

    def test_05_tags_api(self):
        res_create = self.client.post('/api/tags', json={'name': 'новий_тег', 'color': '#3b82f6'})
        self.assertEqual(res_create.status_code, 201)
        tag_id = res_create.get_json()['data']['id']

        response = self.client.get('/api/tags')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertGreater(len(data['data']), 0)

        # Clean up
        self.client.delete(f'/api/tags/{tag_id}')

    def test_06_stats_api(self):
        response = self.client.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertIn('total_notes', data['data'])
        self.assertIn('total_categories', data['data'])

    def test_07_file_upload(self):
        data = {
            'title': 'Нотатка з прикріпленим файлом',
            'content': 'Опис файлу',
            'type': 'file',
            'file': (io.BytesIO(b'Sample content for digital material'), 'test_doc.txt')
        }
        response = self.client.post('/api/notes', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 201)
        note = response.get_json()['data']
        self.assertIsNotNone(note['file_path'])
        self.assertEqual(note['file_name'], 'test_doc.txt')

        # Clean up
        self.client.delete(f'/api/notes/{note["id"]}')

    def test_08_drawing_note(self):
        payload = {
            'title': 'Нотатка зі скетчем/малюнком',
            'content': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'type': 'draw',
            'tags': ['малюнок', 'скетч']
        }
        response = self.client.post('/api/notes', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        note = response.get_json()['data']
        self.assertEqual(note['type'], 'draw')
        self.assertTrue(note['content'].startswith('data:image/png;base64,'))

        # Clean up
        self.client.delete(f'/api/notes/{note["id"]}')

    def test_09_user_isolation(self):
        # Client 1 creates a private note
        res1 = self.client.post('/api/notes', json={'title': 'Секретна нотатка Юзера 1', 'content': 'Секрет'})
        self.assertEqual(res1.status_code, 201)
        note_id = res1.get_json()['data']['id']

        # Client 2 (new browser session) visits
        client2 = app.test_client()
        res2_list = client2.get('/api/notes')
        notes2 = res2_list.get_json()['data']
        # Client 2 should not see Client 1's note
        self.assertNotIn(note_id, [n['id'] for n in notes2])

        # Client 2 cannot read or delete Client 1's note
        res2_get = client2.get(f'/api/notes/{note_id}')
        self.assertEqual(res2_get.status_code, 404)
        res2_del = client2.delete(f'/api/notes/{note_id}')
        self.assertEqual(res2_del.status_code, 404)

        # Clean up
        self.client.delete(f'/api/notes/{note_id}')

if __name__ == '__main__':
    unittest.main()
