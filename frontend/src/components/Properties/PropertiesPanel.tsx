import { useTranslation } from 'react-i18next';
import { Settings2, Activity, Network, Plus, Trash2, Cpu, Database, Box } from 'lucide-react';
import { Input, Select, Button } from 'antd';
import useStore from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { type Node, type Edge } from 'reactflow';
import { type DeviceData, type EdgeData } from '../../types/nodes';

const { Option } = Select;

const selector = (state: any) => ({
  nodes: state.nodes,
  edges: state.edges,
  updateNodeData: state.updateNodeData,
  updateEdgeData: state.updateEdgeData,
});

export default function PropertiesPanel() {
  const { t } = useTranslation();
  const { nodes, edges, updateNodeData, updateEdgeData } = useStore(useShallow(selector));
  
  // Find the selected node or edge
  const selectedNode = nodes.find((node: any) => node.selected) as Node<DeviceData> | undefined;
  const selectedEdge = edges.find((edge: any) => edge.selected) as Edge<EdgeData> | undefined;

  const handleNodeChange = (key: keyof DeviceData, value: any) => {
    if (selectedNode) {
      updateNodeData(selectedNode.id, { [key]: value });
    }
  };

  const handleEdgeChange = (key: keyof EdgeData, value: any) => {
      if (selectedEdge) {
          updateEdgeData(selectedEdge.id, { [key]: value });
      }
  }

  const addService = () => {
      if (selectedNode) {
          const services = selectedNode.data.services || [];
          handleNodeChange('services', [...services, { name: 'New Service', ports: [] }]);
      }
  };

  const updateServiceName = (index: number, value: string) => {
      if (selectedNode && selectedNode.data.services) {
          const services = [...selectedNode.data.services];
          services[index] = { ...services[index], name: value };
          handleNodeChange('services', services);
      }
  };

  const updateServicePorts = (index: number, value: string) => {
      if (selectedNode && selectedNode.data.services) {
          const services = [...selectedNode.data.services];
          // Split by comma or space, trim, and filter empty strings
          const ports = value.split(/[, ]+/).filter(p => p.trim() !== '');
          services[index] = { ...services[index], ports };
          handleNodeChange('services', services);
      }
  };

  const removeService = (index: number) => {
      if (selectedNode) {
          const services = selectedNode.data.services || [];
          handleNodeChange('services', services.filter((_, i) => i !== index));
      }
  };

  const nodeType = selectedNode?.data?.type;
  const isHardware = nodeType ? ['modem', 'router', 'switch', 'ap', 'pc', 'firewall', 'server'].includes(nodeType) : false;
  const isSystem = nodeType ? ['server', 'pve', 'esxi', 'unraid', 'vm_windows', 'vm_linux', 'vm_openwrt'].includes(nodeType) : false;
  const hasServices = nodeType ? ['server', 'pve', 'unraid', 'vm_windows', 'vm_linux', 'vm_openwrt'].includes(nodeType) : false;

  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="w-72 h-screen bg-slate-900 border-l border-slate-800 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
        <Settings2 className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm">{t('properties.noSelection')}</p>
      </aside>
    );
  }

  return (
    <aside className="w-80 h-screen bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-slate-800 flex items-center gap-2">
        <Settings2 className="w-5 h-5 text-cyan-400" />
        <h2 className="font-bold text-slate-100 tracking-wide">{t('properties.title')}</h2>
      </div>

      <div className="p-6 space-y-6">
        {selectedNode && (
            <div className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        Device Info
                    </h3>
                    
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">{t('properties.name')}</label>
                        <Input 
                            value={selectedNode.data.name} 
                            onChange={(e) => handleNodeChange('name', e.target.value)}
                            className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">{t('properties.ip')}</label>
                        <Input 
                            value={selectedNode.data.ip} 
                            onChange={(e) => handleNodeChange('ip', e.target.value)}
                            className="!bg-slate-800 !border-slate-700 !text-slate-200 !font-mono focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">{t('properties.status')}</label>
                        <Select
                            value={selectedNode.data.status || 'online'}
                            onChange={(value) => handleNodeChange('status', value)}
                            className="w-full [&_.ant-select-selector]:!bg-slate-800 [&_.ant-select-selector]:!border-slate-700 [&_.ant-select-selector]:!text-slate-200 [&_.ant-select-arrow]:!text-slate-400"
                            popupClassName="!bg-slate-800 [&_.ant-select-item]:!text-slate-300 [&_.ant-select-item-option-selected]:!bg-cyan-900/30 [&_.ant-select-item-option-active]:!bg-slate-700"
                        >
                            <Option value="online">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    {t('properties.online')}
                                </span>
                            </Option>
                            <Option value="warning">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                    {t('properties.warning')}
                                </span>
                            </Option>
                            <Option value="offline">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    {t('properties.offline')}
                                </span>
                            </Option>
                        </Select>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">DNS Server</label>
                        <Input 
                            value={selectedNode.data.dns} 
                            onChange={(e) => handleNodeChange('dns', e.target.value)}
                            className="!bg-slate-800 !border-slate-700 !text-slate-200 !font-mono focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                            placeholder="e.g. 192.168.1.1"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Gateway</label>
                        <Input 
                            value={selectedNode.data.gateway} 
                            onChange={(e) => handleNodeChange('gateway', e.target.value)}
                            className="!bg-slate-800 !border-slate-700 !text-slate-200 !font-mono focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                            placeholder="e.g. 192.168.1.1"
                        />
                    </div>
                </div>

                {/* Hardware Details */}
                {(isHardware || isSystem) && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Box className="w-3 h-3" />
                            {t('properties.hardware')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5">{t('properties.brand')}</label>
                                <Input 
                                    value={selectedNode.data.brand} 
                                    onChange={(e) => handleNodeChange('brand', e.target.value)}
                                    className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                                    placeholder="e.g. Ubiquiti"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5">{t('properties.model')}</label>
                                <Input 
                                    value={selectedNode.data.model} 
                                    onChange={(e) => handleNodeChange('model', e.target.value)}
                                    className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                                    placeholder="e.g. UDM Pro"
                                />
                            </div>
                            <div className="col-span-2">
                                  <label className="block text-xs text-slate-400 mb-1.5">Interfaces (Ports)</label>
                                  <Input 
                                      type="number"
                                      min={0}
                                      max={48}
                                      value={selectedNode.data.interfaceCount ?? 3} 
                                      onChange={(e) => handleNodeChange('interfaceCount', parseInt(e.target.value) || 0)}
                                      className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                                  />
                              </div>
                              <div className="col-span-2">
                                  <label className="block text-xs text-slate-400 mb-1.5">Management Port (Web UI)</label>
                                  <Input 
                                      value={selectedNode.data.managementPort} 
                                      onChange={(e) => handleNodeChange('managementPort', e.target.value)}
                                      className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                                      placeholder="e.g. 8006 (PVE), 80 (OpenWrt)"
                                  />
                              </div>
                          </div>
                      </div>
                  )}

                {/* System Specs */}
                {isSystem && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                         <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Cpu className="w-3 h-3" />
                            {t('properties.specs')}
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs text-slate-400 mb-1.5">{t('properties.os')}</label>
                                <Input 
                                    value={selectedNode.data.os} 
                                    onChange={(e) => handleNodeChange('os', e.target.value)}
                                    className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                                    placeholder="e.g. Ubuntu"
                                />
                            </div>
                             <div>
                                <label className="block text-xs text-slate-400 mb-1.5">{t('properties.os_version')}</label>
                                <Input 
                                    value={selectedNode.data.os_version} 
                                    onChange={(e) => handleNodeChange('os_version', e.target.value)}
                                    className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                                    placeholder="22.04 LTS"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5">{t('properties.cpu')}</label>
                                <Input 
                                    value={selectedNode.data.cpu} 
                                    onChange={(e) => handleNodeChange('cpu', e.target.value)}
                                    className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                                    placeholder="4 vCPU"
                                />
                            </div>
                             <div>
                                <label className="block text-xs text-slate-400 mb-1.5">{t('properties.ram')}</label>
                                <Input 
                                    value={selectedNode.data.ram} 
                                    onChange={(e) => handleNodeChange('ram', e.target.value)}
                                    className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                                    placeholder="8 GB"
                                />
                            </div>
                             <div>
                                <label className="block text-xs text-slate-400 mb-1.5">{t('properties.disk')}</label>
                                <Input 
                                    value={selectedNode.data.disk} 
                                    onChange={(e) => handleNodeChange('disk', e.target.value)}
                                    className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                                    placeholder="100 GB"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Services */}
                {hasServices && (
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Database className="w-3 h-3" />
                                {t('properties.services')}
                            </h3>
                            <Button 
                                type="text" 
                                size="small"
                                icon={<Plus size={14} />}
                                onClick={addService}
                                className="text-cyan-400 hover:!text-cyan-300 hover:!bg-cyan-900/20"
                            >
                                {t('properties.addService')}
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {selectedNode.data.services?.map((service, index) => (
                                <div key={index} className="flex flex-col gap-2 bg-slate-800/50 p-2 rounded border border-slate-800">
                                    <div className="flex gap-2">
                                        <Input 
                                            value={service.name}
                                            onChange={(e) => updateServiceName(index, e.target.value)}
                                            placeholder="Service Name"
                                            className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600 !text-xs flex-1"
                                        />
                                        <Button 
                                            type="text" 
                                            danger
                                            icon={<Trash2 size={14} />}
                                            onClick={() => removeService(index)}
                                            className="hover:!bg-red-900/20 flex-shrink-0"
                                        />
                                    </div>
                                    <Input 
                                        value={service.ports.join(', ')}
                                        onChange={(e) => updateServicePorts(index, e.target.value)}
                                        placeholder="Ports (e.g. 80, 443)"
                                        className="!bg-slate-900 !border-slate-700 !text-cyan-400 !font-mono focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600 !text-[10px]"
                                    />
                                </div>
                            ))}
                             {(!selectedNode.data.services || selectedNode.data.services.length === 0) && (
                                <p className="text-xs text-slate-600 italic text-center py-2">No services configured</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {selectedEdge && (
            <div className="space-y-4">
                 <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Network className="w-3 h-3" />
                    Connection Info
                </h3>

                {/* Label Input */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Label</label>
                    <Input 
                        value={selectedEdge.data?.label || ''} 
                        onChange={(e) => handleEdgeChange('label', e.target.value)}
                        placeholder="e.g. LAN 1"
                        className="!bg-slate-800 !border-slate-700 !text-slate-200 focus:!border-cyan-500 hover:!border-slate-600 placeholder:!text-slate-600"
                    />
                </div>

                {/* Type Select */}
                 <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Cable Type</label>
                    <Select
                        value={selectedEdge.data?.type || 'eth_1g'}
                        onChange={(value) => handleEdgeChange('type', value)}
                        className="w-full [&_.ant-select-selector]:!bg-slate-800 [&_.ant-select-selector]:!border-slate-700 [&_.ant-select-selector]:!text-slate-200 [&_.ant-select-arrow]:!text-slate-400"
                        popupClassName="!bg-slate-800 [&_.ant-select-item]:!text-slate-300 [&_.ant-select-item-option-selected]:!bg-cyan-900/30 [&_.ant-select-item-option-active]:!bg-slate-700"
                    >
                        <Option value="eth_1g">Ethernet (1Gbps)</Option>
                        <Option value="eth_10g">Ethernet (10Gbps)</Option>
                        <Option value="fiber">Fiber Optic</Option>
                        <Option value="wifi">Wi-Fi (Wireless)</Option>
                    </Select>
                </div>
            </div>
        )}
      </div>
    </aside>
  );
}
