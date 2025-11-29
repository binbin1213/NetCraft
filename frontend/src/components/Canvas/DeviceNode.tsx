import { Handle, Position, type NodeProps } from 'reactflow';
import { 
    Server, Router, Monitor, Network, Wifi, Shield, 
    Globe, Box, Cpu, ExternalLink
} from 'lucide-react';
import { type DeviceData, type DeviceType } from '../../types/nodes';
import { message, Popover } from 'antd';
import clsx from 'clsx';

const iconMap: Record<DeviceType, React.ElementType> = {
  // Basic
  modem: Globe,
  router: Router,
  switch: Network,
  pc: Monitor,
  server: Server,
  ap: Wifi,
  firewall: Shield,
  
  // Virtualization
  pve: Box,
  esxi: Box,
  unraid: Box,
  
  // VM/OS
  vm_windows: Cpu,
  vm_linux: Cpu,
  vm_openwrt: Router, // Soft Router
};

const gradientMap: Record<DeviceType, string> = {
  // Basic
  modem: 'from-blue-600 to-blue-800',
  router: 'from-indigo-500 to-purple-600',
  switch: 'from-blue-500 to-cyan-500',
  pc: 'from-slate-600 to-slate-500',
  server: 'from-emerald-500 to-teal-600',
  ap: 'from-orange-400 to-pink-500',
  firewall: 'from-red-500 to-orange-600',

  // Virtualization (Darker/Pro colors)
  pve: 'from-orange-600 to-red-700',
  esxi: 'from-blue-700 to-slate-800',
  unraid: 'from-lime-500 to-green-700',

  // VM/OS
  vm_windows: 'from-blue-400 to-blue-600',
  vm_linux: 'from-yellow-500 to-orange-500',
  vm_openwrt: 'from-pink-500 to-rose-600',
};

const NodeTooltipContent = ({ data }: { data: DeviceData }) => {
    return (
        <div className="space-y-2 min-w-[200px]">
            <div className="border-b border-slate-700 pb-2 mb-2">
                <h4 className="text-sm font-bold text-slate-200">{data.name}</h4>
                <span className="text-xs text-slate-500 capitalize">{data.type.replace('_', ' ')}</span>
            </div>
            
            <div className="space-y-1 text-xs">
                {data.ip && (
                    <div className="flex justify-between">
                        <span className="text-slate-500">IP:</span>
                        <span className="text-cyan-400 font-mono">{data.ip}</span>
                    </div>
                )}
                {data.gateway && (
                    <div className="flex justify-between">
                        <span className="text-slate-500">网关:</span>
                        <span className="text-slate-300 font-mono">{data.gateway}</span>
                    </div>
                )}
                {data.dns && (
                    <div className="flex justify-between">
                        <span className="text-slate-500">DNS服务器:</span>
                        <span className="text-slate-300 font-mono">{data.dns}</span>
                    </div>
                )}
                {data.managementPort && (
                    <div className="flex justify-between">
                        <span className="text-slate-500">管理端口:</span>
                        <span className="text-slate-300 font-mono">{data.managementPort}</span>
                    </div>
                )}
                {(data.brand || data.model) && (
                    <div className="flex justify-between">
                        <span className="text-slate-500">硬件:</span>
                        <span className="text-slate-300">{[data.brand, data.model].filter(Boolean).join(' ')}</span>
                    </div>
                )}
                {(data.os || data.os_version) && (
                    <div className="flex justify-between">
                        <span className="text-slate-500">操作系统:</span>
                        <span className="text-slate-300">{[data.os, data.os_version].filter(Boolean).join(' ')}</span>
                    </div>
                )}
                {data.services && data.services.length > 0 && (
                    <div className="pt-1 border-t border-slate-700 mt-1">
                        <span className="text-slate-500 block mb-1">运行服务:</span>
                        <div className="flex flex-wrap gap-1">
                            {data.services.map((s, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-cyan-300 border border-slate-700">
                                    {s.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function DeviceNode({ data, selected }: NodeProps<DeviceData>) {
  const Icon = iconMap[data.type] || Server;
  const gradient = gradientMap[data.type] || 'from-slate-700 to-slate-600';

  const handleCopyIp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.ip) {
      navigator.clipboard.writeText(data.ip);
      message.success(`Copied IP: ${data.ip}`);
    }
  };

  const openUrl = (ip: string, port: string) => {
      const protocol = ['443', '8006', '8443', '9443'].includes(port) ? 'https' : 'http';
      const url = `${protocol}://${ip}:${port}`;
      window.open(url, '_blank');
  };

  const openManagementUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.ip && data.managementPort) {
        openUrl(data.ip, data.managementPort);
    }
  };

  const handleServiceClick = (e: React.MouseEvent, port?: string) => {
      e.stopPropagation();
      if (data.ip && port) {
          openUrl(data.ip, port);
      }
  };

  return (
    <Popover 
        content={<NodeTooltipContent data={data} />} 
        title={null} 
        trigger="hover"
        overlayClassName="[&_.ant-popover-arrow]:!hidden"
        overlayInnerStyle={{ 
            backgroundColor: '#0f172a', // slate-900
            borderColor: '#334155', // slate-700
            borderWidth: '1px',
            borderStyle: 'solid',
            color: '#e2e8f0', // slate-200
            padding: '12px'
        }}
        placement="right"
        mouseEnterDelay={0.5} // Delay to prevent flickering
    >
    <div
      className={clsx(
        'relative w-52 rounded-lg border transition-all duration-300 backdrop-blur-md p-3',
        selected
          ? 'border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)] bg-slate-800/90'
          : 'border-slate-700 bg-slate-900/80 hover:border-slate-500'
      )}
    >
      {/* WAN Handle (Top) */}
      <Handle
        type="target"
        position={Position.Top}
        id="wan"
        className="!bg-yellow-500 !w-3 !h-1 !rounded-none -top-[5px]"
      />

      <div className="flex items-start gap-3">
        {/* Icon Container */}
        <div className={clsx('p-2 rounded bg-gradient-to-br shadow-lg', gradient)}>
          <Icon size={20} className="text-white" />
        </div>

        {/* Info Section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 truncate max-w-[120px]" title={data.name}>
                {data.name}
              </h3>
              {data.managementPort && (
                  <button 
                    onClick={openManagementUrl}
                    className="p-1 rounded hover:bg-slate-700 text-cyan-400 transition-colors"
                    title={`Open Management UI (${data.managementPort})`}
                  >
                      <ExternalLink size={12} />
                  </button>
              )}
          </div>
          <p
            className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1 cursor-pointer hover:text-cyan-400 transition-colors"
            title="Click to copy IP"
            onClick={handleCopyIp}
          >
            {data.ip || 'No IP'}
            
            {/* Status Indicator */}
            <span className="flex h-1.5 w-1.5 relative ml-auto">
              <span className={clsx(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                data.status === 'offline' ? 'bg-red-400 animate-none' : 
                data.status === 'warning' ? 'bg-yellow-400 animate-ping' : 'bg-emerald-400 animate-ping'
              )}></span>
              <span className={clsx(
                "relative inline-flex rounded-full h-1.5 w-1.5",
                data.status === 'offline' ? 'bg-red-500' : 
                data.status === 'warning' ? 'bg-yellow-500' : 'bg-emerald-500'
              )}></span>
            </span>
          </p>
        </div>
      </div>

      {/* Services / Tags */}
      {data.services && data.services.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.services.map((svc, index) => {
            const hasPorts = svc.ports && svc.ports.length > 0;
            const primaryPort = hasPorts ? svc.ports[0] : undefined;
            
            return (
              <span
                key={index}
                onClick={(e) => handleServiceClick(e, primaryPort)}
                className={clsx(
                  "px-1.5 py-0.5 rounded text-[9px] font-mono border flex items-center gap-1 transition-colors",
                  hasPorts 
                    ? "bg-slate-700 text-cyan-400 border-slate-600 cursor-pointer hover:bg-slate-600 hover:text-cyan-300 hover:border-cyan-500/50" 
                    : "bg-slate-800 text-slate-400 border-slate-700 cursor-default"
                )}
                title={hasPorts ? `Open ${svc.name} (${svc.ports.join(', ')})` : svc.name}
              >
                {svc.name}
                {hasPorts && (
                  <span className={clsx(
                    "text-[8px] border-l pl-1 ml-0.5",
                    hasPorts ? "border-slate-600 text-slate-400 group-hover:text-cyan-300" : "border-slate-700"
                  )}>
                      {svc.ports.length > 1 ? `${svc.ports[0]}+` : svc.ports[0]}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* LAN Handles (Bottom - Distributed) */}
      <div className="absolute -bottom-[5px] left-0 w-full h-1">
         {Array.from({ length: data.interfaceCount ?? 3 }).map((_, index) => {
            const count = data.interfaceCount ?? 3;
            const left = count > 1 
                ? `${(index + 1) * (100 / (count + 1))}%` 
                : '50%';
            
            return (
                <Handle 
                    key={index}
                    type="source" 
                    position={Position.Bottom} 
                    id={`lan${index + 1}`} 
                    className="!bg-slate-400 !w-3 !h-1 !rounded-none !absolute !transform !-translate-x-1/2"
                    style={{ left }}
                />
            );
         })}
      </div>
    </div>
    </Popover>
  );
}
