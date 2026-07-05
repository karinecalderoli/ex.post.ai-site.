import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { createLicenseFromPayment, suspendLicense, reactivateLicense } from "@/lib/licensing";

// NOTA: os nomes exatos de evento/campos abaixo (subscription.paid,
// subscription.canceled, etc.) devem ser confirmados na documentação oficial
// da Cakto antes de ir para produção — este handler assume o formato mais
// comum de webhook de assinatura recorrente e foi escrito para ser fácil de
// ajustar campo a campo.

function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", process.env.CAKTO_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-cakto-signature");

  if (!isValidSignature(rawBody, signature)) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  const logEntry = await prisma.caktoWebhookEvent.create({
    data: { eventType: payload.event, payload },
  });

  try {
    switch (payload.event) {
      case "subscription.paid":
        await createLicenseFromPayment({
          customerEmail: payload.data.customer.email,
          caktoSubscriptionId: payload.data.subscription.id,
          currentPeriodEnd: new Date(payload.data.subscription.current_period_end),
        });
        break;

      case "subscription.renewed":
        await reactivateLicense(
          payload.data.subscription.id,
          new Date(payload.data.subscription.current_period_end)
        );
        break;

      case "subscription.canceled":
        await suspendLicense(payload.data.subscription.id, "CANCELED");
        break;

      case "subscription.payment_failed":
        await suspendLicense(payload.data.subscription.id, "PAST_DUE");
        break;

      case "subscription.expired":
        await suspendLicense(payload.data.subscription.id, "EXPIRED");
        break;

      default:
        // Evento não tratado — registrado no log para revisão manual.
        break;
    }

    await prisma.caktoWebhookEvent.update({
      where: { id: logEntry.id },
      data: { processed: true, processedAt: new Date() },
    });
  } catch (err) {
    await prisma.caktoWebhookEvent.update({
      where: { id: logEntry.id },
      data: { error: err instanceof Error ? err.message : String(err) },
    });
    // Retorna 200 mesmo em erro de processamento interno para evitar reenvios
    // agressivos da Cakto; o erro fica registrado para reprocessamento manual.
    return NextResponse.json({ received: true, warning: "erro no processamento interno" });
  }

  return NextResponse.json({ received: true });
}
