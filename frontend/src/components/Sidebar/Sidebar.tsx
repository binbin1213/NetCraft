import { useState } from 'react';
import { PanelLeft, Settings2, Layers, LayoutTemplate, AlertCircle, FolderOpen, Globe, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfigProvider, theme, Divider } from 'antd';
import { type DeviceType, type DeviceData } from '../../types/nodes';
import { TEMPLATES, type Template } from '../../data/templates';
import useStore from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { type Node } from 'reactflow';
import clsx from 'clsx';
import { generateNextIP } from '../../utils/network';
import ProjectManager from '../ProjectManager';

interface DeviceItem {
  type: DeviceType;
  label: string;
}

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'devices' | 'templates'>('devices');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const { nodes, setNodes, setEdges, addNode } = useStore(useShallow((state: any) => ({ 
      nodes: state.nodes,
      setNodes: state.setNodes, 
      setEdges: state.setEdges,
      addNode: state.addNode
  })));

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDoubleClick = (type: DeviceType) => {
      const newNode: Node<DeviceData> = {
          id: `sidebar_node_${Date.now()}`,
          type: 'deviceNode',
          // Add with a slight random offset to avoid perfect stacking if user adds multiple quickly
          position: { x: 250 + Math.random() * 50, y: 250 + Math.random() * 50 },
          data: {
              name: t(`sidebar.${type}`), // Use localized name
              type: type,
              ip: generateNextIP(nodes),
              status: 'online',
              services: []
          }
      };
      addNode(newNode);
  };

  const handleLoadTemplate = (template: Template) => {
      Modal.confirm({
          title: t(template.nameKey),
          icon: <AlertCircle className="text-cyan-500" />,
          content: t('templates.loadConfirm'),
          okText: 'Load',
          cancelText: 'Cancel',
          className: 'netcraft-modal',
          okButtonProps: { className: 'bg-cyan-600 hover:!bg-cyan-500' },
          onOk() {
              // Deep clone to avoid reference issues
              const nodes = JSON.parse(JSON.stringify(template.nodes)).map((node: any) => ({
                  ...node,
                  data: {
                      ...node.data,
                      name: t(node.data.name)
                  }
              }));
              const edges = JSON.parse(JSON.stringify(template.edges));
              setNodes(nodes);
              setEdges(edges);
          }
      });
  };

  const basicDevices: DeviceItem[] = [
    { type: 'modem', label: t('sidebar.modem') },
    { type: 'router', label: t('sidebar.router') },
    { type: 'switch', label: t('sidebar.switch') },
    { type: 'ap', label: t('sidebar.ap') },
    { type: 'pc', label: t('sidebar.pc') },
    { type: 'firewall', label: t('sidebar.firewall') },
  ];

  const virtualizationDevices: DeviceItem[] = [
    { type: 'pve', label: t('sidebar.pve') },
    { type: 'esxi', label: t('sidebar.esxi') },
    { type: 'unraid', label: t('sidebar.unraid') },
    { type: 'server', label: t('sidebar.server') },
  ];

  const systemDevices: DeviceItem[] = [
      { type: 'vm_windows', label: t('sidebar.vm_windows') },
      { type: 'vm_linux', label: t('sidebar.vm_linux') },
      { type: 'vm_openwrt', label: t('sidebar.vm_openwrt') },
  ]

  const renderDeviceGrid = (title: string, items: DeviceItem[]) => (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ type, label }) => (
          <div
            key={type}
            className="bg-slate-800 border border-slate-700 rounded p-3 cursor-grab hover:border-cyan-500/50 hover:bg-slate-700 transition-all group flex flex-col items-center gap-2"
            onDragStart={(event) => onDragStart(event, type)}
            onDoubleClick={() => handleDoubleClick(type)}
            draggable
          >
            <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center group-hover:text-cyan-400 text-slate-400 transition-colors">
              {/* Placeholder icons for now */}
              <div className="w-4 h-4 border-2 border-current rounded-sm" />
            </div>
            <span className="text-xs text-slate-300 font-medium text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <aside className="w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <PanelLeft className="w-5 h-5 text-cyan-400" />
            <h1 className="font-bold text-slate-100 tracking-wide">{t('app.title')}</h1>
        </div>
        <button 
            onClick={() => setIsProjectManagerOpen(true)}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Project Manager"
        >
            <FolderOpen size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
          <button 
            onClick={() => setActiveTab('devices')}
            className={clsx(
                "flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors relative",
                activeTab === 'devices' ? "text-cyan-400 bg-slate-800/50" : "text-slate-500 hover:text-slate-300"
            )}
          >
              <Layers size={14} />
              {t('sidebar.basicDevices')}
              {activeTab === 'devices' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400" />}
          </button>
          <button 
            onClick={() => setActiveTab('templates')}
            className={clsx(
                "flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors relative",
                activeTab === 'templates' ? "text-cyan-400 bg-slate-800/50" : "text-slate-500 hover:text-slate-300"
            )}
          >
              <LayoutTemplate size={14} />
              {t('templates.title')}
              {activeTab === 'templates' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400" />}
          </button>
      </div>
      
      {/* Content */}
      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'devices' ? (
            <>
                {renderDeviceGrid(t('sidebar.basicDevices'), basicDevices)}
                {renderDeviceGrid(t('sidebar.virtualization'), virtualizationDevices)}
                {renderDeviceGrid(t('sidebar.systems'), systemDevices)}
            </>
        ) : (
            <div className="space-y-3">
                {TEMPLATES.map(template => (
                    <div 
                        key={template.id}
                        onClick={() => handleLoadTemplate(template)}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-pointer hover:border-cyan-500/50 hover:bg-slate-700 transition-all group"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <LayoutTemplate size={16} className="text-cyan-500" />
                            <h3 className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">
                                {t(template.nameKey)}
                            </h3>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {t(template.descriptionKey)}
                        </p>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          <span>{t('app.settings')}</span>
        </button>
      </div>

      {/* Project Manager Modal */}
      <ProjectManager open={isProjectManagerOpen} onClose={() => setIsProjectManagerOpen(false)} />

      {/* Settings Modal */}
      <ConfigProvider
        theme={{
            algorithm: theme.darkAlgorithm,
            token: {
                colorBgElevated: '#1e293b', // slate-800
                paddingContentHorizontal: 0,
                paddingMD: 0, // Remove default padding to control it via Tailwind
            }
        }}
      >
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-100 text-lg px-6 pt-6">
                    <Settings2 className="w-5 h-5 text-cyan-400" />
                    <span>{t('app.settings')}</span>
                </div>
            }
            open={isSettingsOpen}
            onCancel={() => setIsSettingsOpen(false)}
            footer={null}
            className="netcraft-modal"
            width={420}
            styles={{
                mask: {
                    backdropFilter: 'blur(4px)',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
            }}
            closeIcon={<span className="text-slate-400 hover:text-slate-200 transition-colors text-xl absolute top-6 right-6">×</span>}
        >
            <div className="p-6 space-y-6">
                {/* Language Section */}
                <div>
                    <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                        <Globe size={16} />
                        {t('app.language')}
                    </h3>
                    <div className="flex gap-0 border border-slate-600 rounded-md overflow-hidden">
                        <button
                            onClick={() => i18n.changeLanguage('en')}
                            className={clsx(
                                "flex-1 py-2 px-4 text-sm font-medium transition-colors",
                                i18n.language === 'en' 
                                    ? "bg-cyan-600 text-white" 
                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            )}
                        >
                            English
                        </button>
                        <div className="w-px bg-slate-600"></div>
                        <button
                            onClick={() => i18n.changeLanguage('zh')}
                            className={clsx(
                                "flex-1 py-2 px-4 text-sm font-medium transition-colors",
                                i18n.language === 'zh' 
                                    ? "bg-cyan-600 text-white" 
                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            )}
                        >
                            简体中文
                        </button>
                    </div>
                </div>

                {/* Theme Section */}
                <div className="opacity-60">
                    <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                        <Moon size={16} />
                        {t('app.theme')}
                    </h3>
                    <div className="flex gap-0 border border-slate-600 rounded-md overflow-hidden pointer-events-none">
                        <button className="flex-1 py-2 px-4 text-sm font-medium bg-cyan-600 text-white">
                            Dark
                        </button>
                        <div className="w-px bg-slate-600"></div>
                        <button className="flex-1 py-2 px-4 text-sm font-medium bg-slate-700 text-slate-500">
                            Light
                        </button>
                    </div>
                </div>

                <Divider className="!border-slate-700 !my-0" />

                {/* About Section */}
                <div className="text-center">
                    <h4 className="text-sm font-bold text-slate-200">NetCraft Web</h4>
                    <p className="text-xs text-slate-400 mt-1">v0.1.0 (Beta)</p>
                </div>
            </div>
        </Modal>
      </ConfigProvider>
    </aside>
  );
}
