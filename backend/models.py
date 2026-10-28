from datetime import date, datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, UniqueConstraint, Boolean
from database import Base


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=now, nullable=False)

class Transaction(Base):
    __tablename__ = 'transactions'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True, nullable=True)  # legacy rows remain unowned
    amount = Column(Numeric(12, 2), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(String(300), nullable=False)
    type = Column(String(10), nullable=False)
    date = Column(Date, default=date.today)
    created_at = Column(DateTime, default=now)

class Budget(Base):
    __tablename__ = 'budgets'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    month = Column(String(7), nullable=False)
    category = Column(String(100), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'month', 'category'),)

class Recurring(Base):
    __tablename__ = 'recurring_transactions'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(String(300), nullable=False)
    type = Column(String(10), nullable=False)
    day_of_month = Column(Integer, nullable=False)
    start_month = Column(String(7), nullable=False)
    last_generated_month = Column(String(7), nullable=True)
    active = Column(Boolean, default=True, nullable=False)

class Goal(Base):
    __tablename__ = 'savings_goals'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    target = Column(Numeric(12, 2), nullable=False)
    saved = Column(Numeric(12, 2), nullable=False, default=0)
