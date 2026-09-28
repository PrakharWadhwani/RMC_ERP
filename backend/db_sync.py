import csv
import os

from models import (
    User,
    Product,
    Category,
    StockLog,
    Stakeholder,
    PurchaseBill,
    Transaction,
    TransactionItem,
    Expense,
    SystemBalance,
    SystemSettings,
    SalaryAdvance,
)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_DIR = os.path.join(BASE_DIR, "db_storage")
CSV_DIR = os.path.join(DB_DIR, "csv_backups")

os.makedirs(CSV_DIR, exist_ok=True)

MODEL_EXPORTS = [
    (User, "users.csv"),
    (Product, "products.csv"),
    (Category, "categories.csv"),
    (StockLog, "stock_logs.csv"),
    (Stakeholder, "stakeholders.csv"),
    (PurchaseBill, "purchase_bills.csv"),
    (Transaction, "transactions.csv"),
    (TransactionItem, "transaction_items.csv"),
    (Expense, "expenses.csv"),
    (SystemBalance, "system_balances.csv"),
    (SystemSettings, "system_settings.csv"),
    (SalaryAdvance, "salary_advances.csv"),
]


def _normalize_value(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "1" if value else "0"
    return str(value)


def _cast_value(value, column):
    if value is None or value == "":
        return None
    try:
        py_type = column.type.python_type
        if py_type is bool:
            return str(value).strip().lower() in ("1", "true", "yes", "y")
        if py_type is int:
            return int(value)
        if py_type is float:
            return float(value)
        return value
    except Exception:
        return value


def sync_db_to_csv(db_session):
    for model, filename in MODEL_EXPORTS:
        try:
            column_names = [column.name for column in model.__table__.columns]
            rows = db_session.query(model).all()
            csv_path = os.path.join(CSV_DIR, filename)

            with open(csv_path, "w", newline="", encoding="utf-8") as fh:
                writer = csv.writer(fh)
                writer.writerow(column_names)
                for row in rows:
                    writer.writerow([_normalize_value(getattr(row, name)) for name in column_names])
        except Exception as exc:
            print(f"[SYNC ENGINE LOG] CSV export skipped for {model.__tablename__}: {exc}")


def sync_csv_to_db(db_session):
    if not os.path.isdir(CSV_DIR):
        return

    for model, filename in MODEL_EXPORTS:
        csv_path = os.path.join(CSV_DIR, filename)
        if not os.path.exists(csv_path):
            continue

        try:
            if db_session.query(model).first() is not None:
                continue

            with open(csv_path, "r", newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                rows = list(reader)
                if not rows:
                    continue

                for row in rows:
                    record = {}
                    for column in model.__table__.columns:
                        if column.name in row:
                            record[column.name] = _cast_value(row[column.name], column)
                    if record:
                        db_session.add(model(**record))

            db_session.commit()
        except Exception as exc:
            print(f"[SYNC ENGINE LOG] Startup restore skipped for {model.__tablename__}: {exc}")
            db_session.rollback()
