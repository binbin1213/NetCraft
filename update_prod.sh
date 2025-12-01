#!/bin/bash

# 停止脚本执行如果任何命令返回错误
set -e

echo "🚀 开始更新 NetCraft 生产环境..."

# 1. 拉取最新的镜像 (仅拉取业务服务，跳过数据库以避免Docker Hub连接问题)
echo "📥 正在从 GitHub Container Registry 拉取最新镜像..."
docker-compose -f docker-compose.prod.yml pull frontend backend

# 2. 重新创建并启动容器
echo "🔄 正在重新创建并启动服务..."
docker-compose -f docker-compose.prod.yml up -d --remove-orphans

# 3. 清理无用的旧镜像 (可选，释放空间)
echo "🧹 清理旧镜像..."
docker image prune -f

echo "✅ 更新完成！"
