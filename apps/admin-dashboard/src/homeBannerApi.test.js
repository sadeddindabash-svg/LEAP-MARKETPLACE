import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBannerAdmin, setBannerMode, addBannerSlide, saveBannerSlide, removeBannerSlide, reorderBannerSlides, uploadBannerPhoto, removeBannerPhoto } from './homeBannerApi';
import { SessionExpiredError } from './auth';

// The real requests the admin portal sends for the home banner, with the network replaced by one fixed answer.
let calls;
const answer = (status, body) => { globalThis.fetch = vi.fn(async (url, options) => { calls.push({ url: String(url).replace(/^https?:\/\/[^/]+/, ''), options }); return { ok: status < 400, status, json: async () => body }; }); };
beforeEach(() => { calls = []; });
const sent = (i = 0) => ({ method: calls[i].options.method, url: calls[i].url, auth: calls[i].options.headers.Authorization, body: calls[i].options.body && typeof calls[i].options.body === 'string' ? JSON.parse(calls[i].options.body) : calls[i].options.body });

describe('the banner requests', () => {
  it('reading is a GET of the admin view with the token', async () => { answer(200, { mode: 'headline', slides: [] }); await fetchBannerAdmin('tok'); expect(sent()).toMatchObject({ method: 'GET', url: '/platform-settings/home-banner/admin', auth: 'Bearer tok' }); });
  it('the switch, a new slide, a changed slide, a removed slide and the order each go to their own address with their own body', async () => {
    answer(200, {}); await setBannerMode('tok', 'banner'); await addBannerSlide('tok', { seconds: 7 }); await saveBannerSlide('tok', 's 1/2', { seconds: 9, link: { type: 'none' } }); await removeBannerSlide('tok', 's1'); await reorderBannerSlides('tok', ['b', 'a']);
    expect(calls.map((c, i) => [sent(i).method, sent(i).url])).toEqual([['PUT', '/platform-settings/home-banner/mode'], ['POST', '/platform-settings/home-banner/slides'], ['PUT', '/platform-settings/home-banner/slides/s%201%2F2'], ['DELETE', '/platform-settings/home-banner/slides/s1'], ['PUT', '/platform-settings/home-banner/order']]);
    expect(sent(0).body).toEqual({ mode: 'banner' }); expect(sent(1).body).toEqual({ seconds: 7 }); expect(sent(2).body).toEqual({ seconds: 9, link: { type: 'none' } }); expect(sent(3).body).toBeUndefined(); expect(sent(4).body).toEqual({ ids: ['b', 'a'] });
    for (let i = 0; i < 5; i++) expect(sent(i).auth).toBe('Bearer tok');
  });
  it('a photo is sent as a file (field "image") to the slide and the language it is for; removing one is a DELETE of that photo', async () => {
    answer(200, {}); const blob = new Blob(['x'], { type: 'image/jpeg' }); await uploadBannerPhoto('tok', 's1', 'ar', blob); await removeBannerPhoto('tok', 's1', 'en');
    expect(sent(0)).toMatchObject({ method: 'PUT', url: '/platform-settings/home-banner/slides/s1/image/ar', auth: 'Bearer tok' }); expect(sent(0).body instanceof FormData).toBe(true); expect(sent(0).body.get('image').size).toBe(1); expect(sent(0).options?.headers?.['Content-Type']).toBeUndefined();
    expect(sent(1)).toMatchObject({ method: 'DELETE', url: '/platform-settings/home-banner/slides/s1/image/en' });
  });
  it('an expired sign-in and a refusal are told apart, and the refusal keeps the server\'s words', async () => {
    answer(401, {}); for (const call of [() => fetchBannerAdmin('t'), () => setBannerMode('t', 'banner'), () => uploadBannerPhoto('t', 's', 'en', new Blob(['x']))]) await expect(call()).rejects.toBeInstanceOf(SessionExpiredError);
    answer(400, { error: 'The banner can have at most 10 photos' }); await expect(addBannerSlide('t', {})).rejects.toThrow('at most 10 photos'); answer(500, {}); await expect(fetchBannerAdmin('t')).rejects.toThrow('Request failed (500)');
  });
});
