# API-HYVE — Forma / HYVE beta

Fontes separadas do MVP para revisão da beta, sem credenciais ou dados reais.
Consulte o repositório HYVE-ORG/DOCS para o relatório e os limites de publicação.

Node 22.12+ (Node 24 recomendado). Execute `npm ci`, `npm run typecheck`, `npm test` e `npm run build`. O lockfile preserva o grafo completo já testado.

API NestJS com Socket.IO: exige processo contínuo e volume persistente. `npm start` usa `dist-api/main.cjs`. Não publicar este processo em Vercel Functions.
