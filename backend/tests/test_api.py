"""Run with DATABASE_URL pointing to a disposable PostgreSQL test database.
Never run these tests against your production database.
"""
import os
assert os.getenv('PLUTUS_TESTING') == '1', 'Set PLUTUS_TESTING=1 and a disposable DATABASE_URL to run tests'

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def register(email):
    r = client.post('/auth/register', json={'email': email, 'password': 'TestingPassword123!'})
    assert r.status_code == 201, r.text
    return {'Authorization': f"Bearer {r.json()['access_token']}"}

def test_accounts_and_isolation():
    import uuid
    a = register(f'a-{uuid.uuid4().hex}@example.com')
    b = register(f'b-{uuid.uuid4().hex}@example.com')
    payload = {'amount': 42.25, 'category': 'Groceries', 'description': 'Test', 'type': 'expense', 'date': '2026-10-01'}
    r = client.post('/transactions', json=payload, headers=a)
    assert r.status_code == 201, r.text
    tx_id = r.json()['id']
    assert client.get('/transactions', headers=b).json() == []
    assert client.put(f'/transactions/{tx_id}', json=payload, headers=b).status_code == 404
    assert client.delete(f'/transactions/{tx_id}', headers=b).status_code == 404
    assert client.get('/transactions?month=2026-10', headers=a).json()[0]['amount'] == 42.25
    assert client.delete(f'/transactions/{tx_id}', headers=a).status_code == 204

def test_budgets_goals_and_recurring():
    import uuid
    headers = register(f'c-{uuid.uuid4().hex}@example.com')
    b = client.post('/budgets', json={'month': '2026-10', 'category': 'Groceries', 'amount': 300}, headers=headers)
    assert b.status_code == 200
    assert len(client.get('/budgets?month=2026-10', headers=headers).json()) == 1
    g = client.post('/goals', json={'name': 'Emergency fund', 'target': 1000, 'saved': 200}, headers=headers)
    assert g.status_code == 201
    r = client.post('/recurring', json={'amount': 20, 'category': 'Subscriptions', 'description': 'Service', 'type': 'expense', 'date': '2026-10-01', 'day_of_month': 15, 'start_month': '2026-10'}, headers=headers)
    assert r.status_code == 201
    first = client.post('/recurring/generate?month=2026-10', headers=headers)
    second = client.post('/recurring/generate?month=2026-10', headers=headers)
    assert first.json()['created'] == 1 and second.json()['created'] == 0

def test_csv_roundtrip():
    import uuid
    headers = register(f'd-{uuid.uuid4().hex}@example.com')
    csv_data = b'date,type,amount,category,description\n2026-10-01,expense,19.50,Food,Lunch\n'
    r = client.post('/transactions/import', files={'file': ('test.csv', csv_data, 'text/csv')}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()['imported'] == 1
    r = client.get('/transactions/export', headers=headers)
    assert r.status_code == 200 and 'Lunch' in r.text
