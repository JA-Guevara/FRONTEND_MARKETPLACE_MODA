"""Disposable integration environment. Never connects to the configured database or SMTP.

Run with the sibling backend's virtualenv. Uses the real FastAPI routes and services,
an in-memory SQLite database and explicit test-only accounts. No production changes.
"""
import os
import sys
import secrets
from pathlib import Path
from datetime import timezone

BACKEND = Path(__file__).resolve().parents[2] / 'backend_marketplace_moda'
sys.path.insert(0, str(BACKEND))
os.environ['DATABASE_URL'] = 'sqlite+pysqlite:///:memory:'
os.environ['APP_ENV'] = 'development'
os.environ['JWT_SECRET_KEY'] = secrets.token_urlsafe(48)
os.environ['SMTP_HOST'] = ''
os.environ['FRONTEND_URL'] = 'http://127.0.0.1:4201'
os.environ['STRIPE_SECRET_KEY'] = ''
os.environ['STRIPE_WEBHOOK_SECRET'] = ''
os.environ['AI_API_KEY'] = ''

from sqlalchemy import DateTime, create_engine, event
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.main import create_app
from src.infrastructure.database.base import Base
from src.infrastructure.database.session import get_db
from src.auth.infrastructure.persistence.models.user import UserModel
from src.auth.infrastructure.security.password_hasher import PasswordHasher
from src.roles.infrastructure.persistence.models.role import RoleModel
from src.roles.infrastructure.persistence.models.permission import PermissionModel
from src.auth.application.services.auth_email_service import AuthEmailService
from src.usuarios_catalogo.infrastructure.models.catalog import CategoryModel, SizeModel, ColorModel, ProductModel, ProductVariantModel, ProductImageModel
from src.inventario_sucursales.infrastructure.models.organization import CityModel, BranchModel
from src.ventas_pagos.infrastructure.models import StockModel


class SQLiteUTC(TypeDecorator):
    """SQLite drops tzinfo; restore the UTC contract of production PostgreSQL."""
    impl = DateTime
    cache_ok = True

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


for table in Base.metadata.tables.values():
    for column in table.columns:
        if isinstance(column.type, DateTime):
            column.type = SQLiteUTC()

engine = create_engine('sqlite+pysqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)

@event.listens_for(engine, 'connect')
def foreign_keys(connection, record):
    connection.execute('PRAGMA foreign_keys=ON')

Base.metadata.create_all(engine)
Sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
PASSWORD = 'PruebaCicloUno!2026'
ADMIN_EMAIL = 'qa-admin@example.com'
CLIENT_EMAIL = 'qa-client@example.com'
mailbox = {}

def capture_verification(self, email, token):
    mailbox[(email, 'verification')] = token
    return True

def capture_reset(self, email, token):
    mailbox[(email, 'reset')] = token
    return True

AuthEmailService.send_verification = capture_verification
AuthEmailService.send_password_reset = capture_reset

with Sessions() as db:
    codes = ['users.read','users.write','roles.read','roles.write','audit.read','catalog.read','catalog.write','suppliers.read','suppliers.write','branches.read','branches.write']
    permissions = [PermissionModel(code=code, name=code, module=code.split('.')[0]) for code in codes]
    permissions.extend(PermissionModel(code=code, name=code, module=code.split('.')[0]) for code in ['commerce.read','commerce.write','stock.read','stock.write','dashboard.read','reservations.read','reservations.write'])
    admin = RoleModel(code='superadmin', name='Administrador de prueba', is_system=True, permissions=permissions)
    client = RoleModel(code='client', name='Cliente de prueba', is_system=True)
    hasher = PasswordHasher()
    db.add_all([admin, client])
    db.add_all([
        UserModel(email=ADMIN_EMAIL,password_hash=hasher.hash(PASSWORD),first_name='Admin',last_name='Prueba',is_verified=True,roles=[admin]),
        UserModel(email=CLIENT_EMAIL,password_hash=hasher.hash(PASSWORD),first_name='Cliente',last_name='Prueba',is_verified=True,roles=[client]),
    ])
    db.commit()
    category = CategoryModel(name='Esenciales', slug='esenciales-demo')
    size = SizeModel(name='Mediana', code='DEMO-M', sort_order=0)
    color = ColorModel(name='Arena demo', hex_code='#B89B79')
    city = CityModel(name='Ciudad demostración', department='Santa Cruz', country='Bolivia')
    db.add_all([category, size, color, city])
    db.flush()
    product = ProductModel(name='Remera esencial de ejemplo', slug='remera-demo', description='Prenda ficticia del entorno de pruebas. Estos datos desaparecen al cerrar el servidor de QA.', base_price=129, category_id=category.id, brand='FashionStore Demo', is_featured=True)
    product.variants = [ProductVariantModel(size_id=size.id,color_id=color.id,sku='DEMO-M-ARENA')]
    product.images = [ProductImageModel(url='http://127.0.0.1:4201/assets/prenda-demo.svg',alt_text='Ilustración de una remera color arena',sort_order=0,is_primary=True)]
    db.add(product)
    db.add(BranchModel(code='DEMO-01',name='Sucursal de demostración',city_id=city.id,address='Dirección ficticia para pruebas',opening_hours={'monday':{'open':'09:00','close':'18:00'}}))
    db.commit()
    branch = db.query(BranchModel).filter_by(code='DEMO-01').one()
    db.add(StockModel(variant_id=product.variants[0].id, branch_id=branch.id, quantity=12))
    db.commit()

def test_db():
    with Sessions() as db:
        yield db

app = create_app()
app.dependency_overrides[get_db] = test_db

if __name__ == '__main__':
    import uvicorn
    print('QA aislado: datos temporales en memoria; sin SMTP; solo 127.0.0.1:8011.')
    uvicorn.run(app, host='127.0.0.1', port=8011)

