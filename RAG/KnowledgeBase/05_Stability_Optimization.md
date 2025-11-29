# 网络优化与稳定性维护指南

网络不仅要“能用”，还要“好用”和“稳”。本指南汇集了 OpenWrt 长期稳定运行的最佳实践。

## 1. 基础稳定性优化

### 1.1 定时重启
虽然 Linux 系统理论上不需要重启，但家用路由器的内存较小，且 OpenClash 等插件会占用大量内存。建议设置定时重启以释放资源。

**设置方法**：
在 **系统 -> 计划任务** 中添加：
```bash
# 每天凌晨 4:30 重启
30 4 * * * reboot
```

### 1.2 看门狗 (Watchcat)
OpenWrt 自带的 `watchcat` 插件可以监控网络连接。如果断网超过一定时间，自动重启网络接口或路由器。

1. 安装：`opkg install watchcat`
2. 配置：在 **服务 -> Watchcat** 中，设置检测 IP (如 `114.114.114.114`) 和检测周期。

---

## 2. 无线 (Wi-Fi) 优化

### 2.1 信道选择
- **2.4GHz**：仅使用 **1, 6, 11** 信道。避免使用 40MHz 频宽（干扰太大），强制使用 **20MHz**。
- **5GHz**：
  - 国内建议使用 **149-161** 频段 (高频)，干扰较少。
  - 或者 **36-48** 频段。
  - 避免使用 DFS 频道 (52-64, 100-144)，因为检测到雷达信号时会强制断线。

### 2.2 漫游设置 (802.11r/k/v)
如果有多台 AP 组网，务必开启 **802.11r (快速漫游)**。
- **移动域 (Mobility Domain)**：所有 AP 必须一致。
- **重关联截止时间**：建议 1000ms。

---

## 3. 性能调优

### 3.1 硬件卸载 (Hardware Offloading)
在 **网络 -> 防火墙 -> 路由/NAT 分流** 中：
- 勾选 **软件流量分流 (Software flow offloading)**。
- 勾选 **硬件流量分流 (Hardware flow offloading)** (如果硬件支持)。
> **注意**：开启流量分流可能会导致 QoS (SQM) 失效。如果你依赖 SQM 进行流控，请关闭此选项。

### 3.2 TCP BBR 拥塞控制
BBR 算法可以显著提升弱网环境下的吞吐量。

**开启方法**：
编辑 `/etc/sysctl.conf`，添加：
```conf
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
```
保存后执行 `sysctl -p` 生效。

---

## 4. DNS 深度防污染

如果发现即使开启了 OpenClash 仍有部分网站无法打开，可能是 DNS 缓存中毒。

1. **清除本地缓存**：
   - Windows: `ipconfig /flushdns`
   - macOS: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`

2. **强制丢弃 AAAA 记录**：
   部分国内运营商的 IPv6 路由不佳，导致连接缓慢。可以在 AdGuard Home 中开启“丢弃 AAAA 记录”或在 OpenClash 中禁用 IPv6。

3. **检查 MosDNS/SmartDNS**：
   如果使用了多个 DNS 插件串联，容易出现逻辑死循环。建议**做减法**，只保留 OpenClash (Fake-IP) + AdGuard Home 即可，不要过度复杂化。
