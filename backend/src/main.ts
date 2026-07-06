import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const origins = (config.get<string>('CORS_ORIGIN') || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim());
  app.enableCors({ origin: origins, credentials: true });

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`后端服务已启动: http://localhost:${port}/api`);
}
bootstrap();
