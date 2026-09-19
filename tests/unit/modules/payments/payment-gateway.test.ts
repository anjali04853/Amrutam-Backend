import { describe, it, expect } from 'vitest';
import { MockPaymentGateway, PaymentGatewayError } from '../../../../src/modules/payments/payment-gateway';
import { AppError } from '../../../../src/common/errors';

describe('MockPaymentGateway', () => {
  const gateway = new MockPaymentGateway();

  it('succeeds and returns a providerRef when forced to success', async () => {
    const result = await gateway.charge(500, { forceOutcome: 'success' });
    expect(result.providerRef).toBeTruthy();
  });

  it('throws PaymentGatewayError when forced to fail', async () => {
    await expect(gateway.charge(500, { forceOutcome: 'fail' })).rejects.toThrow(PaymentGatewayError);
  });

  it('throws PaymentGatewayError when forced to timeout', async () => {
    await expect(gateway.charge(500, { forceOutcome: 'timeout' })).rejects.toThrow(PaymentGatewayError);
  });

  it('PaymentGatewayError extends AppError with a 402 status so errorHandler maps it correctly', async () => {
    try {
      await gateway.charge(500, { forceOutcome: 'fail' });
      throw new Error('expected gateway.charge to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(402);
      expect((err as AppError).code).toBe('PAYMENT_DECLINED');
    }
  });
});
