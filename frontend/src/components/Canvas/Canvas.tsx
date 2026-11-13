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
  type Edge,
  getRectOfNodes,
  useOnSelectionChange,
} from 'reactflow';
import { useShallow } from 'zustand/react/shallow';
import {
  LayoutDashboard, Download, CloudUpload, CloudDownload, FileJson,
  FileUp, ShieldAlert, X, AlertTriangle, AlertOctagon, Info,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { toPng } from 'html-to-image';
import { Modal, List, Input, Button, App as AntdApp } from 'antd';
import 'reactflow/dist/style.css';
import DeviceNode from './DeviceNode';
import SmartEdge from './SmartEdge';
import { type DeviceType, type DeviceData, type EdgeData } from '../../types/nodes';
import useStore, { type RFStateShape } from '../../store/useStore';
import { getLayoutedElements } from '../../utils/autoLayout';
import { generateNextIP } from '../../utils/network';
import { api, type Project } from '../../api/client';
import { ImportError, parseTopologyFile } from '../../utils/importTopology';
import { analyzeTopology, countBySeverity, type Issue } from '../../utils/validation';
import AiAssistant from '../AiAssistant/AiAssistant';

const nodeTypes = {
  deviceNode: DeviceNode,
};

const edgeTypes = {
  smartEdge: SmartEdge,
};

const getId = () => `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

const selector = (state: RFStateShape) => ({
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
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode,
    token, setLoginModalOpen, currentProjectId, setCurrentProjectId, markClean,
  } = useStore(
    useShallow((state) => ({
      ...selector(state),
      token: state.token,
      setLoginModalOpen: state.setLoginModalOpen,
      currentProjectId: state.currentProjectId,
      setCurrentProjectId: state.setCurrentProjectId,
      markClean: state.markClean,
    }))
  );
  
  // ... rest of the component logic (no changes to logic, just using message from useApp)

  // But if we want UI buttons, we can use the hook. 
  // Note: zundo attaches .temporal to the store, but TypeScript might complain if not typed correctly.
  // For keyboard shortcuts, we can access the state directly.

  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { setNodes, setEdges, fitView, getNodes, getEdges, setCenter } = useReactFlow();

  // Cloud Project State (project id lives in the store so AutoSave can see it)
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

  const onImportJson = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset immediately so selecting the same file twice re-triggers.
      event.target.value = '';
      if (!file) return;

      if (nodes.length > 0 && !confirm(t('canvas.importConfirm'))) {
          return;
      }

      try {
          const text = await file.text();
          const result = parseTopologyFile(text);

          setNodes(result.nodes);
          setEdges(result.edges);
          // The imported canvas is not tied to any cloud project yet.
          setCurrentProjectId(null);
          markClean();

          if (result.warnings.length > 0) {
              // Warnings carry codes; the first one is translated for the toast
              // and the full list goes to the console for debugging.
              const first = result.warnings[0];
              message.warning(
                  t('canvas.importWarnings', {
                      count: result.warnings.length,
                      detail: t(`importWarnings.${first.code}`, first as Record<string, unknown>),
                  })
              );
              console.warn('[Import] warnings:', result.warnings);
          } else {
              message.success(t('canvas.importSuccess', { count: result.nodes.length }));
          }
          window.requestAnimationFrame(() => fitView());
      } catch (error) {
          if (error instanceof ImportError) {
              message.error(
                  `${t('canvas.importFailed')}：${t(`importErrors.${error.code}`)}`
              );
          } else {
              message.error(t('canvas.importFailed'));
              console.error(error);
          }
      }
  };

  const focusIssue = (issue: Issue) => {
      const targetId = issue.nodeIds[0] ?? issue.edgeIds[0];
      if (!targetId) return;
      const node = getNodes().find((n) => n.id === targetId);
      if (node) {
          setCenter(node.position.x + 110, node.position.y + 50, { zoom: 1.2, duration: 400 });
      }
      setIsIssuesOpen(false);
  };

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isIssuesOpen, setIsIssuesOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recomputed on every topology change; pure and cheap for canvas sizes.
  const issues: Issue[] = analyzeTopology(nodes, edges);
  const severityCounts = countBySeverity(issues);

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
              markClean();
              hideLoading();
              message.success(t('canvas.saveSuccess'));
          } catch (error) {
              hideLoading();
              message.error(t('canvas.error'));
              console.error(error);
          }
      } else {
          // Open modal for new project
          setNewProjectName(t('canvas.defaultProjectName'));
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
          markClean();
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
          let data: unknown = project.data;
          
          if (Array.isArray(data) && data.length > 0) {
              data = data[0];
          }
          
          // If it came as a string (legacy), parse it
          if (typeof data === 'string') {
             data = JSON.parse(data);
          }

          const payload = data as { nodes?: Node<DeviceData>[]; edges?: Edge<EdgeData>[] } | null;
          if (payload?.nodes && payload?.edges) {
              setNodes(payload.nodes);
              setEdges(payload.edges);
              setCurrentProjectId(project.id);
              markClean();
              setIsProjectModalOpen(false);
              message.success(t('canvas.loadSuccess'));
              setTimeout(() => fitView(), 100);
          }
      } catch (e) {
          message.error(t('loadModal.invalid'));
          console.error(e);
      }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: number) => {
      e.stopPropagation(); // Prevent triggering loadProject
      if (confirm(t('loadModal.confirmDelete'))) {
          try {
              await api.deleteProject(id);
              setProjectList(prev => prev.filter(p => p.id !== id));
              message.success(t('loadModal.deleted'));
          } catch {
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
            maskColor="rgba(2, 6, 23, 0.55)"
            // #334155 sat almost invisible against the slate-950 canvas;
            // a mid-tone slate keeps nodes distinguishable from the mask.
            nodeColor="#94a3b8"
            nodeStrokeColor="#e2e8f0"
            nodeStrokeWidth={2}
        />
        
        <Panel
          position="top-right"
          // Wrap instead of overflowing once the canvas gets narrow: the
          // toolbar already has 7 actions at ~700px total width. The cap keeps
          // it inside the canvas between the two fixed sidebars (16rem + 20rem)
          // but never collapses below a usable minimum.
          className="flex flex-wrap justify-end gap-2 max-w-[max(16rem,calc(100vw-38rem))]"
        >
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
                onClick={onImportJson}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-700 hover:text-cyan-400 transition-colors shadow-lg"
            >
                <FileUp className="w-4 h-4" />
                <span className="text-xs font-medium">{t('canvas.importJson')}</span>
            </button>
            <button
                onClick={() => setIsIssuesOpen(v => !v)}
                className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-md border transition-colors shadow-lg',
                    severityCounts.error > 0
                        ? 'bg-red-900/50 border-red-700/50 text-red-300 hover:bg-red-900'
                        : severityCounts.warning > 0
                            ? 'bg-amber-900/50 border-amber-700/50 text-amber-300 hover:bg-amber-900'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-cyan-400'
                )}
                title={t('canvas.checkTitle')}
            >
                <ShieldAlert className="w-4 h-4" />
                <span className="text-xs font-medium">
                    {t('canvas.check')}
                    {(severityCounts.error + severityCounts.warning) > 0 && (
                        <span className="ml-1 font-mono">
                            ({severityCounts.error + severityCounts.warning})
                        </span>
                    )}
                </span>
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="hidden"
            />
            <button 
                onClick={onDownload}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-700 hover:text-cyan-400 transition-colors shadow-lg"
            >
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium">{t('canvas.export')}</span>
            </button>
        </Panel>
      </ReactFlow>

      {/* Topology issue panel */}
      {isIssuesOpen && (
        <div className="absolute top-16 right-4 z-40 w-96 max-h-[70vh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100">{t('canvas.checkTitle')}</h3>
            </div>
            <button
              onClick={() => setIsIssuesOpen(false)}
              className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-4 py-3">
            {issues.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                {t('canvas.noIssues')}
              </p>
            ) : (
              <ul className="space-y-2">
                {issues.map((issue) => {
                  const Icon =
                    issue.severity === 'error'
                      ? AlertOctagon
                      : issue.severity === 'warning'
                        ? AlertTriangle
                        : Info;
                  const tone =
                    issue.severity === 'error'
                      ? 'text-red-400'
                      : issue.severity === 'warning'
                        ? 'text-amber-400'
                        : 'text-sky-400';
                  return (
                    <li key={issue.id}>
                      <button
                        onClick={() => focusIssue(issue)}
                        className="flex w-full items-start gap-2 rounded border border-slate-800 bg-slate-800/40 p-2 text-left transition-colors hover:border-slate-600 hover:bg-slate-800"
                      >
                        <Icon className={clsx('mt-0.5 h-3.5 w-3.5 flex-shrink-0', tone)} />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-200">
                            {t(`issues.${issue.code}`, issue.params ?? {})}
                          </p>
                          {issue.nodeIds.length > 0 && (
                            <p className="mt-0.5 truncate text-[10px] text-slate-500">
                              {issue.nodeIds
                                .map((id: string) => nodes.find((n: Node<DeviceData>) => n.id === id)?.data.name ?? id)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Save Project Modal */}
        <Modal
            title={t('saveModal.title')}
            open={isSaveModalOpen}
            onOk={confirmSaveNewProject}
            onCancel={() => setIsSaveModalOpen(false)}
            okText={t('common.save')}
            cancelText={t('common.cancel')}
            okButtonProps={{ className: 'bg-cyan-600 hover:!bg-cyan-500' }}
        >
            <div className="py-4">
                <label className="block text-sm text-slate-500 mb-2">项目名称</label>
                <Input 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder={t('canvas.defaultProjectName')}
                    onPressEnter={confirmSaveNewProject}
                />
            </div>
        </Modal>

      {/* Load Project Modal */}
      <Modal
          title={t('loadModal.title')}
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
                              {t('loadModal.select')}
                          </Button>
                          <Button 
                              size="small" 
                              danger 
                              type="text"
                              onClick={(e) => handleDeleteProject(e, item.id)}
                          >
                              {t('common.delete')}
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
