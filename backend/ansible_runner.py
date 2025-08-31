import os
import json
import subprocess
import tempfile
from datetime import datetime
from models import db, Node, NodeGroup, PlaybookExecution
from config import Config

class AnsibleManager:
    def __init__(self):
        self.playbooks_dir = Config.PLAYBOOKS_DIR
        self.inventory_dir = Config.INVENTORY_DIR
        self.logs_dir = Config.LOGS_DIR
    
    def get_playbooks(self):
        """Get list of available playbooks"""
        playbooks = []
        if os.path.exists(self.playbooks_dir):
            for file in os.listdir(self.playbooks_dir):
                if file.endswith('.yml') or file.endswith('.yaml'):
                    playbooks.append({
                        'name': file,
                        'path': os.path.join(self.playbooks_dir, file),
                        'size': os.path.getsize(os.path.join(self.playbooks_dir, file)),
                        'modified': datetime.fromtimestamp(
                            os.path.getmtime(os.path.join(self.playbooks_dir, file))
                        ).isoformat()
                    })
        return playbooks
    
    def create_inventory(self, nodes, groups=None):
        """Create temporary inventory file for execution"""
        inventory = {}
        
        # Add individual nodes
        if nodes:
            inventory['ungrouped'] = {'hosts': {}}
            for node in nodes:
                inventory['ungrouped']['hosts'][node.name] = {
                    'ansible_host': node.hostname,
                    'ansible_user': node.username,
                    'ansible_port': node.port
                }
        
        # Add groups
        if groups:
            for group in groups:
                inventory[group.name] = {'hosts': {}}
                for node in group.nodes:
                    inventory[group.name]['hosts'][node.name] = {
                        'ansible_host': node.hostname,
                        'ansible_user': node.username,
                        'ansible_port': node.port
                    }
        
        # Write to temporary file
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False)
        import yaml
        yaml.dump(inventory, temp_file, default_flow_style=False)
        temp_file.close()
        
        return temp_file.name
    
    def execute_playbooks(self, playbook_names, node_ids=None, group_ids=None):
        """Execute playbooks on specified nodes/groups"""
        
        # Create execution record
        execution = PlaybookExecution(
            playbooks=json.dumps(playbook_names),
            target_nodes=json.dumps(node_ids or []),
            target_groups=json.dumps(group_ids or []),
            status='running'
        )
        db.session.add(execution)
        db.session.commit()
        
        try:
            # Get target nodes and groups
            nodes = Node.query.filter(Node.id.in_(node_ids)).all() if node_ids else []
            groups = NodeGroup.query.filter(NodeGroup.id.in_(group_ids)).all() if group_ids else []
            
            # Create inventory
            inventory_file = self.create_inventory(nodes, groups)
            
            # Execute each playbook
            all_output = []
            all_errors = []
            
            for playbook_name in playbook_names:
                playbook_path = os.path.join(self.playbooks_dir, playbook_name)
                
                if not os.path.exists(playbook_path):
                    error_msg = f"Playbook {playbook_name} not found"
                    all_errors.append(error_msg)
                    continue
                
                # Run ansible-playbook command
                cmd = [
                    'ansible-playbook',
                    '-i', inventory_file,
                    playbook_path,
                    '--ssh-common-args="-o StrictHostKeyChecking=no"'
                ]
                
                try:
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=3600  # 1 hour timeout
                    )
                    
                    all_output.append(f"=== Playbook: {playbook_name} ===\n{result.stdout}")
                    if result.stderr:
                        all_errors.append(f"=== Playbook: {playbook_name} ===\n{result.stderr}")
                        
                except subprocess.TimeoutExpired:
                    error_msg = f"Playbook {playbook_name} timed out"
                    all_errors.append(error_msg)
                except Exception as e:
                    error_msg = f"Error executing {playbook_name}: {str(e)}"
                    all_errors.append(error_msg)
            
            # Clean up inventory file
            os.unlink(inventory_file)
            
            # Update execution record
            execution.status = 'completed' if not all_errors else 'failed'
            execution.completed_at = datetime.utcnow()
            execution.output = '\n'.join(all_output)
            execution.error_output = '\n'.join(all_errors) if all_errors else None
            
        except Exception as e:
            execution.status = 'failed'
            execution.completed_at = datetime.utcnow()
            execution.error_output = str(e)
        
        db.session.commit()
        return execution.id
    
    def ping_nodes(self, node_ids):
        """Ping nodes to check connectivity"""
        nodes = Node.query.filter(Node.id.in_(node_ids)).all()
        results = {}
        
        for node in nodes:
            cmd = [
                'ansible',
                node.hostname,
                '-m', 'ping',
                '-u', node.username,
                '--ssh-common-args="-o StrictHostKeyChecking=no"'
            ]
            
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                results[node.id] = {
                    'status': 'success' if result.returncode == 0 else 'failed',
                    'output': result.stdout,
                    'error': result.stderr
                }
                
                # Update node status
                node.status = 'online' if result.returncode == 0 else 'offline'
                
            except subprocess.TimeoutExpired:
                results[node.id] = {
                    'status': 'timeout',
                    'error': 'Connection timed out'
                }
                node.status = 'timeout'
            except Exception as e:
                results[node.id] = {
                    'status': 'error',
                    'error': str(e)
                }
                node.status = 'error'
        
        db.session.commit()
        return results
