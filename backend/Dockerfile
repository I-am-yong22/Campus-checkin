FROM node:20-alpine

WORKDIR /app

# 安装依赖（利用缓存）
COPY package*.json ./
COPY prisma ./prisma
RUN npm install

# 拷贝源码并构建
COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000

# 启动前执行迁移与种子，再运行
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed.ts && node dist/main.js"]
