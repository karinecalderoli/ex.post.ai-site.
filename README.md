# ExPost AI

SaaS de criação, edição básica, agendamento e publicação automática de vídeos,
usando exclusivamente as APIs oficiais das redes sociais.

Este repositório é a **fundação real do projeto**: banco de dados, autenticação,
webhook de assinatura (Cakto) e a estrutura de pastas. As integrações OAuth de
cada rede social e a lógica de upload/processamento de vídeo estão descritas
abaixo como próximos passos — construir isso de forma confiável exige as
credenciais reais de cada plataforma (App Review, chaves de API, etc.), que só
você pode obter.

## Stack

- Next.js 14 + React + TypeScript + Tailwind CSS
- Node.js (API Routes do Next.js) — pode ser extraído para um serviço Express
  separado se preferir back-end isolado do front-end
- PostgreSQL + Prisma (`prisma/schema.prisma`)
- Auth.js (NextAuth) para login/sessão
- AWS S3 para armazenamento de vídeos e wallpapers
- OpenAI para título/descrição/hashtags
- Resend para e-mail transacional
- Cakto para assinatura recorrente (R$18,99/mês)

## Estrutura

```
prisma/schema.prisma          modelo completo do banco de dados
src/lib/prisma.ts             cliente Prisma
src/lib/licensing.ts          criação de licença, código de ativação, bloqueio/reativação
src/lib/email.ts              e-mails transacionais (ativação, novidades na biblioteca)
src/lib/scheduling.ts         regra de limite de 5 agendamentos/dia
src/app/api/webhooks/cakto/   webhook oficial da Cakto
.env.example                  todas as variáveis de ambiente necessárias
```

## Configurando o ambiente

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

## Fluxo de assinatura (Cakto)

1. Cliente compra na Cakto → Cakto envia webhook `subscription.paid`.
2. `POST /api/webhooks/cakto` valida a assinatura HMAC (`CAKTO_WEBHOOK_SECRET`),
   cria o usuário (`PENDING_ACTIVATION`), gera o código de ativação e envia o
   e-mail com link + código (`src/lib/licensing.ts`).
3. No primeiro acesso, o usuário informa e-mail + código e define a senha
   (`activateAccount`). O código expira após esse uso.
4. Renovação, cancelamento, atraso de pagamento e expiração chegam como
   eventos separados (`subscription.renewed`, `subscription.canceled`,
   `subscription.payment_failed`, `subscription.expired`) e atualizam o status
   da conta sem apagar nenhum dado do usuário.

**Importante:** os nomes de evento e campos do payload usados no webhook
(`subscription.paid`, etc.) seguem o formato mais comum de webhook de
assinatura recorrente. Antes de ir para produção, confirme os nomes exatos na
documentação da Cakto e ajuste `src/app/api/webhooks/cakto/route.ts` — o
código foi escrito para que isso seja um ajuste pontual, não um redesenho.

## Integrações de redes sociais — o que a API oficial permite hoje

Cada plataforma abaixo tem restrições reais de publicação automática. A
ExPost AI deve respeitar todas elas e comunicar essas limitações ao usuário na
interface (ex: um aviso quando o vídeo ultrapassa a duração máxima, ou quando
o limite diário de publicações da própria rede for atingido).

### TikTok — Content Posting API
- Enquanto o app não passar pela **auditoria oficial da TikTok**, todo
  conteúdo publicado fica restrito a visualização privada (`SELF_ONLY`),
  mesmo que o usuário peça público. Isso vale para todos os usuários do app,
  não só para testes.
- Limite de 5 usuários publicando em uma janela de 24h para apps não
  auditados.
- Token de usuário limitado a 6 requisições/minuto.
- Não é possível anexar músicas da biblioteca nativa do TikTok via API — o
  áudio precisa já estar embutido no vídeo.
- Duetos e Stitches não podem ser criados via API.
- **Ação necessária:** submeter o app para auditoria da TikTok assim que a
  integração estiver testada (o processo costuma levar de 1 a 6 semanas).

### Instagram e Facebook — Graph API (Meta)
- Só funciona com contas **Business ou Creator** vinculadas a uma Página do
  Facebook — contas pessoais não são suportadas.
- Limite de **100 publicações por conta a cada 24h (janela rolante)** no
  Instagram — Reels, Stories e Feed compartilham a mesma cota. No Facebook, o
  limite é de 25 posts por Página a cada 24h.
- Apenas JPEG é suportado para imagens (MPO/JPS não funcionam).
- Token de usuário de vida longa expira em 60 dias e precisa ser renovado
  automaticamente antes disso.
- **Ação necessária:** App Review da Meta para as permissões de publicação
  (`instagram_content_publish`, etc.).

### YouTube — Data API v3
- Cota diária padrão de 10.000 unidades; um upload de vídeo custa ~1.600
  unidades, o que limita a poucos uploads por dia num app novo. Cotas maiores
  exigem solicitação formal ao Google.
- Vídeos enviados por apps não verificados pelo Google podem ficar marcados
  como não listados até a verificação do OAuth consent screen ser aprovada.

### X (Twitter) — API v2
- O nível gratuito da API tem limite de postagens muito baixo; publicação
  automática em volume exige um plano pago (Basic/Pro).
- Mídia de vídeo tem restrições de duração e tamanho que variam por tipo de
  conta.

### LinkedIn — Community Management API
- Publicação em nome de terceiros exige aprovação do produto "Community
  Management API", que passa por revisão da LinkedIn.
- Vídeos têm limite de tamanho e duração definidos pela LinkedIn e podem
  exigir upload em duas etapas (registro do asset + upload do binário).

### Pinterest — API v5
- Requer app aprovado para "Standard Access" para publicar Pins em nome de
  outros usuários; no modo de teste, só funciona com contas de
  desenvolvedor cadastradas.

> Todas as informações acima refletem a documentação pública de cada
> plataforma no momento da escrita. APIs de terceiros mudam com frequência —
> revalide os limites exatos na documentação oficial de cada uma antes do
> lançamento em produção.

## Regras de negócio já implementadas no código

- **Limite de 5 agendamentos por dia por usuário** — `src/lib/scheduling.ts`,
  validado na camada de aplicação (não é uma constraint nativa do Postgres).
- **Licenciamento sem perda de dados** — bloquear/reativar uma conta nunca
  apaga `UserVideo`, `ScheduledPost`, `PublishHistory` etc.; apenas muda
  `User.status`.
- **Biblioteca do usuário vs. premium** — `UserVideo` e `PremiumVideo` são
  modelos separados de propósito, para impedir que upload de usuário vaze
  para a biblioteca premium.

## Login com Google

Já configurado com Auth.js v5 (`src/lib/auth.ts` + `src/app/api/auth/[...nextauth]/route.ts`).

Fluxo importante de entender: **login com Google** (autenticar o usuário na
própria ExPost AI) é um OAuth completamente separado do **OAuth de cada rede
social** (TikTok, Instagram etc., usado só para permissão de publicação). Uma
pessoa loga com Google normalmente, e depois, em outra tela, conecta o
TikTok/Instagram/YouTube que quiser — são dois fluxos independentes.

Passos para ativar:
1. No [Google Cloud Console](https://console.cloud.google.com), crie um
   projeto e configure a Tela de Consentimento OAuth (tipo "Externo").
2. Em Credenciais, crie um "ID do cliente OAuth" do tipo "Aplicativo da Web".
3. Em "URIs de redirecionamento autorizados", adicione:
   `https://SEU-DOMINIO/api/auth/callback/google`
4. Copie o Client ID e Client Secret para `GOOGLE_CLIENT_ID` e
   `GOOGLE_CLIENT_SECRET` no `.env`.

O `signIn` callback em `auth.ts` já bloqueia o login de quem não tem uma
licença/assinatura ativa associada ao e-mail — ou seja, só quem pagou pela
Cakto (e já tem o `User` criado pelo webhook) consegue logar de verdade.

## Próximos passos sugeridos

1. Tela de login (`/entrar`) usando o botão "Entrar com Google" do Auth.js,
   e a página de erro (`/erro-login`) referenciada em `auth.ts`.
2. Upload de vídeo para S3 (URLs pré-assinadas) + processamento básico de
   corte de cena (ffmpeg, rodando em uma fila de jobs).
3. OAuth de cada rede social, uma de cada vez — comece pela que você mais
   precisa para validar com usuários reais.
4. Painel administrativo (CRUD de `PremiumVideo` e `PremiumWallpaper` +
   disparo de notificação/e-mail).
5. Deploy: Vercel (frontend/API routes) + banco gerenciado (Railway, Render
   ou Supabase) — ver `.env.example` para tudo que precisa estar configurado.
