import './style.css';
import axios from 'axios';
import io from 'socket.io-client';

class AnsiblePortal {
    constructor() {
        this.apiUrl = 'http://localhost:5000/api';
        this.socket = io('http://localhost:5000');
        this.selectedPlaybooks = new Set();
        this.selectedTargets = new Set();
        this.targetType = 'nodes'; // 'nodes' or 'groups'
        this.currentEditingNode = null;
        this.currentEditingGroup = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupSocketEvents();
        this.loadInitialData();
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Playbooks section
        document.getElementById('refreshPlaybooks').addEventListener('click', () => {
            this.loadPlaybooks();
        });
        
        document.getElementById('executeSelected').addEventListener('click', () => {
            this.executeSelectedPlaybooks();
        });
        
        // Target selection tabs
        document.getElementById('nodesTargetTab').addEventListener('click', () => {
            this.switchTargetType('nodes');
        });
        
        document.getElementById('groupsTargetTab').addEventListener('click', () => {
            this.switchTargetType('groups');
        });
        
        // Nodes section
        document.getElementById('addNode').addEventListener('click', () => {
            this.showNodeModal();
        });
        
        document.getElementById('pingSelected').addEventListener('click', () => {
            this.pingSelectedNodes();
        });
        
        // Groups section
        document.getElementById('addGroup').addEventListener('click', () => {
            this.showGroupModal();
        });
        
        // Executions section
        document.getElementById('refreshExecutions').addEventListener('click', () => {
            this.loadExecutions();
        });
        
        // Modal event listeners
        this.setupModalEventListeners();
        
        // Context menu
        document.addEventListener('click', (e) => {
            this.hideContextMenu();
        });
        
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.node-card') || e.target.closest('.group-card')) {
                e.preventDefault();
                this.showContextMenu(e);
            }
        });
    }
    
    setupSocketEvents() {
        this.socket.on('execution_completed', (data) => {
            this.showNotification('Execution completed', 'success');
            this.loadExecutions();
        });
        
        this.socket.on('execution_failed', (data) => {
            this.showNotification('Execution failed', 'error');
            this.loadExecutions();
        });
    }
    
    setupModalEventListeners() {
        // Node modal
        document.getElementById('closeNodeModal').addEventListener('click', () => {
            this.hideNodeModal();
        });
        
        document.getElementById('cancelNode').addEventListener('click', () => {
            this.hideNodeModal();
        });
        
        document.getElementById('nodeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNode();
        });
        
        // Group modal
        document.getElementById('closeGroupModal').addEventListener('click', () => {
            this.hideGroupModal();
        });
        
        document.getElementById('cancelGroup').addEventListener('click', () => {
            this.hideGroupModal();
        });
        
        document.getElementById('groupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveGroup();
        });
        
        // Execution modal
        document.getElementById('closeExecutionModal').addEventListener('click', () => {
            this.hideExecutionModal();
        });
        
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
            }
        });
    }
    
    async loadInitialData() {
        await Promise.all([
            this.loadPlaybooks(),
            this.loadNodes(),
            this.loadGroups(),
            this.loadExecutions()
        ]);
        
        this.loadTargets();
    }
    
    switchTab(tabName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${tabName}Section`).classList.add('active');
        
        // Load data if needed
        switch(tabName) {
            case 'playbooks':
                this.loadPlaybooks();
                this.loadTargets();
                break;
            case 'nodes':
                this.loadNodes();
                break;
            case 'groups':
                this.loadGroups();
                break;
            case 'executions':
                this.loadExecutions();
                break;
        }
    }
    
    switchTargetType(type) {
        this.targetType = type;
        
        // Update tabs
        document.querySelectorAll('.target-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${type}TargetTab`).classList.add('active');
        
        // Update lists
        document.getElementById('nodesTargetList').classList.toggle('hidden', type !== 'nodes');
        document.getElementById('groupsTargetList').classList.toggle('hidden', type !== 'groups');
        
        this.selectedTargets.clear();
        this.updateExecuteButton();
    }
    
    async loadPlaybooks() {
        try {
            const response = await axios.get(`${this.apiUrl}/playbooks`);
            this.renderPlaybooks(response.data);
        } catch (error) {
            this.showNotification('Failed to load playbooks', 'error');
            console.error('Error loading playbooks:', error);
        }
    }
    
    renderPlaybooks(playbooks) {
        const container = document.getElementById('playbooksList');
        
        if (playbooks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-play-circle"></i>
                    <h3>No Playbooks Found</h3>
                    <p>Add some Ansible playbooks to the playbooks directory</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = playbooks.map(playbook => `
            <div class="playbook-item" data-playbook="${playbook.name}">
                <h4><i class="fas fa-play"></i> ${playbook.name}</h4>
                <div class="meta">
                    <span><i class="fas fa-weight"></i> ${this.formatFileSize(playbook.size)}</span>
                    <span><i class="fas fa-clock"></i> ${this.formatDate(playbook.modified)}</span>
                </div>
            </div>
        `).join('');
        
        // Add click event listeners
        container.querySelectorAll('.playbook-item').forEach(item => {
            item.addEventListener('click', () => {
                this.togglePlaybookSelection(item.dataset.playbook);
                item.classList.toggle('selected');
                this.updateExecuteButton();
            });
        });
    }
    
    togglePlaybookSelection(playbookName) {
        if (this.selectedPlaybooks.has(playbookName)) {
            this.selectedPlaybooks.delete(playbookName);
        } else {
            this.selectedPlaybooks.add(playbookName);
        }
    }
    
    async loadNodes() {
        try {
            const response = await axios.get(`${this.apiUrl}/nodes`);
            this.renderNodes(response.data);
            this.nodes = response.data; // Store for use in group modal
        } catch (error) {
            this.showNotification('Failed to load nodes', 'error');
            console.error('Error loading nodes:', error);
        }
    }
    
    renderNodes(nodes) {
        const container = document.getElementById('nodesList');
        
        if (nodes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-server"></i>
                    <h3>No Nodes Found</h3>
                    <p>Add some nodes to get started</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = nodes.map(node => `
            <div class="node-card" data-node-id="${node.id}">
                <h3>
                    <i class="fas fa-server"></i>
                    ${node.name}
                    <span class="status ${node.status}">${node.status}</span>
                </h3>
                <div class="details">
                    <div><strong>Host:</strong> ${node.hostname}:${node.port}</div>
                    <div><strong>User:</strong> ${node.username}</div>
                    ${node.description ? `<div><strong>Description:</strong> ${node.description}</div>` : ''}
                    <div><strong>Groups:</strong> ${node.groups.map(g => g.name).join(', ') || 'None'}</div>
                </div>
                <div class="actions">
                    <button class="btn btn-secondary btn-sm ping-node" data-node-id="${node.id}">
                        <i class="fas fa-satellite-dish"></i> Ping
                    </button>
                    <button class="btn btn-primary btn-sm edit-node" data-node-id="${node.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm delete-node" data-node-id="${node.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
        
        this.setupNodeEventListeners();
    }
    
    setupNodeEventListeners() {
        // Ping buttons
        document.querySelectorAll('.ping-node').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.pingNode([parseInt(e.target.dataset.nodeId)]);
            });
        });
        
        // Edit buttons
        document.querySelectorAll('.edit-node').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editNode(parseInt(e.target.dataset.nodeId));
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.delete-node').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteNode(parseInt(e.target.dataset.nodeId));
            });
        });
    }
    
    async loadGroups() {
        try {
            const response = await axios.get(`${this.apiUrl}/groups`);
            this.renderGroups(response.data);
            this.groups = response.data; // Store for reference
        } catch (error) {
            this.showNotification('Failed to load groups', 'error');
            console.error('Error loading groups:', error);
        }
    }
    
    renderGroups(groups) {
        const container = document.getElementById('groupsList');
        
        if (groups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-layer-group"></i>
                    <h3>No Groups Found</h3>
                    <p>Create some groups to organize your nodes</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = groups.map(group => `
            <div class="group-card" data-group-id="${group.id}">
                <h3>
                    <i class="fas fa-layer-group"></i>
                    ${group.name}
                </h3>
                <div class="details">
                    ${group.description ? `<div><strong>Description:</strong> ${group.description}</div>` : ''}
                    <div><strong>Nodes:</strong> ${group.nodes.length}</div>
                    <div><strong>Members:</strong> ${group.nodes.map(n => n.name).join(', ') || 'None'}</div>
                </div>
                <div class="actions">
                    <button class="btn btn-primary btn-sm edit-group" data-group-id="${group.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm delete-group" data-group-id="${group.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
        
        this.setupGroupEventListeners();
    }
    
    setupGroupEventListeners() {
        // Edit buttons
        document.querySelectorAll('.edit-group').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editGroup(parseInt(e.target.dataset.groupId));
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.delete-group').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteGroup(parseInt(e.target.dataset.groupId));
            });
        });
    }
    
    loadTargets() {
        this.loadTargetNodes();
        this.loadTargetGroups();
    }
    
    loadTargetNodes() {
        if (!this.nodes) return;
        
        const container = document.getElementById('nodesTargetList');
        
        if (this.nodes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-server"></i>
                    <h3>No Nodes Available</h3>
                    <p>Add some nodes first</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.nodes.map(node => `
            <div class="target-item">
                <input type="checkbox" id="node-${node.id}" data-type="node" data-id="${node.id}">
                <div class="info">
                    <div class="name">${node.name}</div>
                    <div class="details">${node.hostname} (${node.status})</div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateTargetSelection();
            });
        });
    }
    
    loadTargetGroups() {
        if (!this.groups) return;
        
        const container = document.getElementById('groupsTargetList');
        
        if (this.groups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-layer-group"></i>
                    <h3>No Groups Available</h3>
                    <p>Create some groups first</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.groups.map(group => `
            <div class="target-item">
                <input type="checkbox" id="group-${group.id}" data-type="group" data-id="${group.id}">
                <div class="info">
                    <div class="name">${group.name}</div>
                    <div class="details">${group.nodes.length} nodes</div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateTargetSelection();
            });
        });
    }
    
    updateTargetSelection() {
        this.selectedTargets.clear();
        
        const activeContainer = this.targetType === 'nodes' ? 
            document.getElementById('nodesTargetList') : 
            document.getElementById('groupsTargetList');
        
        activeContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            this.selectedTargets.add({
                type: checkbox.dataset.type,
                id: parseInt(checkbox.dataset.id)
            });
        });
        
        this.updateExecuteButton();
    }
    
    updateExecuteButton() {
        const executeBtn = document.getElementById('executeSelected');
        const hasPlaybooks = this.selectedPlaybooks.size > 0;
        const hasTargets = this.selectedTargets.size > 0;
        
        executeBtn.disabled = !hasPlaybooks || !hasTargets;
        
        if (hasPlaybooks && hasTargets) {
            executeBtn.textContent = `Execute ${this.selectedPlaybooks.size} playbook(s) on ${this.selectedTargets.size} target(s)`;
        } else {
            executeBtn.textContent = 'Execute Selected';
        }
    }
    
    async executeSelectedPlaybooks() {
        if (this.selectedPlaybooks.size === 0 || this.selectedTargets.size === 0) {
            this.showNotification('Please select playbooks and targets', 'warning');
            return;
        }
        
        const playbooks = Array.from(this.selectedPlaybooks);
        const nodeIds = [];
        const groupIds = [];
        
        this.selectedTargets.forEach(target => {
            if (target.type === 'node') {
                nodeIds.push(target.id);
            } else {
                groupIds.push(target.id);
            }
        });
        
        try {
            await axios.post(`${this.apiUrl}/execute`, {
                playbooks,
                node_ids: nodeIds,
                group_ids: groupIds
            });
            
            this.showNotification('Execution started successfully', 'success');
            
            // Clear selections
            this.selectedPlaybooks.clear();
            this.selectedTargets.clear();
            
            // Update UI
            document.querySelectorAll('.playbook-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            this.updateExecuteButton();
            
        } catch (error) {
            this.showNotification('Failed to start execution', 'error');
            console.error('Error executing playbooks:', error);
        }
    }
    
    async pingNode(nodeIds) {
        try {
            const response = await axios.post(`${this.apiUrl}/ping`, {
                node_ids: nodeIds
            });
            
            // Update node status in UI
            Object.entries(response.data).forEach(([nodeId, result]) => {
                const nodeCard = document.querySelector(`[data-node-id="${nodeId}"]`);
                if (nodeCard) {
                    const statusSpan = nodeCard.querySelector('.status');
                    statusSpan.textContent = result.status;
                    statusSpan.className = `status ${result.status}`;
                }
            });
            
            this.showNotification('Ping completed', 'success');
            
        } catch (error) {
            this.showNotification('Failed to ping nodes', 'error');
            console.error('Error pinging nodes:', error);
        }
    }
    
    pingSelectedNodes() {
        const selectedNodes = [];
        document.querySelectorAll('.node-card input[type="checkbox"]:checked').forEach(checkbox => {
            selectedNodes.push(parseInt(checkbox.dataset.nodeId));
        });
        
        if (selectedNodes.length === 0) {
            this.showNotification('Please select nodes to ping', 'warning');
            return;
        }
        
        this.pingNode(selectedNodes);
    }
    
    showNodeModal(node = null) {
        this.currentEditingNode = node;
        const modal = document.getElementById('nodeModal');
        const title = document.getElementById('nodeModalTitle');
        
        if (node) {
            title.textContent = 'Edit Node';
            document.getElementById('nodeName').value = node.name;
            document.getElementById('nodeHostname').value = node.hostname;
            document.getElementById('nodeUsername').value = node.username;
            document.getElementById('nodePort').value = node.port;
            document.getElementById('nodeDescription').value = node.description || '';
        } else {
            title.textContent = 'Add Node';
            document.getElementById('nodeForm').reset();
            document.getElementById('nodePort').value = 22;
        }
        
        modal.classList.add('show');
    }
    
    hideNodeModal() {
        document.getElementById('nodeModal').classList.remove('show');
        this.currentEditingNode = null;
    }
    
    async saveNode() {
        const formData = {
            name: document.getElementById('nodeName').value,
            hostname: document.getElementById('nodeHostname').value,
            username: document.getElementById('nodeUsername').value,
            port: parseInt(document.getElementById('nodePort').value),
            description: document.getElementById('nodeDescription').value
        };
        
        try {
            if (this.currentEditingNode) {
                await axios.put(`${this.apiUrl}/nodes/${this.currentEditingNode.id}`, formData);
                this.showNotification('Node updated successfully', 'success');
            } else {
                await axios.post(`${this.apiUrl}/nodes`, formData);
                this.showNotification('Node created successfully', 'success');
            }
            
            this.hideNodeModal();
            this.loadNodes();
            this.loadTargets();
            
        } catch (error) {
            this.showNotification('Failed to save node', 'error');
            console.error('Error saving node:', error);
        }
    }
    
    editNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            this.showNodeModal(node);
        }
    }
    
async deleteNode(nodeId) {
        if (!confirm('Are you sure you want to delete this node?')) {
            return;
        }
        
        try {
            await axios.delete(`${this.apiUrl}/nodes/${nodeId}`);
            this.showNotification('Node deleted successfully', 'success');
            this.loadNodes();
            this.loadTargets();
        } catch (error) {
            this.showNotification('Failed to delete node', 'error');
            console.error('Error deleting node:', error);
        }
    }
    
    showGroupModal(group = null) {
        this.currentEditingGroup = group;
        const modal = document.getElementById('groupModal');
        const title = document.getElementById('groupModalTitle');
        
        // Load available nodes for selection
        this.loadGroupNodesSelection();
        
        if (group) {
            title.textContent = 'Edit Group';
            document.getElementById('groupName').value = group.name;
            document.getElementById('groupDescription').value = group.description || '';
            
            // Select current group nodes
            setTimeout(() => {
                group.nodes.forEach(node => {
                    const checkbox = document.getElementById(`groupNode-${node.id}`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }, 100);
        } else {
            title.textContent = 'Add Group';
            document.getElementById('groupForm').reset();
        }
        
        modal.classList.add('show');
    }
    
    hideGroupModal() {
        document.getElementById('groupModal').classList.remove('show');
        this.currentEditingGroup = null;
    }
    
    loadGroupNodesSelection() {
        const container = document.getElementById('groupNodesList');
        
        if (!this.nodes || this.nodes.length === 0) {
            container.innerHTML = '<p>No nodes available</p>';
            return;
        }
        
        container.innerHTML = this.nodes.map(node => `
            <label>
                <input type="checkbox" id="groupNode-${node.id}" value="${node.id}">
                ${node.name} (${node.hostname})
            </label>
        `).join('');
    }
    
    async saveGroup() {
        const formData = {
            name: document.getElementById('groupName').value,
            description: document.getElementById('groupDescription').value,
            node_ids: Array.from(document.querySelectorAll('#groupNodesList input[type="checkbox"]:checked'))
                .map(checkbox => parseInt(checkbox.value))
        };
        
        try {
            if (this.currentEditingGroup) {
                await axios.put(`${this.apiUrl}/groups/${this.currentEditingGroup.id}`, formData);
                this.showNotification('Group updated successfully', 'success');
            } else {
                await axios.post(`${this.apiUrl}/groups`, formData);
                this.showNotification('Group created successfully', 'success');
            }
            
            this.hideGroupModal();
            this.loadGroups();
            this.loadTargets();
            
        } catch (error) {
            this.showNotification('Failed to save group', 'error');
            console.error('Error saving group:', error);
        }
    }
    
    editGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            this.showGroupModal(group);
        }
    }
    
    async deleteGroup(groupId) {
        if (!confirm('Are you sure you want to delete this group?')) {
            return;
        }
        
        try {
            await axios.delete(`${this.apiUrl}/groups/${groupId}`);
            this.showNotification('Group deleted successfully', 'success');
            this.loadGroups();
            this.loadTargets();
        } catch (error) {
            this.showNotification('Failed to delete group', 'error');
            console.error('Error deleting group:', error);
        }
    }
    
    async loadExecutions() {
        try {
            const response = await axios.get(`${this.apiUrl}/executions`);
            this.renderExecutions(response.data);
        } catch (error) {
            this.showNotification('Failed to load executions', 'error');
            console.error('Error loading executions:', error);
        }
    }
    
    renderExecutions(executions) {
        const container = document.getElementById('executionsList');
        
        if (executions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No Executions Found</h3>
                    <p>Execute some playbooks to see history here</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = executions.map(execution => `
            <div class="execution-item" data-execution-id="${execution.id}">
                <div class="header">
                    <h4>Execution #${execution.id}</h4>
                    <span class="status-badge ${execution.status}">${execution.status}</span>
                </div>
                <div class="playbooks">
                    <strong>Playbooks:</strong> ${execution.playbooks.join(', ')}
                </div>
                <div class="timestamp">
                    <i class="fas fa-clock"></i>
                    Started: ${this.formatDateTime(execution.started_at)}
                    ${execution.completed_at ? ` | Completed: ${this.formatDateTime(execution.completed_at)}` : ''}
                </div>
            </div>
        `).join('');
        
        // Add click event listeners
        container.querySelectorAll('.execution-item').forEach(item => {
            item.addEventListener('click', () => {
                this.showExecutionDetails(parseInt(item.dataset.executionId));
            });
        });
    }
    
    async showExecutionDetails(executionId) {
        try {
            const response = await axios.get(`${this.apiUrl}/executions/${executionId}`);
            const execution = response.data;
            
            const modal = document.getElementById('executionModal');
            const details = document.getElementById('executionDetails');
            
            details.innerHTML = `
                <div class="execution-info">
                    <h4>Execution #${execution.id}</h4>
                    <div><strong>Status:</strong> <span class="status-badge ${execution.status}">${execution.status}</span></div>
                    <div><strong>Playbooks:</strong> ${execution.playbooks.join(', ')}</div>
                    <div><strong>Started:</strong> ${this.formatDateTime(execution.started_at)}</div>
                    ${execution.completed_at ? `<div><strong>Completed:</strong> ${this.formatDateTime(execution.completed_at)}</div>` : ''}
                </div>
                
                ${execution.output ? `
                    <h4>Output:</h4>
                    <div class="execution-output">${execution.output}</div>
                ` : ''}
                
                ${execution.error_output ? `
                    <h4>Errors:</h4>
                    <div class="execution-error">${execution.error_output}</div>
                ` : ''}
            `;
            
            modal.classList.add('show');
            
        } catch (error) {
            this.showNotification('Failed to load execution details', 'error');
            console.error('Error loading execution details:', error);
        }
    }
    
    hideExecutionModal() {
        document.getElementById('executionModal').classList.remove('show');
    }
    
    showContextMenu(event) {
        const target = event.target.closest('.node-card, .group-card');
        if (!target) return;
        
        const isNode = target.classList.contains('node-card');
        const id = parseInt(target.dataset.nodeId || target.dataset.groupId);
        
        // Remove existing context menu
        this.hideContextMenu();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        
        if (isNode) {
            menu.innerHTML = `
                <div class="context-menu-item" data-action="ping" data-node-id="${id}">
                    <i class="fas fa-satellite-dish"></i> Ping Node
                </div>
                <div class="context-menu-item" data-action="edit" data-node-id="${id}">
                    <i class="fas fa-edit"></i> Edit Node
                </div>
                <div class="context-menu-item danger" data-action="delete" data-node-id="${id}">
                    <i class="fas fa-trash"></i> Delete Node
                </div>
            `;
        } else {
            menu.innerHTML = `
                <div class="context-menu-item" data-action="edit" data-group-id="${id}">
                    <i class="fas fa-edit"></i> Edit Group
                </div>
                <div class="context-menu-item danger" data-action="delete" data-group-id="${id}">
                    <i class="fas fa-trash"></i> Delete Group
                </div>
            `;
        }
        
        document.body.appendChild(menu);
        
        // Add event listeners
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleContextMenuAction(e.target.closest('.context-menu-item'));
                this.hideContextMenu();
            });
        });
        
        // Position menu within viewport
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (event.pageX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (event.pageY - rect.height) + 'px';
        }
    }
    
    hideContextMenu() {
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }
    
    handleContextMenuAction(item) {
        const action = item.dataset.action;
        const nodeId = item.dataset.nodeId;
        const groupId = item.dataset.groupId;
        
        switch (action) {
            case 'ping':
                this.pingNode([parseInt(nodeId)]);
                break;
            case 'edit':
                if (nodeId) {
                    this.editNode(parseInt(nodeId));
                } else if (groupId) {
                    this.editGroup(parseInt(groupId));
                }
                break;
            case 'delete':
                if (nodeId) {
                    this.deleteNode(parseInt(nodeId));
                } else if (groupId) {
                    this.deleteGroup(parseInt(groupId));
                }
                break;
        }
    }
    
    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        notifications.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Add click to dismiss
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
    
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
    
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AnsiblePortal();
});
