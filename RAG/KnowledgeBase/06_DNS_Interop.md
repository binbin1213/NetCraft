# DNS 与 Dnsmasq 配合（跨组件场景）

> 本文件从 `02_OpenWRT_Basic.md` 抽出，供跨组件 DNS 问题按需加载。

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
