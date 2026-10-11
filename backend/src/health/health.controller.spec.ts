import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

// Tanpa jest.fn(): di mode Jest ESM, objek global `jest` tidak tersedia
// (butuh @jest/globals yang bukan dependency), jadi pakai mock manual.
describe('HealthController', () => {
  let controller: HealthController;
  let shouldFail = false;
  let callCount = 0;

  beforeEach(async () => {
    shouldFail = false;
    callCount = 0;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: async () => {
              callCount += 1;
              if (shouldFail) {
                throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
              }
              return [{ '?column?': 1 }];
            },
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('sehat: status ok saat database merespons', async () => {
    const body = await controller.check();

    expect(callCount).toBe(1);
    expect(body).toMatchObject({ status: 'ok', database: 'up' });
    expect(typeof body.diskFreeBytes).toBe('number');
  });

  it('gagal: 503 saat database tidak terjangkau, tanpa detail internal', async () => {
    shouldFail = true;

    const assertion = controller.check();

    await expect(assertion).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(assertion).rejects.toMatchObject({
      response: { status: 'error', database: 'down' },
    });
  });
});
