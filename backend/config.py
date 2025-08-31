import os

class Config:
    DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///ansible_portal.db')
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-this')
    PLAYBOOKS_DIR = '/app/data/playbooks'
    INVENTORY_DIR = '/app/data/inventory'
    LOGS_DIR = '/app/data/logs'
    
    # Ensure directories exist
    os.makedirs(PLAYBOOKS_DIR, exist_ok=True)
    os.makedirs(INVENTORY_DIR, exist_ok=True)
    os.makedirs(LOGS_DIR, exist_ok=True)
