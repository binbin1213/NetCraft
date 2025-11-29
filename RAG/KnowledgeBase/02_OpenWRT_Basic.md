# OpenWrt 基础配置与维护指南

OpenWrt 是一个高度可定制的嵌入式 Linux 发行版。本指南涵盖了网络接口配置、DHCP/DNS 设置、防火墙管理以及系统维护的核心知识。

## 1. 网络接口配置 (Network Interfaces)

OpenWrt 的网络接口配置位于 `/etc/config/network`。

### 1.1 LAN 接口 (局域网)
定义局域网的基本参数，所有家庭设备都连接到此网络。

```config
config interface 'lan'
    option device 'br-lan'        # 桥接物理网口
    option proto 'static'         # 静态 IP 模式
    option ipaddr '192.168.1.1'   # 路由器管理 IP
    option netmask '255.255.255.0'
    option ip6assign '60'         # IPv6 前缀长度
```

### 1.2 WAN 接口 (互联网)
WAN 口用于连接互联网（光猫）。国内最常见的模式是 PPPoE 拨号。

```config
config interface 'wan'
    option device 'eth1'          # 物理 WAN 口
    option proto 'pppoe'          # 拨号协议
    option username 'your_account'
    option password 'your_password'
    option ipv6 'auto'            # 开启 IPv6 支持
    option peerdns '0'            # 关键：禁止获取运营商 DNS (防污染第一步)
```

> **注意**：如果不禁用 `peerdns`，运营商下发的 DNS 可能会污染您的解析结果，影响翻墙体验。

---

## 2. DHCP 与 DNS (Dnsmasq)

OpenWrt 默认使用 Dnsmasq 提供 DHCP 和 DNS 缓存服务。配置文件位于 `/etc/config/dhcp`。

### 2.1 基础配置
```config
config dnsmasq
    option domainneeded '1'
    option boguspriv '1'
    option port '53'        # 监听标准 DNS 端口
```

### 2.2 与 AdGuard Home/OpenClash 配合 (推荐架构)
如果安装了 AdGuard Home 或 OpenClash，通常需要调整 Dnsmasq 以避免端口冲突，或将流量引导至这些插件。

1. **修改 Dnsmasq 端口**：让出 53 端口给 AdGuard Home。
   ```config
   config dnsmasq
       option port '5353'   # 改为非 53 端口
   ```

2. **DHCP 通告 (DHCP Options)**：强制局域网设备使用路由器的 IP 作为 DNS 服务器。
   ```config
   config dhcp 'lan'
       option interface 'lan'
       list dhcp_option '6,192.168.1.1'  # 6号选项代表 DNS 服务器
       list dhcp_option '3,192.168.1.1'  # 3号选项代表网关
   ```

---

## 3. 防火墙与端口转发 (Firewall)

OpenWrt 防火墙基于区域 (Zones) 管理，配置文件位于 `/etc/config/firewall`。
- **lan**: 内部可信区域 (默认允许转发到 wan)。
- **wan**: 外部不可信区域 (默认拒绝所有入站连接)。

### 3.1 端口转发 (Port Forwarding)
用于从外网访问内网服务 (如 NAS、PT 下载)。

```config
config redirect
    option target 'DNAT'
    option src 'wan'
    option dest 'lan'
    option proto 'tcp'
    option src_dport '5000'       # 外网访问端口
    option dest_ip '192.168.1.100' # 内网设备 IP
    option dest_port '5000'       # 内网服务端口
    option name 'NAS_Web_UI'
```

### 3.2 开放路由器端口 (Traffic Rules)
允许外部访问路由器本身 (如 SSH 或 OpenClash 面板)。

```config
config rule
    option target 'ACCEPT'
    option src 'wan'
    option proto 'tcp'
    option dest_port '22'
    option name 'Allow-SSH-WAN'
```

### 3.3 NAT 环回 (NAT Loopback)
OpenWrt 默认开启 NAT 环回，这允许您在内网也能通过“公网 IP + 端口”访问局域网内的服务。

---

## 4. 系统维护与故障排查

### 4.1 软件包管理 (OPKG)
- **更新软件源**: `opkg update` (安装任何软件前必须执行)
- **安装软件**: `opkg install [软件包名]`
  - 常用工具: `curl`, `wget`, `htop`, `bind-dig` (用于测试 DNS)
- **移除软件**: `opkg remove [软件包名]`

### 4.2 计划任务 (Crontab)
配置文件: `/etc/crontabs/root`。

```bash
# 每天凌晨 4 点重启路由器 (释放内存，保持长期稳定)
0 4 * * * reboot

# 每周一更新广告过滤规则
0 3 * * 1 /usr/bin/update_adblock.sh
```

### 4.3 扩容 (Overlay)
对于存储空间较小的硬路由，建议挂载 USB 存储到 `/overlay` 分区，以扩展安装插件的空间。

### 4.4 常用排查命令
- **查看日志**: `logread` (系统日志), `dmesg` (内核日志)
- **查看负载**: `top` 或 `htop`
- **重启网络**: `/etc/init.d/network restart`
- **检查接口**: `ifstatus wan`
