import { Resend } from "resend";

// Criado só na hora de usar (não no carregamento do módulo) — assim a
// compilação não quebra quando RESEND_API_KEY ainda não foi configurada.
function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY || "re_placeholder_sem_chave_configurada");
}

export async function sendActivationEmail(params: { to: string; activationCode: string; loginUrl: string }) {
  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "ExPost AI <contas@expost.ai>",
    to: params.to,
    subject: "Sua assinatura ExPost AI está confirmada",
    html: `
      <p>Seu pagamento foi confirmado. Para ativar sua conta, acesse o link abaixo e informe o código de ativação.</p>
      <p><a href="${params.loginUrl}">${params.loginUrl}</a></p>
      <p>Código de ativação: <strong>${params.activationCode}</strong></p>
      <p>Esse código é de uso único e expira após a primeira ativação.</p>
    `,
  });
}

export async function sendNewContentEmail(params: {
  to: string[];
  kind: "videos" | "wallpapers";
}) {
  const resend = getResendClient();
  const label = params.kind === "videos" ? "novos vídeos" : "novos wallpapers";
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "ExPost AI <contas@expost.ai>",
    to: params.to,
    subject: `Novidades na biblioteca premium: ${label}`,
    html: `<p>A biblioteca premium da ExPost AI acabou de receber ${label}. Acesse a plataforma para conferir.</p>`,
  });
}
