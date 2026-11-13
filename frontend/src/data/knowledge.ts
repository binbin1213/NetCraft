/**
 * Structured facts extracted from RAG/KnowledgeBase/*.md.
 *
 * Every entry carries a `source` pointing at the originating document plus a
 * verbatim `quote`. `__tests__/knowledge.test.ts` re-reads the markdown and
 * asserts each quote is still present, so the data cannot silently drift from
 * the documents the way the old 审查报告.md did.
 *
 * Keep quotes short but unmistakable; they are matched after whitespace
 * normalisation, not fuzzy search.
 */

export interface SourceRef {
  /** Document file name under RAG/KnowledgeBase/. */
  file: string;
  /** Verbatim sentence or fragment that supports this fact. */
  quote: string;
}

export interface ServiceEndpoint {
  id: string;
  name: string;
  /** Default listening ports, as strings to match DeviceData.service.ports. */
  ports: string[];
  /**
   * Ports this service takes over when it displaces another component,
   * e.g. dnsmasq moves to 5353 when AdGuard Home claims 53.
   */
  fallbackPorts?: string[];
  /** Device types this service typically runs on. */
  runsOn: string[];
  note: string;
  source: SourceRef;
}

/** Ports that the DNS stack competes for, used by the conflict check. */
export const DNS_STACK_SERVICES = ['dnsmasq', 'adguardhome', 'openclash'] as const;

export const SERVICE_CATALOG: ServiceEndpoint[] = [
  {
    id: 'dnsmasq',
    name: 'dnsmasq',
    ports: ['53'],
    fallbackPorts: ['5353'],
    runsOn: ['router', 'vm_openwrt'],
    note: 'OpenWrt 默认 DNS/DHCP 服务；与 AdGuard Home 同机会抢占 53 端口。',
    source: {
      file: '02_OpenWRT_Basic.md',
      quote: "option port '53'        # 监听标准 DNS 端口",
    },
  },
  {
    id: 'dnsmasq-shifted',
    name: 'dnsmasq (让位模式)',
    ports: ['5353'],
    runsOn: ['router', 'vm_openwrt'],
    note: 'AdGuard Home 接管 53 后，dnsmasq 退到 5353 继续提供内网主机名解析。',
    source: {
      file: '02_OpenWRT_Basic.md',
      quote: "option port '5353'   # 改为非 53 端口",
    },
  },
  {
    id: 'adguardhome',
    name: 'AdGuard Home',
    ports: ['53', '3000', '80', '443', '853'],
    runsOn: ['router', 'vm_openwrt', 'server', 'pve', 'unraid'],
    note: 'DNS 层的广告拦截；安装向导默认在 3000 端口。',
    source: {
      file: '04_AdGuardHome.md',
      quote: '浏览器打开 `http://路由器IP:3000`',
    },
  },
  {
    id: 'openclash',
    name: 'OpenClash',
    ports: ['53'],
    runsOn: ['router', 'vm_openwrt'],
    note: '开启本地 DNS 劫持后会接管 53 端口，与 AdGuard Home 需要额外规划顺序。',
    source: {
      file: '03_OpenClash_Config.md',
      quote: '这会强制局域网内的所有 DNS 请求（端口 53）都经过 OpenClash 处理',
    },
  },
  {
    id: 'dot',
    name: 'DoT (DNS over TLS)',
    ports: ['853'],
    runsOn: ['router', 'vm_openwrt', 'server'],
    note: '加密 DNS 上游，用于防止运营商 DNS 污染。',
    source: {
      file: '03_OpenClash_Config.md',
      quote: 'tls://8.8.8.8:853',
    },
  },
];

/** A conflict rule: two services that cannot share a host port without setup. */
export interface PortConflictRule {
  a: string;
  b: string;
  /** The contested port. */
  port: string;
  /** Human-readable resolution, taken from the docs. */
  resolution: string;
  source: SourceRef;
}

export const PORT_CONFLICT_RULES: PortConflictRule[] = [
  {
    a: 'adguardhome',
    b: 'dnsmasq',
    port: '53',
    resolution: '将 AdGuard Home 保留在 53，把 dnsmasq 改到 5353（/etc/config/dhcp）。',
    source: {
      file: '04_AdGuardHome.md',
      quote: '如果您的 OpenWrt 上已经运行了 Dnsmasq，它也占用了 53 端口',
    },
  },
  {
    a: 'adguardhome',
    b: 'openclash',
    port: '53',
    resolution: '只能有一个组件监听 53：让 AdGuard Home 作上游，OpenClash 处理分流，或反之。',
    source: {
      file: '03_OpenClash_Config.md',
      quote: '建议先停用其他 DNS 插件，让 OpenClash 接管 DNS',
    },
  },
  {
    a: 'openclash',
    b: 'dnsmasq',
    port: '53',
    resolution: 'OpenClash 劫持 53 时，dnsmasq 需退到 5353 或交由 OpenClash 接管解析。',
    source: {
      file: '03_OpenClash_Config.md',
      quote: '这会强制局域网内的所有 DNS 请求（端口 53）都经过 OpenClash 处理',
    },
  },
];

/** IP allocation ranges recommended by the architecture guide. */
export interface IpRange {
  id: string;
  label: string;
  /** Inclusive last-octet bounds. */
  from: number;
  to: number;
  source: SourceRef;
}

export const IP_PLAN: IpRange[] = [
  {
    id: 'core',
    label: '网络核心',
    from: 1,
    to: 10,
    source: { file: '01_Network_Architecture.md', quote: '| **网络核心** | .1 - .10 |' },
  },
  {
    id: 'infra',
    label: '网络设施',
    from: 11,
    to: 20,
    source: { file: '01_Network_Architecture.md', quote: '| **网络设施** | .11 - .20 |' },
  },
  {
    id: 'servers',
    label: '服务器/NAS',
    from: 21,
    to: 50,
    source: { file: '01_Network_Architecture.md', quote: '| **服务器/NAS** | .21 - .50 |' },
  },
  {
    id: 'dhcp',
    label: 'DHCP 动态分配',
    from: 100,
    to: 200,
    source: { file: '01_Network_Architecture.md', quote: '| **DHCP 动态分配** | .100 - .200 |' },
  },
  {
    id: 'iot',
    label: '智能家居',
    from: 201,
    to: 250,
    source: { file: '01_Network_Architecture.md', quote: '| **智能家居** | .201 - .250 |' },
  },
];

/** Which plan range a device class should land in. */
export const DEVICE_IP_ZONE: Record<string, string> = {
  router: 'core',
  firewall: 'core',
  modem: 'core',
  switch: 'infra',
  ap: 'infra',
  server: 'servers',
  pve: 'servers',
  esxi: 'servers',
  unraid: 'servers',
  vm_windows: 'servers',
  vm_linux: 'servers',
  vm_openwrt: 'servers',
  pc: 'dhcp',
};

export const findIpRange = (lastOctet: number): IpRange | undefined =>
  IP_PLAN.find((r) => lastOctet >= r.from && lastOctet <= r.to);
