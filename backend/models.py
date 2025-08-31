from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class Node(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    hostname = db.Column(db.String(255), nullable=False)
    username = db.Column(db.String(100), nullable=False)
    port = db.Column(db.Integer, default=22)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='unknown')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Many-to-many relationship with groups
    groups = db.relationship('NodeGroup', secondary='node_group_members', back_populates='nodes')

class NodeGroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Many-to-many relationship with nodes
    nodes = db.relationship('Node', secondary='node_group_members', back_populates='groups')

# Association table for many-to-many relationship
node_group_members = db.Table('node_group_members',
    db.Column('node_id', db.Integer, db.ForeignKey('node.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('node_group.id'), primary_key=True)
)

class PlaybookExecution(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    playbooks = db.Column(db.Text, nullable=False)  # JSON array of playbook names
    target_nodes = db.Column(db.Text, nullable=False)  # JSON array of node IDs
    target_groups = db.Column(db.Text)  # JSON array of group IDs
    status = db.Column(db.String(20), default='pending')
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    output = db.Column(db.Text)
    error_output = db.Column(db.Text)
    
    def get_playbooks(self):
        return json.loads(self.playbooks) if self.playbooks else []
    
    def set_playbooks(self, playbooks):
        self.playbooks = json.dumps(playbooks)
    
    def get_target_nodes(self):
        return json.loads(self.target_nodes) if self.target_nodes else []
    
    def set_target_nodes(self, nodes):
        self.target_nodes = json.dumps(nodes)
