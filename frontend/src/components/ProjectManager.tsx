import { Modal, List, Button, Input, Popconfirm } from 'antd';
import { Plus, Trash, FolderOpen, Check } from 'lucide-react';
import useStore from '../store/useStore';
import { useState } from 'react';

export default function ProjectManager({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { projects, currentProjectId, createProject, loadProject, deleteProject, renameProject } = useStore();
    const [newProjectName, setNewProjectName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleCreate = () => {
        if (!newProjectName.trim()) return;
        createProject(newProjectName);
        setNewProjectName('');
    };

    const startEdit = (id: string, name: string) => {
        setEditingId(id);
        setEditName(name);
    };

    const saveEdit = (id: string) => {
        if (editName.trim()) {
            renameProject(id, editName);
        }
        setEditingId(null);
    };

    return (
        <Modal 
            title="Project Management" 
            open={open} 
            onCancel={onClose} 
            footer={null}
            width={600}
            destroyOnClose
        >
            <div className="mb-6 flex gap-2">
                <Input 
                    placeholder="New Project Name" 
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    onPressEnter={handleCreate}
                />
                <Button type="primary" icon={<Plus size={16} />} onClick={handleCreate}>
                    Create
                </Button>
            </div>
            
            <List
                dataSource={projects.sort((a, b) => b.updatedAt - a.updatedAt)}
                renderItem={project => (
                    <List.Item
                        actions={[
                            <Button 
                                key="open"
                                type="text" 
                                icon={<FolderOpen size={16} />} 
                                onClick={() => { loadProject(project.id); onClose(); }}
                                className="text-cyan-600 hover:text-cyan-500"
                            >
                                Open
                            </Button>,
                            <Popconfirm 
                                key="delete"
                                title="Delete project?" 
                                description="This action cannot be undone."
                                onConfirm={() => deleteProject(project.id)}
                                okText="Delete"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true }}
                            >
                                <Button type="text" danger icon={<Trash size={16} />} disabled={projects.length <= 1 && project.id === currentProjectId} />
                            </Popconfirm>
                        ]}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors px-2 rounded ${project.id === currentProjectId ? 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800' : ''}`}
                    >
                        <List.Item.Meta
                            title={
                                editingId === project.id ? (
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            size="small" 
                                            value={editName} 
                                            onChange={e => setEditName(e.target.value)} 
                                            onPressEnter={() => saveEdit(project.id)}
                                            autoFocus
                                        />
                                        <Button size="small" type="text" icon={<Check size={14} />} onClick={() => saveEdit(project.id)} />
                                    </div>
                                ) : (
                                    <span 
                                        className={`cursor-pointer ${project.id === currentProjectId ? 'text-cyan-600 dark:text-cyan-400 font-bold' : ''}`}
                                        onClick={() => startEdit(project.id, project.name)}
                                    >
                                        {project.name} {project.id === currentProjectId && <span className="text-xs bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300 px-1.5 py-0.5 rounded ml-2">Current</span>}
                                    </span>
                                )
                            }
                            description={
                                <span className="text-xs text-slate-400">
                                    Last updated: {new Date(project.updatedAt).toLocaleString()} • {project.nodes.length} devices
                                </span>
                            }
                        />
                    </List.Item>
                )}
                locale={{ emptyText: 'No projects. Create one to start.' }}
            />
        </Modal>
    );
}
