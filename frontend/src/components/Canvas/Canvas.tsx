import { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  Panel,
  useReactFlow,
  type ReactFlowInstance,
  type Node,
  getRectOfNodes,
  useOnSelectionChange,
} from 'reactflow';
import { useShallow } from 'zustand/react/shallow';
import { LayoutDashboard, Download, CloudUpload, CloudDownload, FileJson } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toPng } from 'html-to-image';
import { Modal, List, Input, Button, App as AntdApp } from 'antd';
import 'reactflow/dist/style.css';
import DeviceNode from './DeviceNode';
import SmartEdge from './SmartEdge';
import { type DeviceType, type DeviceData } from '../../types/nodes';
import useStore from '../../store/useStore';
import { getLayoutedElements } from '../../utils/autoLayout';
import { generateNextIP } from '../../utils/network';
import { api, type Project } from '../../api/client';
import AiAssistant from '../AiAssistant/AiAssistant';

const nodeTypes = {
  deviceNode: DeviceNode,
};

const edgeTypes = {
  smartEdge: SmartEdge,
};

const getId = () => `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

const selector = (state: any) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  addNode: state.addNode,
});

function Flow() {
  const { message } = AntdApp.useApp();
  const { t } = useTranslation();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, token, setLoginModalOpen } = useStore(
    useShallow((state) => ({
      ...selector(state),
      token: state.token,
      setLoginModalOpen: state.setLoginModalOpen,
    }))
  );
  
  // ... rest of the component logic (no changes to logic, just using message from useApp)

  // But if we want UI buttons, we can use the hook. 
  // Note: zundo attaches .temporal to the store, but TypeScript might complain if not typed correctly.
  // For keyboard shortcuts, we can access the state directly.

  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { setNodes, setEdges, fitView, getNodes, getEdges } = useReactFlow();

  // Cloud Project State
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectList, setProjectList] = useState<Project[]>([]);
  
  // Clipboard state
  const [copiedNodes, setCopiedNodes] = useState<Node<DeviceData>[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<Node<DeviceData>[]>([]);

  useOnSelectionChange({
      onChange: ({ nodes }) => {
          setSelectedNodes(nodes as Node<DeviceData>[]);
      },
  });

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
          // Ignore keyboard shortcuts when typing in input fields
          const target = event.target as HTMLElement;
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
              return;
          }

          const isCtrlOrCmd = event.ctrlKey || event.metaKey;
          
          // Copy: Ctrl+C
          if (isCtrlOrCmd && event.key === 'c') {
              if (selectedNodes.length > 0) {
                  setCopiedNodes(selectedNodes);
                  console.log('Copied nodes:', selectedNodes);
              }
          }

          // Paste: Ctrl+V
          if (isCtrlOrCmd && event.key === 'v') {
              if (copiedNodes.length > 0) {
                  const newNodes = copiedNodes.map((node) => {
                      const newId = getId();
                      return {
                          ...node,
                          id: newId,
                          position: {
                              x: node.position.x + 50, // Offset to see the difference
                              y: node.position.y + 50,
                          },
                          data: {
                              ...node.data,
                              name: `${node.data.name} (Copy)`, // Mark as copy
                              ip: generateNextIP(getNodes() as Node<DeviceData>[]), // New IP
                          },
                          selected: true, // Select new nodes
                      };
                  });

                  // Add new nodes to store
                  newNodes.forEach(node => addNode(node));
              }
          }

          // Undo: Ctrl+Z
          if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey) {
              event.preventDefault();
              useStore.temporal.getState().undo();
          }

          // Redo: Ctrl+Y or Ctrl+Shift+Z
          if ((isCtrlOrCmd && event.key === 'y') || (isCtrlOrCmd && event.shiftKey && event.key === 'z')) {
              event.preventDefault();
              useStore.temporal.getState().redo();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
      };
  }, [selectedNodes, copiedNodes, addNode, getNodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as DeviceType;

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (!position) return;

      const newNode: Node<DeviceData> = {
        id: getId(),
        type: 'deviceNode',
        position,
        data: { 
            name: `New ${type}`,
            type: type,
            ip: generateNextIP(useStore.getState().nodes),
            status: 'online',
            services: []
        },
      };

      addNode(newNode);
    },
    [reactFlowInstance, addNode]
  );

  const onLayout = useCallback((direction: string) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      );

      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);

      window.requestAnimationFrame(() => {
          fitView();
      });
  }, [nodes, edges, setNodes, setEdges, fitView]);

  const onDownload = () => {
    const nodes = getNodes();
    const nodesBounds = getRectOfNodes(nodes);
    
    // Add padding around the nodes
    const padding = 50;
    const imageWidth = nodesBounds.width + (padding * 2);
    const imageHeight = nodesBounds.height + (padding * 2);

    // Calculate transform to center the nodes in the image
    // We don't use getTransformForBounds here because we want to control the exact pixel size based on content
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    
    if (viewport) {
        toPng(viewport, {
            backgroundColor: '#020617', // slate-950
            width: imageWidth,
            height: imageHeight,
            style: {
                width: `${imageWidth}px`,
                height: `${imageHeight}px`,
                // Translate to move the top-left of the bounding box to (padding, padding)
                transform: `translate(${-nodesBounds.x + padding}px, ${-nodesBounds.y + padding}px) scale(1)`,
            },
            pixelRatio: 2, // High resolution (Retina)
        }).then((dataUrl) => {
            const link = document.createElement('a');
            link.download = `netcraft-topology-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        });
    }
  };

  const onExportJson = () => {
      const projectData = {
          nodes: getNodes(),
          edges: getEdges(),
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
      };
      
      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.download = `netcraft-data-${Date.now()}.json`;
      link.href = url;
      link.click();
      
      URL.revokeObjectURL(url);
  };

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleSaveCloud = async () => {
      if (!token) {
          setLoginModalOpen(true);
          return;
      }
      if (currentProjectId) {
          // If already saved, update directly
          const hideLoading = message.loading(t('canvas.saving'), 0);
          try {
              const projectData = {
                  nodes: getNodes(),
                  edges: getEdges(),
              };
              await api.updateProject(currentProjectId, {
                  data: [projectData]
              });
              hideLoading();
              message.success(t('canvas.saveSuccess'));
          } catch (error) {
              hideLoading();
              message.error(t('canvas.error'));
              console.error(error);
          }
      } else {
          // Open modal for new project
          setNewProjectName('我的网络拓扑');
          setIsSaveModalOpen(true);
      }
  };

  const confirmSaveNewProject = async () => {
      const hideLoading = message.loading(t('canvas.saving'), 0);
      try {
          const projectData = {
              nodes: getNodes(),
              edges: getEdges(),
          };
          const newProject = await api.createProject({
              name: newProjectName,
              data: [projectData],
              description: 'Created via NetCraft Web'
          });
          setCurrentProjectId(newProject.id);
          setIsSaveModalOpen(false);
          hideLoading();
          message.success(t('canvas.saveSuccess'));
      } catch (error) {
          hideLoading();
          message.error(t('canvas.error'));
          console.error(error);
      }
  };

  const handleLoadCloud = async () => {
      if (!token) {
          setLoginModalOpen(true);
          return;
      }
      try {
          const projects = await api.getProjects();
          setProjectList(projects);
          setIsProjectModalOpen(true);
      } catch (error) {
          message.error(t('canvas.error'));
          console.error(error);
      }
  };

  const loadProject = (project: Project) => {
      try {
          // project.data is now an object (or list of objects) from the API
          // If we wrapped it in a list, we need to unwrap it.
          let data: any = project.data;
          
          if (Array.isArray(data) && data.length > 0) {
              data = data[0];
          }
          
          // If it came as a string (legacy), parse it
          if (typeof data === 'string') {
             data = JSON.parse(data);
          }

          if (data && data.nodes && data.edges) {
              setNodes(data.nodes);
              setEdges(data.edges);
              setCurrentProjectId(project.id);
              setIsProjectModalOpen(false);
              message.success(t('canvas.loadSuccess'));
              setTimeout(() => fitView(), 100);
          }
      } catch (e) {
          message.error('Invalid project data');
          console.error(e);
      }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: number) => {
      e.stopPropagation(); // Prevent triggering loadProject
      if (confirm('Are you sure you want to delete this project?')) {
          try {
              await api.deleteProject(id);
              setProjectList(prev => prev.filter(p => p.id !== id));
              message.success('Project deleted');
          } catch (error) {
              message.error(t('canvas.error'));
          }
      }
  };

  return (
    <div className="flex-1 h-full relative bg-slate-950" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'smartEdge', animated: true }}
        fitView
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="bg-slate-800 border-slate-700 fill-slate-300 text-slate-300" />
        <MiniMap 
            className="bg-slate-900 border border-slate-800" 
            maskColor="rgba(15, 23, 42, 0.6)"
            nodeColor="#334155"
        />
        
        <Panel position="top-right" className="flex gap-2">
            <button 
                onClick={handleSaveCloud}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-900/50 border border-emerald-700/50 rounded-md text-emerald-400 hover:bg-emerald-900 hover:text-emerald-300 transition-colors shadow-lg"
            >
                <CloudUpload className="w-4 h-4" />
                <span className="text-xs font-medium">{t('canvas.save')}</span>
            </button>
            <button 
                onClick={handleLoadCloud}
                className="flex items-center gap-2 px-3 py-2 bg-sky-900/50 border border-sky-700/50 rounded-md text-sky-400 hover:bg-sky-900 hover:text-sky-300 transition-colors shadow-lg"
            >
                <CloudDownload className="w-4 h-4" />
                <span className="text-xs font-medium">{t('canvas.load')}</span>
            </button>
            <div className="w-px h-8 bg-slate-800 mx-1"></div>
            <button 
                onClick={() => onLayout('TB')}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-700 hover:text-cyan-400 transition-colors shadow-lg"
            >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-xs font-medium">{t('canvas.autoLayout')}</span>
            </button>
            <button 
                onClick={onExportJson}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-700 hover:text-cyan-400 transition-colors shadow-lg"
            >
                <FileJson className="w-4 h-4" />
                <span className="text-xs font-medium">{t('canvas.exportJson')}</span>
            </button>
            <button 
                onClick={onDownload}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-700 hover:text-cyan-400 transition-colors shadow-lg"
            >
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium">{t('canvas.export')}</span>
            </button>
        </Panel>
      </ReactFlow>

      {/* Save Project Modal */}
        <Modal
            title="保存新项目"
            open={isSaveModalOpen}
            onOk={confirmSaveNewProject}
            onCancel={() => setIsSaveModalOpen(false)}
            okText="保存"
            cancelText="取消"
            okButtonProps={{ className: 'bg-cyan-600 hover:!bg-cyan-500' }}
        >
            <div className="py-4">
                <label className="block text-sm text-slate-500 mb-2">项目名称</label>
                <Input 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="我的网络拓扑"
                    onPressEnter={confirmSaveNewProject}
                />
            </div>
        </Modal>

      {/* Load Project Modal */}
      <Modal
          title="加载项目"
          open={isProjectModalOpen}
          onCancel={() => setIsProjectModalOpen(false)}
          footer={null}
          className="netcraft-modal"
      >
          <List
              dataSource={projectList}
              renderItem={(item) => (
                  <List.Item 
                      className="cursor-pointer hover:bg-slate-100 p-2 rounded transition-colors group flex justify-between items-center"
                      onClick={() => loadProject(item)}
                  >
                      <div className="flex flex-col">
                          <span className="font-medium text-slate-800">{item.name}</span>
                          <span className="text-xs text-slate-500">{new Date(item.updated_at).toLocaleString()}</span>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                              size="small" 
                              type="primary" 
                              className="bg-cyan-600 hover:!bg-cyan-500"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  loadProject(item);
                              }}
                          >
                              选择
                          </Button>
                          <Button 
                              size="small" 
                              danger 
                              type="text"
                              onClick={(e) => handleDeleteProject(e, item.id)}
                          >
                              删除
                          </Button>
                      </div>
                  </List.Item>
              )}
          />
       </Modal>

       <AiAssistant />
     </div>
   );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
