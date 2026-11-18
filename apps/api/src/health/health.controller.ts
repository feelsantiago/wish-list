import { Controller, Get } from '@nestjs/common';
import { Public } from '@wish-list/authentication';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  public check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
