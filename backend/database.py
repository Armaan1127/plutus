import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+psycopg2://localhost:5432/plutus')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql+psycopg2://', 1)
elif DATABASE_URL.startswith('postgresql+psycopg://'):
    DATABASE_URL = DATABASE_URL.replace('postgresql+psycopg://', 'postgresql+psycopg2://', 1)
elif DATABASE_URL.startswith('postgresql://'):
    DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+psycopg2://', 1)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

def migrate_legacy_transactions():
    """Non-destructive compatibility with the original transactions table.
    Old anonymous rows remain unassigned and are NOT exposed to new accounts.
    Back up the database before running this on production.
    """
    if not inspect(engine).has_table('transactions'):
        return
    existing = {c['name'] for c in inspect(engine).get_columns('transactions')}
    statements = {
        'user_id': 'ALTER TABLE transactions ADD COLUMN user_id INTEGER',
        'date': 'ALTER TABLE transactions ADD COLUMN date DATE',
        'created_at': 'ALTER TABLE transactions ADD COLUMN created_at TIMESTAMP',
    }
    with engine.begin() as connection:
        for column, statement in statements.items():
            if column not in existing:
                connection.execute(text(statement))
