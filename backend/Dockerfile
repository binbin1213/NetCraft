FROM python:3.11-slim

# 配置 pip 使用国内镜像源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

WORKDIR /code

COPY ./requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY ./app /code/app

# 复制知识库文件到镜像中
COPY ../RAG/KnowledgeBase /code/RAG/KnowledgeBase

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
