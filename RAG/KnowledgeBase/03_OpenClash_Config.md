# OpenClash 全面配置指南

OpenClash 是一个运行在 OpenWrt 上的 Clash 客户端，它允许用户通过复杂的规则集来管理网络流量。本指南将详细介绍 OpenClash 的安装、基础配置、运行模式、DNS 设置以及高级规则管理。

## 1. 安装与初始化

### 1.1 依赖安装与 IPK 安装
在安装 OpenClash 之前，需要确保系统已安装必要的依赖。

```bash
# 1. 安装必要依赖
opkg update
opkg install luci luci-base iptables dnsmasq-full coreutils coreutils-nohup bash curl jsonfilter ca-certificates ipset ip-full iptables-mod-tproxy kmod-tun

# 2. 如果您使用的是 OpenWrt 19.07 或更高版本，还需要安装 luci-compat
opkg install luci-compat

# 3. 上传并安装 OpenClash IPK (假设文件名为 luci-app-openclash_*.ipk)
# 将文件上传至 /tmp 目录
opkg install /tmp/luci-app-openclash_*.ipk
```

### 1.2 内核下载
OpenClash 需要 Clash 内核才能运行。IPK 安装通常不包含内核。
1. **自动下载**：安装完成后，进入 OpenClash 界面，插件会尝试自动下载内核。
2. **手动下载**：
   - 下载 `Clash` 内核文件。
   - 解压并上传至 `/etc/openclash/core/clash`。
   - 赋予执行权限：`chmod +x /etc/openclash/core/clash`。

---

## 2. 基础配置与订阅

### 2.1 导入配置文件（订阅）
这是最常用的配置方式，通过导入机场提供的订阅链接来获取节点和规则。

1. 进入 **配置订阅 (Config Subscribe)** 页面。
2. 点击 **添加 (Add)**。
3. 输入 **配置文件名 (Config Name)**（任意起名）。
4. 在 **订阅地址 (Subscribe URL)** 中粘贴您的 Clash/V2Ray/SSR 订阅链接。
5. 勾选 **自动更新 (Auto Update)** 以保持节点最新。
6. 点击 **保存配置 (Save Configuration)** 并 **更新配置 (Update Config)**。

### 2.2 启动 OpenClash
1. 进入 **运行状态 (Overview)** 页面。
2. 点击 **启动 OpenClash (Start OpenClash)**。
3. 确保状态栏显示 "OpenClash 运行中"。

---

## 3. 运行模式详解

OpenClash 支持多种运行模式，选择合适的模式对于网络性能至关重要。

### 3.1 Fake-IP（增强）模式 —— **推荐**
- **工作原理**：当客户端发起 DNS 请求时，OpenClash 立即返回一个保留地址（如 198.18.0.1）。同时，OpenClash 在后台向真实 DNS 服务器查询。如果命中代理规则，则直接将域名发送给代理服务器解析。
- **优点**：DNS 响应极快，显著减少网页加载延迟；防止 DNS 污染。
- **缺点**：部分不支持非标准 IP 的设备（如某些智能家居）可能会有问题。

### 3.2 Redir-Host（兼容）模式
- **工作原理**：客户端发起 DNS 请求时，OpenClash 并发查询 DNS，等待真实 IP 返回后再进行规则匹配。
- **优点**：兼容性最好，返回真实 IP。
- **缺点**：DNS 解析速度受限于上游 DNS 服务器，可能较慢；容易受 DNS 污染影响。

### 3.3 TUN 模式
- 能够代理所有流量（包括 UDP），适合游戏加速。
- 需要内核支持 `kmod-tun`。

> **建议**：绝大多数用户应首选 **Fake-IP（增强）模式**。如果有特定的内网穿透或游戏需求，可尝试 TUN 模式。

---

## 4. DNS 设置与防污染

DNS 是翻墙环境中最容易出问题的环节。OpenClash 自带 DNS 劫持功能。

### 4.1 本地 DNS 劫持
默认情况下，应 **启用** 本地 DNS 劫持。这会强制局域网内的所有 DNS 请求（端口 53）都经过 OpenClash 处理。

### 4.2 推荐 DNS 服务器配置
在 **全局设置 -> DNS 设置** 中：

**针对 Fake-IP 模式的推荐设置：**
```yaml
nameserver:
  - 114.114.114.114
  - 223.5.5.5
fallback:
  - tls://8.8.8.8:853
  - tls://1.1.1.1:853
  - https://dns.google/dns-query
```
- **NameServer**：用于解析国内域名，速度快。
- **Fallback**：用于解析国外域名，使用加密 DNS（DoT/DoH）防止污染。

---

## 5. 规则与策略组管理

### 5.1 策略组 (Proxy Groups)
策略组决定了流量的去向。常见的策略组有：
- **PROXY**：手动选择节点。
- **AUTO**：自动选择延迟最低的节点。
- **Domestic**：国内流量，通常直连。
- **Others/Final**：未匹配规则的漏网之鱼，通常走代理。

### 5.2 自定义规则 (Access Control)
如果您想强制某个域名走特定线路，可以在 **规则设置 (Rules)** 或 **自定义规则** 中添加：

```yaml
# 语法：类型,域名/IP,策略组

# 1. 强制 google.com 走代理
DOMAIN-SUFFIX,google.com,PROXY

# 2. 强制百度直连
DOMAIN-SUFFIX,baidu.com,DIRECT

# 3. 屏蔽广告域名
DOMAIN-SUFFIX,ad.com,REJECT

# 4. 局域网设备直连（不走代理）
SRC-IP-CIDR,192.168.1.20/32,DIRECT
```

---

## 6. 常见问题排查 (Troubleshooting)

### 6.1 无法上网
- 检查 **运行状态**，确认内核是否启动。
- 检查 **Yacd/Dashboard** 控制面板，确认是否选择了有效的节点。
- 检查 **系统时间**，时间不准会导致 V2Ray/Trojan 节点连接失败。

### 6.2 DNS 泄露
- 确保启用了 **Fake-IP** 模式。
- 检查是否有多余的 DNS 插件（如 SmartDNS）与 OpenClash 冲突。如果有，建议先停用其他 DNS 插件，让 OpenClash 接管 DNS。

### 6.3 访问国内网站慢
- 检查分流规则。确保国内域名命中了 `DIRECT` 或 `Domestic` 策略组，而不是走了代理。
- 检查 GEOIP 数据库是否更新。

---

**总结**：OpenClash 是一个强大的工具。对于新手，建议使用 **Fake-IP 模式** + **机场托管配置** 即可满足 90% 的需求。进阶用户可以通过自定义规则和 DNS 分流来实现更精细的控制。
