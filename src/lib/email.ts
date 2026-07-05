import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendActivationEmail(params: { to: string; activationCode: string; loginUrl: string }) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
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
  const label = params.kind === "videos" ? "novos vídeos" : "novos wallpapers";
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: params.to,
    subject: `Novidades na biblioteca premium: ${label}`,
    html: `<p>A biblioteca premium da ExPost AI acabou de receber ${label}. Acesse a plataforma para conferir.</p>`,
  });
}
