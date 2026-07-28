import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let health: {
    live: jest.Mock;
    ready: jest.Mock;
    checkDatabase: jest.Mock;
    detailed: jest.Mock;
  };

  beforeEach(async () => {
    health = {
      live: jest.fn().mockReturnValue({ ok: true, service: 'api' }),
      ready: jest.fn(),
      checkDatabase: jest.fn(),
      detailed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: health }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('live returns ok', () => {
    expect(controller.live()).toEqual({ ok: true, service: 'api' });
  });

  it('ready returns payload when ok', async () => {
    health.ready.mockResolvedValue({ ok: true, status: 'ready', checks: [] });
    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it('ready throws when not ok', async () => {
    health.ready.mockResolvedValue({ ok: false, status: 'not_ready' });
    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('db returns ok when database is reachable', async () => {
    health.checkDatabase.mockResolvedValue({ status: 'up' });
    await expect(controller.db()).resolves.toEqual({
      ok: true,
      database: 'up',
    });
  });

  it('db throws ServiceUnavailableException when database fails', async () => {
    health.checkDatabase.mockResolvedValue({
      status: 'down',
      detail: 'connection refused',
    });
    await expect(controller.db()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
