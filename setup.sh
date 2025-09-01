#!/bin/bash

echo "Setting up Ansible Management Portal..."

# Create necessary directories
mkdir -p data/playbooks
mkdir -p data/inventory
mkdir -p data/logs

# Set proper permissions
chmod 755 data/playbooks
chmod 755 data/inventory
chmod 755 data/logs

# Copy sample playbooks if they don't exist
if [ ! -f "data/playbooks/update-system.yml" ]; then
    echo "Copying sample playbooks..."
    # Sample playbooks will be created by docker-compose
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
docker-compose build
docker-compose up -d

echo ""
echo "Waiting for services to start..."
sleep 10

echo ""
echo "Setup complete!"
echo ""
echo "Access the portal at: http://localhost"
echo ""
echo "To add the SSH key to target machines, run:"
echo "ssh-copy-id -i data/ssh_key.pub user@target-machine"
echo ""
echo "Or manually add this public key to ~/.ssh/authorized_keys on target machines:"
cat data/ssh_key.pub 2>/dev/null || echo "SSH key will be generated on first run"
