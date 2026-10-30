interface EdgeEnvironment {
    API_ORIGIN?: string;
    ASSETS: {fetch(request: Request): Promise<Response>};
}
type Forward = (request: Request) => Promise<Response>;
const failure = (status: number, message: string) => Response.json({message}, {status, headers:{'Cache-Control':'no-store'}});

function apiOrigin(value: string | undefined, publicOrigin: string): string | null {
    try {
        const url = new URL(value || '');
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
            url.origin === publicOrigin || !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) ||
            url.hostname.includes(':') || /\.(localhost|local|internal)$/.test(url.hostname)) return null;
        return url.origin;
    } catch {return null;}
}

export async function handleEdge(request: Request, env: EdgeEnvironment, forward: Forward = fetch): Promise<Response> {
    const url = new URL(request.url);
    const dynamic = /^\/(api|socket\.io)(\/|$)/.test(url.pathname) || url.pathname.startsWith('/downloads/installers/');
    if (!dynamic) return env.ASSETS.fetch(request);
    let decoded: string;
    try {decoded = decodeURIComponent(url.pathname);} catch {return failure(400,'Caminho inválido.');}
    if (/%(?:2f|5c|25)/i.test(url.pathname) || decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(part=>part==='.'||part==='..'))
        return failure(400,'Caminho inválido.');
    const origin = apiOrigin(env.API_ORIGIN, url.origin);
    if (!origin) return failure(503,'O serviço compartilhado ainda não está configurado.');
    const socket = url.pathname === '/socket.io' || url.pathname.startsWith('/socket.io/');
    const mutation = !['GET','HEAD','OPTIONS'].includes(request.method);
    const sameOriginPolling = socket && ['GET','HEAD'].includes(request.method) &&
        url.searchParams.get('transport') === 'polling' && !request.headers.has('Upgrade') &&
        !request.headers.has('Origin') && request.headers.get('Sec-Fetch-Site') === 'same-origin';
    if ((socket || mutation) && request.headers.get('Origin') !== url.origin && !sameOriginPolling)
        return failure(403,'Origem de requisição não permitida.');
    const upstream = new Request(origin + url.pathname + url.search, request);
    if (sameOriginPolling) upstream.headers.set('Origin',url.origin);
    // Do not trust forwarding headers supplied by the caller or enable caching sessions.
    for (const name of ['host','forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-real-ip','cf-connecting-ip']) upstream.headers.delete(name);
    const target = new Request(upstream,{redirect:'manual'});
    try {
        const response = await forward(target);
        if (response.status === 101 && socket && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') return response;
        if (response.status >= 300 && response.status < 400) return failure(502,'Resposta inesperada do servidor.');
        const headers = new Headers(response.headers);
        headers.set('Cache-Control','no-store');
        headers.delete('CDN-Cache-Control');headers.delete('Cloudflare-CDN-Cache-Control');
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    } catch {return failure(502,'Não foi possível conectar ao servidor. Tente novamente.');}
}

export default {fetch:(request:Request,env:EdgeEnvironment)=>handleEdge(request,env)};
