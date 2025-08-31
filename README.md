# ansible-portal
Ansible Management Portal

# Project Structure
ansible-portal/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py
│   ├── config.py
│   ├── models.py
│   └── ansible_runner.py
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── index.html
│   │   ├── app.js
│   │   ├── style.css
│   │   └── components/
│   │       ├── PlaybookManager.js
│   │       ├── NodeManager.js
│   │       └── ExecutionLogs.js
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf
├── data/
│   ├── playbooks/
│   └── inventory/
└── README.md
