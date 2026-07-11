import { describe, expect, it } from 'vitest';
import { isUserPoolPublicPath } from '../../../src/components/auth/AuthWithUserpool';

describe('isUserPoolPublicPath', () => {
  it('always allows signed-out page', () => {
    expect(isUserPoolPublicPath('/signed-out', false)).toBe(true);
  });

  it('allows password reset pages only when custom password reset is enabled', () => {
    expect(isUserPoolPublicPath('/password-reset/request', true)).toBe(true);
    expect(isUserPoolPublicPath('/password-reset/complete', true)).toBe(true);
    expect(isUserPoolPublicPath('/password-reset/request', false)).toBe(false);
  });

  it('does not allow prefix matches', () => {
    expect(isUserPoolPublicPath('/password-reset/request/extra', true)).toBe(false);
  });
});
