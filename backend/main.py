import csv
import io
import os
import calendar
from datetime import date as Date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal

import jwt
from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel, EmailStr, Field, field_validator, ValidationError
from pwdlib import PasswordHash
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine, migrate_legacy_transactions
from models import User, Transaction, Budget, Recurring, Goal

SECRET_KEY = os.getenv('JWT_SECRET', '')
if len(SECRET_KEY) < 32:
    raise RuntimeError('Set JWT_SECRET to a random value of at least 32 characters before starting the API.')

# Compatibility with the original public demo schema; does not delete existing records.
migrate_legacy_transactions()
Base.metadata.create_all(bind=engine)

app = FastAPI(title='Plutus API', version='2.0')
origins = ['http://localhost:5173', 'http://localhost:5174']
origins += [s.strip().rstrip('/') for s in os.getenv('FRONTEND_URL', '').split(',') if s.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allow_headers=['Authorization', 'Content-Type'])
security = HTTPBearer()
password_hash = PasswordHash.recommended()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=['HS256'])
        user_id = int(payload['sub'])
    except (InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(status_code=401, detail='Invalid or expired session')
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail='Account not found')
    return user


def token_for(user):
    return jwt.encode({'sub': str(user.id), 'exp': datetime.now(timezone.utc) + timedelta(hours=12)}, SECRET_KEY, algorithm='HS256')


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TransactionInput(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    category: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=300)
    type: Literal['income', 'expense']
    date: Date = Field(default_factory=Date.today)

    @field_validator('category', 'description')
    @classmethod
    def trim(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('Cannot be blank')
        return value


class BudgetInput(BaseModel):
    month: str = Field(pattern=r'^\d{4}-(0[1-9]|1[0-2])$')
    category: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class RecurringInput(TransactionInput):
    day_of_month: int = Field(ge=1, le=31)
    start_month: str = Field(pattern=r'^\d{4}-(0[1-9]|1[0-2])$')


class GoalInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    saved: Decimal = Field(ge=0, max_digits=12, decimal_places=2, default=0)


def tx_out(t):
    return {'id': t.id, 'amount': float(t.amount), 'category': t.category, 'description': t.description,
            'type': t.type, 'date': (t.date or Date.today()).isoformat()}


def budget_out(b):
    return {'id': b.id, 'month': b.month, 'category': b.category, 'amount': float(b.amount)}


def recurring_out(r):
    return {'id': r.id, 'amount': float(r.amount), 'category': r.category, 'description': r.description,
            'type': r.type, 'day_of_month': r.day_of_month, 'start_month': r.start_month,
            'last_generated_month': r.last_generated_month, 'active': r.active}


def goal_out(g):
    return {'id': g.id, 'name': g.name, 'target': float(g.target), 'saved': float(g.saved)}


@app.get('/')
def home():
    return {'message': 'Plutus API v2', 'status': 'ok'}


@app.post('/auth/register', status_code=201)
def register(payload: Credentials, db: Session = Depends(get_db)):
    email = str(payload.email).lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, 'Email already registered')
    user = User(email=email, password_hash=password_hash.hash(payload.password))
    db.add(user)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(409, 'Email already registered')
    db.refresh(user)
    return {'access_token': token_for(user), 'email': user.email}


@app.post('/auth/login')
def login(payload: Credentials, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(payload.email).lower()).first()
    if not user or not password_hash.verify(payload.password, user.password_hash):
        raise HTTPException(401, 'Incorrect email or password')
    return {'access_token': token_for(user), 'email': user.email}


@app.get('/auth/me')
def me(user: User = Depends(current_user)):
    return {'email': user.email, 'id': user.id}


@app.get('/transactions')
def list_transactions(month: str | None = Query(None, pattern=r'^\d{4}-(0[1-9]|1[0-2])$'),
                      user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(Transaction).filter(Transaction.user_id == user.id)
    if month:
        query = query.filter(Transaction.date >= Date.fromisoformat(month + '-01'),
                             Transaction.date < next_month(month))
    return [tx_out(t) for t in query.order_by(Transaction.date.desc(), Transaction.id.desc()).all()]


def next_month(month):
    year, m = map(int, month.split('-'))
    return Date(year + (m == 12), 1 if m == 12 else m + 1, 1)


@app.post('/transactions', status_code=201)
def add_transaction(payload: TransactionInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t = Transaction(user_id=user.id, **payload.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return tx_out(t)


def owned(db, model, id, user):
    item = db.query(model).filter(model.id == id, model.user_id == user.id).first()
    if not item:
        raise HTTPException(404, 'Not found')
    return item


@app.put('/transactions/{transaction_id}')
def update_transaction(transaction_id: int, payload: TransactionInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t = owned(db, Transaction, transaction_id, user)
    for k, v in payload.model_dump().items():
        setattr(t, k, v)
    db.commit(); db.refresh(t)
    return tx_out(t)


@app.delete('/transactions/{transaction_id}', status_code=204)
def delete_transaction(transaction_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, Transaction, transaction_id, user)); db.commit()


@app.get('/budgets')
def list_budgets(month: str | None = Query(None, pattern=r'^\d{4}-(0[1-9]|1[0-2])$'), user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(Budget).filter(Budget.user_id == user.id)
    if month:
        q = q.filter(Budget.month == month)
    return [budget_out(b) for b in q.order_by(Budget.category).all()]


@app.post('/budgets')
def upsert_budget(payload: BudgetInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    category = payload.category.strip()
    if not category:
        raise HTTPException(422, 'Category is required')
    b = db.query(Budget).filter_by(user_id=user.id, month=payload.month, category=category).first()
    if b:
        b.amount = payload.amount
    else:
        b = Budget(user_id=user.id, month=payload.month, category=category, amount=payload.amount)
        db.add(b)
    db.commit(); db.refresh(b)
    return budget_out(b)


@app.delete('/budgets/{budget_id}', status_code=204)
def delete_budget(budget_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, Budget, budget_id, user)); db.commit()


@app.get('/recurring')
def list_recurring(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [recurring_out(r) for r in db.query(Recurring).filter_by(user_id=user.id).order_by(Recurring.id.desc())]


@app.post('/recurring', status_code=201)
def add_recurring(payload: RecurringInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={'date'})
    r = Recurring(user_id=user.id, **data)
    db.add(r); db.commit(); db.refresh(r)
    return recurring_out(r)


@app.delete('/recurring/{recurring_id}', status_code=204)
def delete_recurring(recurring_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, Recurring, recurring_id, user)); db.commit()


@app.post('/recurring/generate')
def generate_recurring(month: str = Query(..., pattern=r'^\d{4}-(0[1-9]|1[0-2])$'), user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Explicitly generate a month's transactions once. No background scheduler required."""
    if month > Date.today().strftime('%Y-%m'):
        raise HTTPException(422, 'Cannot generate future months')
    year, m = map(int, month.split('-'))
    count = 0
    for r in db.query(Recurring).filter_by(user_id=user.id, active=True).all():
        if r.start_month > month or (r.last_generated_month and r.last_generated_month >= month):
            continue
        d = Date(year, m, min(r.day_of_month, calendar.monthrange(year, m)[1]))
        db.add(Transaction(user_id=user.id, amount=r.amount, category=r.category,
                           description=r.description, type=r.type, date=d))
        r.last_generated_month = month
        count += 1
    db.commit()
    return {'created': count}


@app.get('/goals')
def list_goals(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [goal_out(g) for g in db.query(Goal).filter_by(user_id=user.id).order_by(Goal.id.desc())]


@app.post('/goals', status_code=201)
def add_goal(payload: GoalInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = Goal(user_id=user.id, **payload.model_dump()); db.add(g); db.commit(); db.refresh(g)
    return goal_out(g)


@app.put('/goals/{goal_id}')
def update_goal(goal_id: int, payload: GoalInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = owned(db, Goal, goal_id, user)
    for k, v in payload.model_dump().items(): setattr(g, k, v)
    db.commit(); db.refresh(g)
    return goal_out(g)


@app.delete('/goals/{goal_id}', status_code=204)
def delete_goal(goal_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, Goal, goal_id, user)); db.commit()


@app.get('/transactions/export')
def export_csv(user: User = Depends(current_user), db: Session = Depends(get_db)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['date', 'type', 'amount', 'category', 'description'])
    for t in db.query(Transaction).filter_by(user_id=user.id).order_by(Transaction.date, Transaction.id):
        writer.writerow([t.date or Date.today(), t.type, t.amount, t.category, t.description])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type='text/csv',
                             headers={'Content-Disposition': 'attachment; filename="plutus-transactions.csv"'})


@app.post('/transactions/import')
async def import_csv(file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)):
    content = await file.read(1_000_001)
    if len(content) > 1_000_000:
        raise HTTPException(413, 'CSV must be smaller than 1 MB')
    try:
        reader = csv.DictReader(io.StringIO(content.decode('utf-8-sig')))
        if not reader.fieldnames or not {'date', 'type', 'amount', 'category', 'description'} <= set(reader.fieldnames):
            raise ValueError('Required columns: date,type,amount,category,description')
        entries = []
        for row in reader:
            if len(entries) >= 1000:
                raise ValueError('Maximum 1,000 rows per import')
            entries.append(TransactionInput(**row))
    except (UnicodeError, ValueError, TypeError, ValidationError, csv.Error) as exc:
        raise HTTPException(422, f'Invalid CSV: {str(exc)[:180]}')
    for entry in entries:
        db.add(Transaction(user_id=user.id, **entry.model_dump()))
    db.commit()
    return {'imported': len(entries)}
