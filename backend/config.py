import os

class Config:
    DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///ansible_portal.db')
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-this-in-production')
    PLAYBOOKS_DIR = '/app/data/playbooks'
    INVENTORY_DIR = '/app/data/inventory'
    LOGS_DIR = '/app/data/logs'
    SSH_KEY_PATH = '/app/ssh_keys/id_rsa'
    
    # Ensure directories exist
    for directory in [PLAYBOOKS_DIR, INVENTORY_DIR, LOGS_DIR]:
        os.makedirs(directory, exist_ok=True)
