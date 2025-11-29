import { type Node, type Edge } from 'reactflow';
import { type DeviceData, type EdgeData } from '../types/nodes';

export interface Template {
    id: string;
    nameKey: string; // i18n key
    descriptionKey: string;
    nodes: Node<DeviceData>[];
    edges: Edge<EdgeData>[];
}

export const TEMPLATES: Template[] = [
    {
        id: 'basic_home',
        nameKey: 'templates.basic_home.name',
        descriptionKey: 'templates.basic_home.desc',
        nodes: [
            { id: 't1_modem', type: 'deviceNode', position: { x: 250, y: 50 }, data: { name: 'templates.devices.modem', type: 'modem', ip: '192.168.1.1', status: 'online' } },
            { id: 't1_router', type: 'deviceNode', position: { x: 250, y: 200 }, data: { name: 'templates.devices.main_router', type: 'router', ip: '192.168.2.1', status: 'online' } },
            { id: 't1_pc', type: 'deviceNode', position: { x: 100, y: 350 }, data: { name: 'templates.devices.desktop_pc', type: 'pc', ip: '192.168.2.100', status: 'online' } },
            { id: 't1_ap', type: 'deviceNode', position: { x: 400, y: 350 }, data: { name: 'templates.devices.wifi_ap', type: 'ap', ip: '192.168.2.2', status: 'online' } },
        ],
        edges: [
            { id: 'e1_1', source: 't1_modem', target: 't1_router', type: 'smartEdge', sourceHandle: 'lan1', targetHandle: 'wan', data: { type: 'eth_1g', animated: true } },
            { id: 'e1_2', source: 't1_router', target: 't1_pc', type: 'smartEdge', sourceHandle: 'lan1', targetHandle: 'wan', data: { type: 'eth_1g', animated: true } },
            { id: 'e1_3', source: 't1_router', target: 't1_ap', type: 'smartEdge', sourceHandle: 'lan2', targetHandle: 'wan', data: { type: 'eth_1g', animated: true } },
        ]
    },
    {
        id: 'advanced_homelab',
        nameKey: 'templates.advanced_homelab.name',
        descriptionKey: 'templates.advanced_homelab.desc',
        nodes: [
            { id: 't2_modem', type: 'deviceNode', position: { x: 300, y: 0 }, data: { name: 'templates.devices.isp_modem', type: 'modem', ip: 'Public IP', status: 'online' } },
            { id: 't2_router', type: 'deviceNode', position: { x: 300, y: 150 }, data: { name: 'templates.devices.soft_router', type: 'router', ip: '10.0.0.1', status: 'online' } },
            { id: 't2_switch', type: 'deviceNode', position: { x: 300, y: 300 }, data: { name: 'templates.devices.switch_2_5g', type: 'switch', ip: '10.0.0.2', status: 'online' } },
            { id: 't2_pve', type: 'deviceNode', position: { x: 100, y: 450 }, data: { name: 'templates.devices.pve', type: 'pve', ip: '10.0.0.10', status: 'online' } },
            { id: 't2_nas', type: 'deviceNode', position: { x: 500, y: 450 }, data: { name: 'templates.devices.unraid_nas', type: 'unraid', ip: '10.0.0.20', status: 'online' } },
            { id: 't2_vm1', type: 'deviceNode', position: { x: 0, y: 600 }, data: { name: 'templates.devices.ubuntu_docker', type: 'vm_linux', ip: '10.0.0.101', status: 'online' } },
            { id: 't2_vm2', type: 'deviceNode', position: { x: 200, y: 600 }, data: { name: 'templates.devices.windows_11', type: 'vm_windows', ip: '10.0.0.102', status: 'online' } },
        ],
        edges: [
            { id: 'e2_1', source: 't2_modem', target: 't2_router', type: 'smartEdge', sourceHandle: 'lan1', targetHandle: 'wan', data: { type: 'eth_1g', animated: true } },
            { id: 'e2_2', source: 't2_router', target: 't2_switch', type: 'smartEdge', sourceHandle: 'lan1', targetHandle: 'wan', data: { type: 'eth_10g', animated: true } },
            { id: 'e2_3', source: 't2_switch', target: 't2_pve', type: 'smartEdge', sourceHandle: 'lan1', targetHandle: 'wan', data: { type: 'eth_2.5g', animated: true } },
            { id: 'e2_4', source: 't2_switch', target: 't2_nas', type: 'smartEdge', sourceHandle: 'lan2', targetHandle: 'wan', data: { type: 'eth_2.5g', animated: true } },
            { id: 'e2_5', source: 't2_pve', target: 't2_vm1', type: 'smartEdge', sourceHandle: 'lan1', targetHandle: 'wan', data: { type: 'eth_10g', animated: true } },
            { id: 'e2_6', source: 't2_pve', target: 't2_vm2', type: 'smartEdge', sourceHandle: 'lan1', targetHandle: 'wan', data: { type: 'eth_10g', animated: true } },
        ]
    }
];
