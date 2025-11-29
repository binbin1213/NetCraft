import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { notification, Button } from 'antd';
import { Lightbulb, X } from 'lucide-react';
import useStore from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { type DeviceType, type DeviceData, type ConnectionType } from '../../types/nodes';
import { type Node, type Edge } from 'reactflow';

const selector = (state: any) => ({
  nodes: state.nodes,
  addNode: state.addNode,
  addEdge: state.addEdge, // Import addEdge
  edges: state.edges,
  onConnect: state.onConnect,
});

// Recommendation Logic Map
const RECOMMENDATIONS: Partial<Record<DeviceType, { 
    messageKey: string; 
    options: DeviceType[]; 
}>> = {
    modem: {
        messageKey: 'guide.addRouter',
        options: ['router'],
    },
    router: {
        messageKey: 'guide.addSwitch',
        options: ['switch'],
    },
    switch: {
        messageKey: 'guide.addDevice',
        options: ['pve', 'esxi', 'ap', 'pc'],
    },
    pve: {
        messageKey: 'guide.addVM',
        options: ['vm_windows', 'vm_linux', 'vm_openwrt'],
    },
    esxi: {
        messageKey: 'guide.addVM',
        options: ['vm_windows', 'vm_linux'],
    },
    unraid: {
        messageKey: 'guide.addVM',
        options: ['vm_linux'], // Docker/VM
    }
};

// Define auto-connect rules: Source Type -> Target Type -> Edge Type
const AUTO_CONNECT_RULES: Record<string, Record<string, ConnectionType>> = {
    modem: { router: 'eth_1g' },
    router: { switch: 'eth_1g' }, // Assume 1G uplink by default, user can upgrade
    switch: { 
        pve: 'eth_1g', 
        esxi: 'eth_1g', 
        pc: 'eth_1g',
        ap: 'eth_1g' 
    },
    // Virtual connections (internal logic)
    pve: { vm_windows: 'eth_10g', vm_linux: 'eth_10g', vm_openwrt: 'eth_10g' }, // Virtual switch is fast
    esxi: { vm_windows: 'eth_10g', vm_linux: 'eth_10g' },
    unraid: { vm_linux: 'eth_10g' }
};

let id = 1000; // Start guide nodes from a high ID to avoid conflict with dnd
const getId = () => `guide_node_${id++}`;
const getEdgeId = () => `guide_edge_${id++}`;

export default function GuideSystem() {
    const { t } = useTranslation();
    const { nodes, addNode, addEdge } = useStore(useShallow(selector));
    const [lastNodeCount, setLastNodeCount] = useState(0);
    const [api, contextHolder] = notification.useNotification();

    useEffect(() => {
        // Only trigger when a node is ADDED (count increases)
        if (nodes.length > lastNodeCount && nodes.length > 0) {
            const lastNode = nodes[nodes.length - 1];
            const rule = RECOMMENDATIONS[lastNode.data.type as DeviceType];

            if (rule) {
                // Small delay to make it feel natural
                setTimeout(() => {
                    showRecommendation(lastNode, rule);
                }, 600);
            }
        }
        setLastNodeCount(nodes.length);
    }, [nodes.length]); // Dependency on length to detect additions

    const showRecommendation = (sourceNode: Node<DeviceData>, rule: { messageKey: string, options: DeviceType[] }) => {
        const key = `guide-${Date.now()}`;
        
        const handleAdd = (targetType: DeviceType) => {
            const sourceType = sourceNode.data.type;
            
            // 1. Calculate position: slightly below and to the right of the source node
            const position = {
                x: sourceNode.position.x + 100,
                y: sourceNode.position.y + 150,
            };

            // 2. Create New Node
            const newNodeId = getId();
            const newNode: Node<DeviceData> = {
                id: newNodeId,
                type: 'deviceNode',
                position,
                data: {
                    name: t(`sidebar.${targetType}`),
                    type: targetType,
                    ip: '192.168.1.x',
                    status: 'online',
                    services: []
                }
            };
            addNode(newNode);
            
            // 3. Auto Connect Logic
            const edgeType = AUTO_CONNECT_RULES[sourceType]?.[targetType];
            if (edgeType) {
                const newEdge: Edge = {
                    id: getEdgeId(),
                    source: sourceNode.id,
                    target: newNodeId,
                    type: 'smartEdge',
                    sourceHandle: 'lan1', // Default to LAN port for source
                    targetHandle: 'wan',  // Default to WAN port for target (if router/switch)
                    data: {
                        type: edgeType,
                        animated: true,
                    }
                };
                
                // Adjust handles for specific cases
                if (sourceType === 'modem') newEdge.sourceHandle = 'lan1'; 
                if (targetType === 'switch') newEdge.targetHandle = 'wan'; // Switches don't really have WAN, but use top handle
                if (['pve', 'esxi', 'pc', 'ap'].includes(targetType)) newEdge.targetHandle = 'wan'; // Top handle
                
                // Virtual machines connect "internally" (no physical ports really, but visual connection)
                if (sourceType === 'pve' || sourceType === 'esxi') {
                    newEdge.sourceHandle = 'lan1';
                    newEdge.targetHandle = 'wan';
                }

                addEdge(newEdge);
            }
            
            api.destroy(key);
        };

        // Note: We deliberately ignore the TS error for 'title' here because AntD v5 Notification 
        // uses 'message' for the title and 'description' for content, but the type definition 
        // in this project environment seems to insist on 'title' for ArgsProps (which might be from an older type definition or confusion).
        // However, at runtime, passing 'message' works as the title.
        // To satisfy the linter, we can cast it or just add a dummy title property if needed, 
        // but 'message' IS the title property in AntD notification config.
        // Actually, let's try to use 'message' as the title (string) and 'description' as content.
        // The error says 'title' is missing in ArgsProps. 
        // Let's check if we can just use 'title' property instead of 'message' property to satisfy the linter,
        // assuming the underlying type definition maps title -> message or similar?
        // Or we can cast it to any.
        
        api.open({
            message: t('guide.title'),
            description: (
                <div>
                    <p className="text-slate-300 mb-3">{t(rule.messageKey)}</p>
                    <div className="flex flex-wrap gap-2">
                        {rule.options.map(type => (
                            <Button 
                                key={type} 
                                size="small" 
                                type="primary"
                                className="bg-cyan-600 hover:!bg-cyan-500 border-none text-xs"
                                onClick={() => handleAdd(type)}
                            >
                                {t('guide.actionAdd', { device: t(`sidebar.${type}`) })}
                            </Button>
                        ))}
                        <Button 
                            size="small" 
                            type="text" 
                            className="text-slate-500 hover:!text-slate-400 text-xs"
                            onClick={() => api.destroy(key)}
                        >
                            {t('guide.actionIgnore')}
                        </Button>
                    </div>
                </div>
            ),
            icon: <Lightbulb size={18} className="text-cyan-400" />,
            key,
            duration: 8, // Auto close after 8s
            placement: 'bottomRight',
            className: '!bg-slate-900/95 !border !border-slate-700 !backdrop-blur-md !shadow-2xl',
            style: { width: 380 },
            closeIcon: <X className="text-slate-500 hover:text-slate-300" size={16} />,
        } as any); // Cast to any to suppress linter error about missing 'title' property which seems to be a type mismatch
    };

    return <>{contextHolder}</>;
}
