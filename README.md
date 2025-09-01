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

# Ansible Management Portal

A web-based management portal for Ansible playbooks with a modern, intuitive interface.

## Features

- **Playbook Management**: Upload, view, and execute Ansible playbooks
- **Node Management**: Add, edit, and organize target machines
- **Group Management**: Create groups of nodes for batch operations
- **Multi-Selection**: Select multiple playbooks and apply to multiple targets
- **Real-time Execution**: Monitor playbook execution with real-time updates
- **Execution History**: View detailed logs of past executions
- **Connectivity Testing**: Ping nodes to check connectivity
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

1. **Clone and setup**:
```bash
git clone <repository>
cd ansible-portal
chmod +x setup.sh
./setup.sh
