import { useEffect, useState } from 'react';
import { Modal, List, Button, Input, Popconfirm, Empty, Spin, App as AntdApp } from 'antd';
import { Plus, Trash, FolderOpen, Check } from 'lucide-react';
import { type Node, type Edge } from 'reactflow';
import { type DeviceData, type EdgeData } from '../types/nodes';
import useStore from '../store/useStore';
import { useTranslation } from 'react-i18next';
import { api, type Project } from '../api/client';

export default function ProjectManager({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { message } = AntdApp.useApp();
    const { t } = useTranslation();
    const { token, currentProjectId, setCurrentProjectId, setLoginModalOpen } = useStore();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [creating, setCreating] = useState(false);

    const loadProjects = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const list = await api.getProjects();
            setProjects(list);
        } catch (error) {
            message.error(t('projects.loadFailed'));
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            if (!token) {
                setLoginModalOpen(true);
                onClose();
                return;
            }
            loadProjects();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, token]);

    const handleCreate = async () => {
        if (!newProjectName.trim()) return;
        setCreating(true);
        try {
            const { nodes, edges } = useStore.getState();
            const created = await api.createProject({
                name: newProjectName.trim(),
                description: 'Created via NetCraft Web',
                data: [{ nodes, edges }],
            });
            setCurrentProjectId(created.id);
            useStore.getState().markClean();
            setNewProjectName('');
            message.success(t('projects.created'));
            await loadProjects();
        } catch (error) {
            message.error(t('projects.createFailed'));
            console.error(error);
        } finally {
            setCreating(false);
        }
    };

    const handleOpen = async (project: Project) => {
        try {
            let data: unknown = project.data;
            if (Array.isArray(data) && data.length > 0) data = data[0];
            if (typeof data === 'string') data = JSON.parse(data);

            const payload = data as { nodes?: Node<DeviceData>[]; edges?: Edge<EdgeData>[] } | null;
            if (payload?.nodes && payload?.edges) {
                useStore.getState().setNodes(payload.nodes);
                useStore.getState().setEdges(payload.edges);
                setCurrentProjectId(project.id);
                useStore.getState().markClean();
                message.success(t('projects.loaded'));
                onClose();
            } else {
                message.warning(t('projects.noData'));
            }
        } catch (error) {
            message.error(t('projects.corrupt'));
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.deleteProject(id);
            if (currentProjectId === id) {
                useStore.getState().resetCanvas();
            }
            message.success(t('projects.deleted'));
            await loadProjects();
        } catch (error) {
            message.error(t('projects.deleteFailed'));
            console.error(error);
        }
    };

    return (
        <Modal
            title={t('projects.title')}
            open={open}
            onCancel={onClose}
            footer={null}
            width={600}
            destroyOnHidden
        >
            <div className="mb-6 flex gap-2">
                <Input
                    placeholder={t('projects.newName')}
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onPressEnter={handleCreate}
                />
                <Button
                    type="primary"
                    icon={<Plus size={16} />}
                    onClick={handleCreate}
                    loading={creating}
                >
                    {t('projects.create')}
                </Button>
            </div>

            <Spin spinning={loading}>
                <List
                    dataSource={projects}
                    locale={{
                        emptyText: (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={t('projects.empty')}
                            />
                        ),
                    }}
                    renderItem={(project) => (
                        <List.Item
                            actions={[
                                <Button
                                    key="open"
                                    type="text"
                                    icon={<FolderOpen size={16} />}
                                    onClick={() => handleOpen(project)}
                                    className="text-cyan-600 hover:text-cyan-500"
                                >
                                    {t('projects.open')}
                                </Button>,
                                <Popconfirm
                                    key="delete"
                                    title={t('projects.deleteTitle')}
                                    description={t('projects.deleteDesc')}
                                    onConfirm={() => handleDelete(project.id)}
                                    okText={t('common.delete')}
                                    cancelText={t('common.cancel')}
                                    okButtonProps={{ danger: true }}
                                >
                                    <Button type="text" danger icon={<Trash size={16} />} />
                                </Popconfirm>,
                            ]}
                            className={`hover:bg-slate-800/50 transition-colors px-2 rounded ${
                                project.id === currentProjectId
                                    ? 'bg-cyan-900/10 border border-cyan-800'
                                    : ''
                            }`}
                        >
                            <List.Item.Meta
                                title={
                                    <span className={project.id === currentProjectId ? 'text-cyan-400 font-bold' : ''}>
                                        {project.name}
                                        {project.id === currentProjectId && (
                                            <span className="text-xs bg-cyan-900 text-cyan-300 px-1.5 py-0.5 rounded ml-2">
                                                <Check size={10} className="inline" /> {t('projects.current')}
                                            </span>
                                        )}
                                    </span>
                                }
                                description={
                                    <span className="text-xs text-slate-400">
                                        {t('projects.updatedAt', { time: new Date(project.updated_at).toLocaleString() })}
                                    </span>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Spin>
        </Modal>
    );
}
