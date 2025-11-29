# AdGuard Home 配置指南

AdGuard Home 是一款全网广告拦截与反跟踪软件。作为 DNS 服务器，它将广告流量在网络层拦截，无需在每台设备上安装软件。

## 1. 安装与部署

### 1.1 快速安装 (Linux/OpenWrt)
推荐使用官方脚本或二进制文件安装。

```bash
# 自动安装脚本 (支持 Linux/macOS)
curl -s -S -L https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/scripts/install.sh | sh -s -- -v
```

**OpenWrt 用户注意**：
OpenWrt 通常存储空间有限，建议将工作目录设置在扩容后的分区（如 `/overlay` 或外挂 USB）。
或者直接使用 LuCI 插件：`luci-app-adguardhome`。

### 1.2 Docker 安装
```bash
docker run --name adguardhome\
    --restart unless-stopped\
    -v /my/own/workdir:/opt/adguardhome/work\
    -v /my/own/confdir:/opt/adguardhome/conf\
    -p 53:53/tcp -p 53:53/udp\
    -p 80:80/tcp -p 3000:3000/tcp\
    -p 443:443/tcp -p 443:443/udp\
    -p 853:853/tcp\
    -d adguard/adguardhome
```

---

## 2. 初始化配置

1. **访问安装向导**：浏览器打开 `http://路由器IP:3000`。
2. **端口冲突解决**：
   - AdGuard Home 需要占用 **53** 端口作为 DNS 服务器。
   - 如果您的 OpenWrt 上已经运行了 Dnsmasq，它也占用了 53 端口。
   - **解决方案**：将 AdGuard Home 的 DNS 端口设置为 **53**，而将 OpenWrt 的 Dnsmasq 端口改为 **5353** (在 `/etc/config/dhcp` 中修改)。

---

## 3. 上游 DNS 配置 (关键)

为了防止 DNS 污染并保护隐私，建议使用加密 DNS (DoT/DoH/DoQ)。

### 3.1 推荐上游 DNS
在 **设置 -> DNS 设置 -> 上游 DNS 服务器** 中填入：

```
# 阿里 DNS (DoH)
https://dns.alidns.com/dns-query

# 腾讯 DNS (DoH)
https://doh.pub/dns-query

# Google (DoH) - 需配合代理使用
https://dns.google/dns-query

# Cloudflare (DoH) - 需配合代理使用
https://cloudflare-dns.com/dns-query
```

### 3.2 Bootstrap DNS
用于解析上述 DoH 域名的 IP。建议填入当地运营商的 DNS IP 或公共 DNS IP (如 `114.114.114.114`)。

### 3.3 私人反向 DNS (Private Reverse DNS)
如果您希望在 AdGuard Home 中看到内网设备的名称（而不是只有 IP），需要配置此项。
填入路由器的 IP（如 `192.168.1.1:5353`），让 AdGuard Home 向 Dnsmasq 查询内网主机名。

---

## 4. 过滤器与黑名单

### 4.1 添加拦截列表
在 **过滤器 -> DNS 封锁清单** 中添加规则。
- **AdGuard DNS filter**: 官方基础规则。
- **Anti-AD**: 中文区效果很好的规则。
- **EasyList China**: 针对中文网站的广告规则。

### 4.2 自定义过滤规则 (Custom Rules)
支持 Adblock 语法：

```adblock
# 1. 拦截特定域名及其子域名
||example.com^

# 2. 放行特定域名 (白名单)
@@||good-site.com^

# 3. 针对特定客户端拦截
||tiktok.com^$client='Kids_iPad'

# 4. DNS 重写 (类似 Hosts)
# 将 mynas.local 解析到 192.168.1.100
||mynas.local^$dnsrewrite=192.168.1.100
```

---

## 5. 客户端管理

AdGuard Home 可以针对不同设备应用不同的策略（例如：给孩子的 iPad 开启“成人内容屏蔽”，而大人的电脑不开启）。

1. **识别客户端**：
   - 如果 AdGuard Home 直接作为 DHCP 服务器，它可以自动识别设备名。
   - 如果 AdGuard Home 仅作为 DNS，建议通过“私人反向 DNS”指向主路由来获取设备名。

2. **添加客户端**：
   在 **设置 -> 客户端设置** 中，可以手动绑定 IP、MAC 地址到特定的名字，并配置独立的拦截规则和服务封锁（如一键屏蔽 YouTube、TikTok 等）。

---

## 6. 常见问题

### 6.1 无法拦截视频广告
由于视频网站（如 YouTube, 优酷）广告通常与正片使用相同的 CDN 域名，DNS 过滤很难在不影响观看的情况下精准拦截。建议配合浏览器插件（如 uBlock Origin）使用。

### 6.2 网页加载慢
- 检查上游 DNS 的延迟。
- 启用 **DNS 缓存** (设置 -> DNS 设置 -> DNS 缓存配置)。
- 尝试开启 **“使用并行请求”** (Parallel requests)，同时向上游查询，取最快结果。
