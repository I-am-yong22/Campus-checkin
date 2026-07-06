import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller('admin')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('audit-logs')
  @Roles(Role.ADMIN)
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: string,
  ) {
    return this.auditService.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      action,
    });
  }
}
