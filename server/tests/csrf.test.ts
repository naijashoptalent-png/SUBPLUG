import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { COOKIES } from '../src/config/constants';

const app = createApp();

describe('CSRF bootstrap', () => {
  it('issues a non-cacheable token that matches the cookie', async () => {
    const response = await request(app).get('/api/v1/auth/csrf');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body.data.csrfToken).toMatch(/^[A-Za-z0-9_-]+$/);

    const setCookie = response.headers['set-cookie'] as unknown as string[];
    const csrfCookie = setCookie.find((cookie) => cookie.startsWith(`${COOKIES.csrf}=`));
    expect(csrfCookie).toContain(`=${response.body.data.csrfToken};`);
  });
});
