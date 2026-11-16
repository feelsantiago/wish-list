import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { EnvModule } from './env.module.js';
import { ENV } from './env.token.js';

const schema = z.object({
  ENV_SPEC_PORT: z.coerce.number().int().positive(),
  ENV_SPEC_NAME: z.string().min(1),
});

describe('EnvModule.forRoot', () => {
  let dir: string;
  let envFilePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'env-module-'));
    envFilePath = join(dir, '.env');
    writeFileSync(envFilePath, 'ENV_SPEC_PORT=4000\nENV_SPEC_NAME=from-file\n');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env['ENV_SPEC_PORT'];
    delete process.env['ENV_SPEC_NAME'];
    rmSync(dir, { recursive: true, force: true });
  });

  async function resolveEnv(path: string): Promise<z.infer<typeof schema>> {
    const moduleRef = await Test.createTestingModule({
      imports: [EnvModule.forRoot({ schema, envFilePath: path })],
    }).compile();
    return moduleRef.get(ENV);
  }

  it('parses variables loaded from the .env file', async () => {
    const env = await resolveEnv(envFilePath);
    expect(env).toEqual({ ENV_SPEC_PORT: 4000, ENV_SPEC_NAME: 'from-file' });
  });

  it('lets real environment variables win over the .env file', async () => {
    vi.stubEnv('ENV_SPEC_NAME', 'from-process');
    const env = await resolveEnv(envFilePath);
    expect(env.ENV_SPEC_NAME).toBe('from-process');
  });

  it('fails boot with "invalid-env" when the schema rejects', async () => {
    const missing = join(dir, 'missing.env');
    await expect(resolveEnv(missing)).rejects.toMatchObject({
      name: 'invalid-env',
    });
  });
});
