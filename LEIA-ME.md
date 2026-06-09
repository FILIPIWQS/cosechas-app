# Cosechas - Contagem de Estoque

App para a loja contar o estoque e o administrador ver o que comprar para repor.

- Tela da loja (/): a pessoa conta cada produto. Salva sozinho.
- Tela do admin (/admin): protegida por senha. Cadastra produtos, define o estoque
  regulador e ve a lista de reposicao (comprar = regulador - contado).

## Publicar no Vercel (resumo)
1. Suba estes arquivos para um repositorio no GitHub.
2. No Vercel, importe o repositorio e clique em Deploy.
3. Aba Storage: crie um banco Upstash (Redis) e conecte ao projeto (gratis).
4. Settings -> Environment Variables: crie ADMIN_PASSWORD com a sua senha.
5. Faca um novo deploy (Redeploy).

Estrutura (6 arquivos):
- package.json
- app/layout.js
- app/page.js
- app/admin/page.js
- app/globals.css
- app/api/[action]/route.js
