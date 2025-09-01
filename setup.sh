#!/bin/bash

echo "Setting up Ansible Management Portal..."

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p data/playbooks
mkdir -p data/inventory
mkdir -p data/logs
mkdir -p data/ssh_keys

# Set proper permissions
chmod 755 data/playbooks
chmod 755 data/inventory
chmod 755 data/logs
chmod 700 data/ssh_keys

# Generate SSH key if it doesn't exist
if [ ! -f "data/ssh_keys/id_rsa" ]; then
    echo "Generating SSH key for Ansible..."
    ssh-keygen -t rsa -b 4096 -f data/ssh_keys/id_rsa -N "" -C "ansible-portal"
    chmod 600 data/ssh_keys/id_rsa
    chmod 644 data/ssh_keys/id_rsa.pub
    
    echo ""
    echo "SSH public key generated. Add this to your target machines:"
    echo "----------------------------------------"
    cat data/ssh_keys/id_rsa.pub
    echo "----------------------------------------"
fi

# Create sample playbooks
echo "Creating sample playbooks..."

cat > data/playbooks/ping-test.yml << 'EOF'
---
- name: Simple ping test
  hosts: all
  gather_facts: no
  
  tasks:
    - name: Ping test
      ping:
EOF

cat > data/playbooks/system-info.yml << 'EOF'
---
- name: Gather system information
  hosts: all
  gather_facts: yes
  
  tasks:
    - name: Display system info
      debug:
        msg: |
          Hostname: {{ ansible_hostname }}
          OS: {{ ansible_distribution }} {{ ansible_distribution_version }}
          Architecture: {{ ansible_architecture }}
          Memory: {{ ansible_memtotal_mb }}MB
          CPU Cores: {{ ansible_processor_vcpus }}
EOF

cat > data/playbooks/update-system.yml << 'EOF'
---
- name: Update system packages
  hosts: all
  become: yes
  gather_facts: yes
  
  tasks:
    - name: Update apt cache (Ubuntu/Debian)
      apt:
        update_cache: yes
        cache_valid_time: 3600
      when: ansible_os_family == "Debian"
    
    - name: Upgrade all packages (Ubuntu/Debian)
      apt:
        upgrade: safe
      when: ansible_os_family == "Debian"
    
    - name: Update yum packages (RedHat/CentOS)
      yum:
        name: "*"
        state: latest
      when: ansible_os_family == "RedHat"
EOF

echo "Sample playbooks created in data/playbooks/"

# Stop any existing containers
echo "Stopping existing containers..."
docker-compose down

# Build and start services
echo "Building and starting services..."
docker-compose build --no-cache
docker-compose up -d

echo "Waiting for services to start..."
sleep 30

# Check service health
echo "Checking service status..."
docker-compose ps

echo ""
echo "Setup complete!"
echo ""
echo "Access the portal at: http://localhost"
echo ""
echo "To add the SSH key to target machines, run:"
echo "ssh-copy-id -i data/ssh_keys/id_rsa.pub user@target-machine"
echo ""
echo "Or manually add this public key to ~/.ssh/authorized_keys on target machines:"
if [ -f "data/ssh_keys/id_rsa.pub" ]; then
    cat data/ssh_keys/id_rsa.pub
fi
echo ""
echo "Troubleshooting:"
echo "- View logs: docker-compose logs [service-name]"
echo "- Restart services: docker-compose restart"
echo "- Stop services: docker-compose down"
