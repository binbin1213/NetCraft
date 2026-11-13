import { type Node, type Edge } from 'reactflow';
import { type DeviceData, type EdgeData } from '../types/nodes';

export interface Template {
    id: string;
    nameKey: string; // i18n key
    descriptionKey: string;
    /** Optional note explaining where the design comes from. */
    noteKey?: string;
    nodes: Node<DeviceData>[];
    edges: Edge<EdgeData>[];
}

/**
 * Built-in topologies.
 *
 * Constraint: every template must produce zero `error`-severity issues from
 * `analyzeTopology()` — they are reference answers, and a reference answer that
 * fails its own checks is worse than none. See templates.test.ts.
 *
 * IP addresses follow the plan in RAG/KnowledgeBase/01_Network_Architecture.md:
 *   .1-.10 core, .11-.20 infra, .21-.50 servers, .100-.200 DHCP, .201-.250 IoT
 */
const edge = (
  id: string,
  source: string,
  target: string,
  type: EdgeData['type'] = 'eth_1g',
  sourceHandle = 'lan1'
): Edge<EdgeData> => ({
  id,
  source,
  target,
  type: 'smartEdge',
  sourceHandle,
  targetHandle: 'wan',
  data: { type, animated: true },
});

export const TEMPLATES: Template[] = [
    {
        id: 'basic_home',
        nameKey: 'templates.basic_home.name',
        descriptionKey: 'templates.basic_home.desc',
        noteKey: 'templates.basic_home.note',
        nodes: [
            // Bridged modem: no LAN IP of its own, single NAT is on the router.
            { id: 't1_modem', type: 'deviceNode', position: { x: 250, y: 40 }, data: { name: 'templates.devices.bridged_modem', type: 'modem', ip: '', status: 'online' } },
            { id: 't1_router', type: 'deviceNode', position: { x: 250, y: 180 }, data: { name: 'templates.devices.main_router', type: 'router', ip: '192.168.1.1', interfaceCount: 4, managementPort: '80', status: 'online', services: [{ name: 'dnsmasq', ports: ['53'] }] } },
            { id: 't1_ap', type: 'deviceNode', position: { x: 440, y: 320 }, data: { name: 'templates.devices.wifi_ap', type: 'ap', ip: '192.168.1.12', interfaceCount: 1, status: 'online' } },
            { id: 't1_pc', type: 'deviceNode', position: { x: 60, y: 320 }, data: { name: 'templates.devices.desktop_pc', type: 'pc', ip: '192.168.1.100', status: 'online' } },
        ],
        edges: [
            edge('e1_1', 't1_modem', 't1_router', 'eth_1g'),
            edge('e1_2', 't1_router', 't1_ap', 'eth_1g', 'lan1'),
            edge('e1_3', 't1_router', 't1_pc', 'eth_1g', 'lan2'),
        ]
    },
    {
        id: 'bypass_router',
        nameKey: 'templates.bypass_router.name',
        descriptionKey: 'templates.bypass_router.desc',
        noteKey: 'templates.bypass_router.note',
        nodes: [
            { id: 't3_modem', type: 'deviceNode', position: { x: 250, y: 40 }, data: { name: 'templates.devices.bridged_modem', type: 'modem', ip: '', status: 'online' } },
            { id: 't3_main', type: 'deviceNode', position: { x: 250, y: 180 }, data: { name: 'templates.devices.main_router', type: 'router', ip: '192.168.1.1', interfaceCount: 2, status: 'online', services: [{ name: 'dnsmasq', ports: ['53'] }] } },
            // 旁路由: DHCP disabled, LAN clients point gateway/DNS here explicitly.
            { id: 't3_bypass', type: 'deviceNode', position: { x: 480, y: 320 }, data: { name: 'templates.devices.bypass_node', type: 'vm_openwrt', ip: '192.168.1.2', interfaceCount: 1, managementPort: '80', status: 'online', services: [{ name: 'OpenClash', ports: ['53'] }] } },
            { id: 't3_pc', type: 'deviceNode', position: { x: 60, y: 320 }, data: { name: 'templates.devices.desktop_pc', type: 'pc', ip: '192.168.1.100', gateway: '192.168.1.2', dns: '192.168.1.2', status: 'online' } },
        ],
        edges: [
            edge('e3_1', 't3_modem', 't3_main', 'eth_1g'),
            edge('e3_2', 't3_main', 't3_bypass', 'eth_2.5g', 'lan1'),
            edge('e3_3', 't3_main', 't3_pc', 'eth_1g', 'lan2'),
        ]
    },
    {
        id: 'dns_stack',
        nameKey: 'templates.dns_stack.name',
        descriptionKey: 'templates.dns_stack.desc',
        noteKey: 'templates.dns_stack.note',
        nodes: [
            { id: 't4_modem', type: 'deviceNode', position: { x: 250, y: 30 }, data: { name: 'templates.devices.bridged_modem', type: 'modem', ip: '', status: 'online' } },
            // AdGuard Home owns 53; dnsmasq is deliberately on 5353.
            { id: 't4_router', type: 'deviceNode', position: { x: 250, y: 170 }, data: { name: 'templates.devices.dns_router', type: 'router', ip: '192.168.1.1', interfaceCount: 3, managementPort: '3000', status: 'online', services: [
                { name: 'AdGuard Home', ports: ['53', '3000'] },
                { name: 'dnsmasq (5353)', ports: ['5353'] },
            ] } },
            { id: 't4_switch', type: 'deviceNode', position: { x: 250, y: 310 }, data: { name: 'templates.devices.switch_2_5g', type: 'switch', ip: '192.168.1.11', interfaceCount: 8, status: 'online' } },
            { id: 't4_ap', type: 'deviceNode', position: { x: 470, y: 450 }, data: { name: 'templates.devices.wifi_ap', type: 'ap', ip: '192.168.1.12', interfaceCount: 1, status: 'online' } },
            { id: 't4_pc', type: 'deviceNode', position: { x: 60, y: 450 }, data: { name: 'templates.devices.desktop_pc', type: 'pc', ip: '192.168.1.100', status: 'online' } },
        ],
        edges: [
            edge('e4_1', 't4_modem', 't4_router', 'eth_1g'),
            edge('e4_2', 't4_router', 't4_switch', 'eth_2.5g'),
            edge('e4_3', 't4_switch', 't4_ap', 'eth_1g', 'lan1'),
            edge('e4_4', 't4_switch', 't4_pc', 'eth_2.5g', 'lan2'),
        ]
    },
    {
        id: 'advanced_homelab',
        nameKey: 'templates.advanced_homelab.name',
        descriptionKey: 'templates.advanced_homelab.desc',
        noteKey: 'templates.advanced_homelab.note',
        nodes: [
            { id: 't2_modem', type: 'deviceNode', position: { x: 320, y: 20 }, data: { name: 'templates.devices.bridged_modem', type: 'modem', ip: '', status: 'online' } },
            { id: 't2_router', type: 'deviceNode', position: { x: 320, y: 150 }, data: { name: 'templates.devices.soft_router', type: 'router', ip: '10.0.0.1', interfaceCount: 3, status: 'online', services: [{ name: 'dnsmasq', ports: ['53'] }] } },
            { id: 't2_switch', type: 'deviceNode', position: { x: 320, y: 290 }, data: { name: 'templates.devices.switch_2_5g', type: 'switch', ip: '10.0.0.11', interfaceCount: 8, status: 'online' } },
            { id: 't2_pve', type: 'deviceNode', position: { x: 110, y: 430 }, data: { name: 'templates.devices.pve', type: 'pve', ip: '10.0.0.21', interfaceCount: 2, managementPort: '8006', status: 'online', services: [] } },
            { id: 't2_nas', type: 'deviceNode', position: { x: 540, y: 430 }, data: { name: 'templates.devices.unraid_nas', type: 'unraid', ip: '10.0.0.22', interfaceCount: 1, managementPort: '80', status: 'online', services: [] } },
            { id: 't2_vm1', type: 'deviceNode', position: { x: 60, y: 580 }, data: { name: 'templates.devices.ubuntu_docker', type: 'vm_linux', ip: '10.0.0.31', status: 'online', services: [] } },
            { id: 't2_vm2', type: 'deviceNode', position: { x: 260, y: 580 }, data: { name: 'templates.devices.windows_11', type: 'vm_windows', ip: '10.0.0.32', status: 'online', services: [] } },
        ],
        edges: [
            edge('e2_1', 't2_modem', 't2_router', 'eth_1g'),
            edge('e2_2', 't2_router', 't2_switch', 'eth_2.5g'),
            edge('e2_3', 't2_switch', 't2_pve', 'eth_2.5g', 'lan1'),
            edge('e2_4', 't2_switch', 't2_nas', 'eth_2.5g', 'lan2'),
            edge('e2_5', 't2_pve', 't2_vm1', 'eth_10g'),
            edge('e2_6', 't2_pve', 't2_vm2', 'eth_10g'),
        ]
    },
];
