#!/bin/bash

set -e

echo "Setting up Ansible Management Portal..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Installing Docker..."
    
    # Update package index
    apt-get update
    
    # Install packages to allow apt to use a repository over HTTPS
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up the repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update package index again
    apt-get update
    
    # Install Docker Engine
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    print_success "Docker installed successfully"
else
    print_success "Docker is already installed"
fi

# Check Docker Compose (both V1 and V2)
DOCKER_COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
    print_success "Docker Compose V1 is available"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
    print_success "Docker Compose V2 is available"
else
    print_error "Docker Compose is not available. Installing Docker Compose plugin..."
    
    # Install Docker Compose plugin
    apt-get update
    apt-get install -y docker-compose-plugin
    
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
        print_success "Docker Compose plugin installed successfully"
    else
        print_error "Failed to install Docker Compose. Please install it manually."
        exit 1
    fi
fi

# Create necessary directories
print_status "Creating directory structure..."
mkdir -p data/playbooks
mkdir -p data/inventory
mkdir -p data/logs

# Set permissions
chmod 755 data
chmod 755 data/playbooks
chmod 755 data/inventory
chmod 755 data/logs

print_success "Directory structure created"

# Create sample playbook if none exist
if [ ! "$(ls -A data/playbooks)" ]; then
    print_status "Creating sample playbook..."
    
    cat > data/playbooks/sample-ping.yml << 'EOF'
---
- name: Sample Ping Playbook
  hosts: all
  gather_facts: yes
  tasks:
    - name: Ping all hosts
      ping:
      
    - name: Display hostname
      debug:
        msg: "Hello from {{ inventory_hostname }}"
        
    - name: Get system info
      debug:
        msg: "OS: {{ ansible_distribution }} {{ ansible_distribution_version }}"
EOF

    cat > data/playbooks/sample-system-u
