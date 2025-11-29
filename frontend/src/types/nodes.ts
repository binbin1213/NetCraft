export type DeviceType = 
  | 'modem' 
  | 'router' 
  | 'switch' 
  | 'pc' 
  | 'server' 
  | 'ap' 
  | 'firewall'
  // Virtualization Hosts
  | 'pve'
  | 'esxi'
  | 'unraid'
  // Virtual Machines / OS
  | 'vm_windows'
  | 'vm_linux'
  | 'vm_openwrt';

export interface Service {
  name: string;
  ports: string[]; // Allow multiple ports, e.g. ["80", "443"] or ["3000"]
}

export interface DeviceData {
  name: string;
  type: DeviceType;
  ip: string;
  status?: 'online' | 'offline' | 'warning';
  
  // Hardware Info
  brand?: string;
  model?: string;
  interfaceCount?: number;
  managementPort?: string; // e.g. "8006", "80", "443"
  dns?: string; // e.g. "192.168.1.1"
  gateway?: string; // e.g. "192.168.1.1"
  
  // System & Specs
  os?: string;
  os_version?: string;
  cpu?: string;
  ram?: string;
  disk?: string;
  
  // Services
  services?: Service[];
}

export type ConnectionType = 'fiber' | 'eth_1g' | 'eth_2.5g' | 'eth_10g' | 'wifi';

export interface EdgeData {
    type: ConnectionType;
    animated?: boolean;
    label?: string;
}
