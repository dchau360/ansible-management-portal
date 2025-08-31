from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import threading
from datetime import datetime

from config import Config
from models import db, Node, NodeGroup, PlaybookExecution
from ansible_runner import AnsibleManager

app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")
db.init_app(app)

# Initialize Ansible manager
ansible_manager = AnsibleManager()

# Create tables
with app.app_context():
    db.create_all()

# API Routes

@app.route('/api/playbooks', methods=['GET'])
def get_playbooks():
    """Get list of available playbooks"""
    playbooks = ansible_manager.get_playbooks()
    return jsonify(playbooks)

@app.route('/api/playbooks/<filename>', methods=['GET'])
def get_playbook_content(filename):
    """Get playbook content"""
    playbook_path = os.path.join(Config.PLAYBOOKS_DIR, filename)
    if os.path.exists(playbook_path):
        with open(playbook_path, 'r') as f:
            content = f.read()
        return jsonify({'content': content})
    return jsonify({'error': 'Playbook not found'}), 404

@app.route('/api/nodes', methods=['GET', 'POST'])
def handle_nodes():
    if request.method == 'GET':
        nodes = Node.query.all()
        return jsonify([{
            'id': node.id,
            'name': node.name,
            'hostname': node.hostname,
            'username': node.username,
            'port': node.port,
            'description': node.description,
            'status': node.status,
            'created_at': node.created_at.isoformat(),
            'groups': [{'id': g.id, 'name': g.name} for g in node.groups]
        } for node in nodes])
    
    elif request.method == 'POST':
        data = request.json
        node = Node(
            name=data['name'],
            hostname=data['hostname'],
            username=data['username'],
            port=data.get('port', 22),
            description=data.get('description', '')
        )
        db.session.add(node)
        db.session.commit()
        return jsonify({'message': 'Node created successfully', 'id': node.id})

@app.route('/api/nodes/<int:node_id>', methods=['PUT', 'DELETE'])
def handle_node(node_id):
    node = Node.query.get_or_404(node_id)
    
    if request.method == 'PUT':
        data = request.json
        node.name = data.get('name', node.name)
        node.hostname = data.get('hostname', node.hostname)
        node.username = data.get('username', node.username)
        node.port = data.get('port', node.port)
        node.description = data.get('description', node.description)
        db.session.commit()
        return jsonify({'message': 'Node updated successfully'})
    
    elif request.method == 'DELETE':
        db.session.delete(node)
        db.session.commit()
        return jsonify({'message': 'Node deleted successfully'})

@app.route('/api/groups', methods=['GET', 'POST'])
def handle_groups():
    if request.method == 'GET':
        groups = NodeGroup.query.all()
        return jsonify([{
            'id': group.id,
            'name': group.name,
            'description': group.description,
            'created_at': group.created_at.isoformat(),
            'nodes': [{'id': n.id, 'name': n.name} for n in group.nodes]
        } for group in groups])
    
    elif request.method == 'POST':
        data = request.json
        group = NodeGroup(
            name=data['name'],
            description=data.get('description', '')
        )
        
        # Add nodes to group
        if 'node_ids' in data:
            nodes = Node.query.filter(Node.id.in_(data['node_ids'])).all()
            group.nodes = nodes
        
        db.session.add(group)
        db.session.commit()
        return jsonify({'message': 'Group created successfully', 'id': group.id})

@app.route('/api/groups/<int:group_id>', methods=['PUT', 'DELETE'])
def handle_group(group_id):
    group = NodeGroup.query.get_or_404(group_id)
    
    if request.method == 'PUT':
        data = request.json
        group.name = data.get('name', group.name)
        group.description = data.get('description', group.description)
        
        # Update nodes in group
        if 'node_ids' in data:
            nodes = Node.query.filter(Node.id.in_(data['node_ids'])).all()
            group.nodes = nodes
        
        db.session.commit()
        return jsonify({'message': 'Group updated successfully'})
    
    elif request.method == 'DELETE':
        db.session.delete(group)
        db.session.commit()
        return jsonify({'message': 'Group deleted successfully'})

@app.route('/api/execute', methods=['POST'])
def execute_playbooks():
    """Execute playbooks on nodes/groups"""
    data = request.json
    playbooks = data.get('playbooks', [])
    node_ids = data.get('node_ids', [])
    group_ids = data.get('group_ids', [])
    
    if not playbooks:
        return jsonify({'error': 'No playbooks specified'}), 400
    
    if not node_ids and not group_ids:
        return jsonify({'error': 'No targets specified'}), 400
    
    # Execute in background thread
    def run_execution():
        execution_id = ansible_manager.execute_playbooks(playbooks, node_ids, group_ids)
        socketio.emit('execution_completed', {'execution_id': execution_id})
    
    thread = threading.Thread(target=run_execution)
    thread.start()
    
    return jsonify({'message': 'Execution started'})

@app.route('/api/ping', methods=['POST'])
def ping_nodes():
    """Ping nodes to check connectivity"""
    data = request.json
    node_ids = data.get('node_ids', [])
    
    if not node_ids:
        return jsonify({'error': 'No nodes specified'}), 400
    
    results = ansible_manager.ping_nodes(node_ids)
    return jsonify(results)

@app.route('/api/executions', methods=['GET'])
def get_executions():
    """Get execution history"""
    executions = PlaybookExecution.query.order_by(PlaybookExecution.started_at.desc()).limit(50).all()
    return jsonify([{
        'id': ex.id,
        'playbooks': ex.get_playbooks(),
        'target_nodes': ex.get_target_nodes(),
        'status': ex.status,
        'started_at': ex.started_at.isoformat(),
        'completed_at': ex.completed_at.isoformat() if ex.completed_at else None,
        'output': ex.output,
        'error_output': ex.error_output
    } for ex in executions])

@app.route('/api/executions/<int:execution_id>', methods=['GET'])
def get_execution(execution_id):
    """Get specific execution details"""
    execution = PlaybookExecution.query.get_or_404(execution_id)
    return jsonify({
        'id': execution.id,
        'playbooks': execution.get_playbooks(),
        'target_nodes': execution.get_target_nodes(),
        'status': execution.status,
        'started_at': execution.started_at.isoformat(),
        'completed_at': execution.completed_at.isoformat() if execution.completed_at else None,
        'output': execution.output,
        'error_output': execution.error_output
    })

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
