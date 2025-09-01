#!/bin/bash

echo "Setting up Ansible Management Portal..."

# Check if Docker Compose is available (V2 or V1)
if command -v "docker compose" &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v "docker-compose" &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "Using: $DOCKER_COMPOSE"

# Create necessary directories
mkdir -p data/playbooks
mkdir -p data/inventory
mkdir -p data/logs

# Set proper permissions
chmod 755 data/playbooks
chmod 755 data/inventory
chmod 755 data/logs

# Create sample playbooks if they don't exist
if [ ! -f "data/playbooks/update-system.yml" ]; then
    echo "Creating sample playbooks..."
    
    cat > data/playbooks/update-system.yml << 'EOF'
---
- name: Update system packages
  hosts: all
  become: yes
  
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

    cat > data/playbooks/install-docker.yml << 'EOF'
---
- name: Install Docker
  hosts: all
  become: yes
  
  tasks:
    - name: Install required packages
      package:
        name:
          - apt-transport-https
          - ca-certificates
          - curl
          - software-properties-common
        state: present
      when: ansible_os_family == "Debian"
    
    - name: Add Docker GPG key
      apt_key:
        url: https://download.docker.com/linux/ubuntu/gpg
        state: present
      when: ansible_os_family == "Debian"
    
    - name: Add Docker repository
      apt_repository:
        repo: "deb [arch=amd64] https://download.docker.com/linux/ubuntu {{ ansible_distribution_release }} stable"
        state: present
      when: ansible_os_family == "Debian"
    
    - name: Install Docker
      package:
        name: docker-ce
        state: present
    
    - name: Start and enable Docker
      systemd:
        name: docker
        state: started
        enabled: yes
    
    - name: Add user to docker group
      user:
        name: "{{ ansible_user }}"
        groups: docker
        append: yes
EOF

    cat > data/playbooks/setup-monitoring.yml << 'EOF'
---
- name: Setup basic monitoring
  hosts: all
  become: yes
  
  tasks:
    - name: Install monitoring tools
      package:
        name:
          - htop
          - iotop
          - nethogs
          - ncdu
          - tree
        state: present
    
    - name: Create monitoring script directory
      file:
        path: /opt/monitoring
        state: directory
        mode: '0755'
    
    - name: Create system info script
      copy:
        content: |
          #!/bin/bash
          echo "=== System Information ==="
          echo "Hostname: $(hostname)"
          echo "Uptime: $(uptime)"
          echo "Load Average: $(cat /proc/loadavg)"
          echo "Memory Usage:"
          free -h
          echo "Disk Usage:"
          df -h
          echo "Top Processes:"
          ps aux --sort=-%cpu | head -10
        dest: /opt/monitoring/sysinfo.sh
        mode: '0755'
    
    - name: Add monitoring cron job
      cron:
        name: "System monitoring"
        minute: "*/15"
        job: "/opt/monitoring/sysinfo.sh >> /var/log/sysmon.log"
EOF

    echo "Sample playbooks created."
fi

# Generate SSH key if it doesn't exist
if [ ! -f "data/ssh_key" ]; then
    echo "Generating SSH key for Ansible..."
    ssh-keygen -t rsa -b 4096 -f data/ssh_key -N "" -C "ansible-portal"
    chmod 600 data/ssh_key
    chmod 644 data/ssh_key.pub
    
    echo ""
    echo "SSH public key generated. Add this to your target machines:"
    echo "----------------------------------------"
    cat data/ssh_key.pub
    echo "----------------------------------------"
fi

echo ""
echo "Building and starting services..."
$DOCKER_COMPOSE build
$DOCKER_COMPOSE up -d

echo ""
echo "Waiting for services to start..."
sleep 15

echo ""
echo "Checking service status..."
$DOCKER_COMPOSE ps

echo ""
echo "Setup complete!"
echo ""
echo "Access the portal at: http://localhost"
echo ""
echo "To add the SSH key to target machines, run:"
echo "ssh-copy-id -i data/ssh_key.pub user@target-machine"
echo ""
echo "Or manually add this public key to ~/.ssh/authorized_keys on target machines:"
if [ -f "data/ssh_key.pub" ]; then
    cat data/ssh_key.pub
fi
echo ""
echo "Useful commands:"
echo "  View logs: $DOCKER_COMPOSE logs"
echo "  Stop services: $DOCKER_COMPOSE down"
echo "  Restart services: $DOCKER_COMPOSE restart"
echo "  View service status: $DOCKER_COMPOSE ps"
