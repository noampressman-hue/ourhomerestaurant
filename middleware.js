import { next, rewrite } from '@vercel/edge';
import { COOKIE_NAME, readCookie, verifyToken } from './lib/auth.js';

// Middleware выполняется ПЕРЕД отдачей любого файла — включая /images и /videos.
// Именно поэтому прямые ссылки на фото и видео тоже закрыты паролем.
export const config = {
    matcher: ['/((?!_vercel/).*)'],
};

// Единственное, что доступно без пароля.
const PUBLIC_PATHS = new Set([
    '/login',
    '/login.html',
    '/api/login',
    '/robots.txt',
    '/favicon.ico',
]);

const unauthorizedSetupPage = () =>
    new Response(
        '<!doctype html><meta charset="utf-8"><title>Требуется настройка</title>' +
        '<body style="font-family:Georgia,serif;background:#241D18;color:#FAF6EE;padding:3rem;line-height:1.6">' +
        '<h1>Пароль сайта не задан</h1>' +
        '<p>Добавьте переменную окружения <code>SITE_PASSWORD</code> в настройках проекта на Vercel ' +
        'и сделайте новый деплой. Пока она не задана, сайт закрыт целиком.</p></body>',
        { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );

export default async function middleware(request) {
    const password = process.env.SITE_PASSWORD;
    const { pathname } = new URL(request.url);

    if (PUBLIC_PATHS.has(pathname)) return next();

    // Fail closed: без заданного пароля сайт не открывается вообще.
    if (!password) return unauthorizedSetupPage();

    const token = readCookie(request, COOKIE_NAME);
    if (await verifyToken(token, password)) return next();

    // Страницу — подменяем формой входа (адрес сохраняется, после входа
    // тот же URL перезагружается уже с кукой). Картинки и видео — просто 401.
    const wantsHtml = (request.headers.get('accept') || '').includes('text/html');
    if (wantsHtml) return rewrite(new URL('/login.html', request.url));

    return new Response('Требуется вход', {
        status: 401,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
}
