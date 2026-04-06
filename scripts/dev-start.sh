#!/bin/bash

# NetCraft 本地开发一键启动脚本

set -e

echo "========================================"
echo "NetCraft 本地开发环境启动脚本"
echo "========================================"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装，请先安装 Docker"
echo "   安装教程: https://docs.docker.com/get-docker/"
exit 1
fi

echo "Docker 已安装"

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "错误: Docker Compose 未安装，请先安装 Docker Compose"
echo "   安装教程: https://docs.docker.com/compose/install/"
exit 1
fi

echo "Docker Compose 已安装"

# 检查是否在项目根目录
if [ ! -f "docker-compose.yml" ]; then
    echo "错误: 请在项目根目录执行此脚本"
exit 1
fi

echo "项目根目录检查通过"

# 启动服务
echo "\n启动 NetCraft 服务..."
echo "========================================"

docker-compose up --build
