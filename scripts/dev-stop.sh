#!/bin/bash

# NetCraft 本地开发一键关闭脚本

set -e

echo "========================================"
echo "NetCraft 本地开发环境关闭脚本"
echo "========================================"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装"
exit 1
fi

echo "Docker 已安装"

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "错误: Docker Compose 未安装"
exit 1
fi

echo "Docker Compose 已安装"

# 检查是否在项目根目录
if [ ! -f "docker-compose.yml" ]; then
    echo "错误: 请在项目根目录执行此脚本"
exit 1
fi

echo "项目根目录检查通过"

# 停止服务
echo "\n停止 NetCraft 服务..."
echo "========================================"

docker-compose down

echo "\nNetCraft 服务已成功停止"

# 询问是否清理资源
echo "\n========================================"
echo "可选操作：清理未使用的 Docker 资源"
echo "========================================"
echo "1. 清理未使用的镜像、容器、网络和卷"
echo "2. 仅清理未使用的容器"
echo "3. 跳过清理，保持当前状态"
echo "========================================"

read -p "请选择操作 (1-3): " choice

case $choice in
    1)
        echo "\n清理所有未使用的 Docker 资源..."
        docker system prune -af --volumes
        echo "资源清理完成"
        ;;
    2)
        echo "\n清理未使用的容器..."
        docker container prune -f
        echo "容器清理完成"
        ;;
    3)
        echo "\n跳过资源清理"
        ;;
    *)
        echo "\n无效选择，跳过资源清理"
        ;;
esac

echo "\n========================================"
echo "NetCraft 本地开发环境已关闭"
echo "========================================"
