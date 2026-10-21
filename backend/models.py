from sqlalchemy import Column, Integer, Float, String
from database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    type = Column(String, nullable=False)

from database import engine

Base.metadata.create_all(bind = engine)