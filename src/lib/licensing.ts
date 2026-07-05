import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { sendActivationEmail } from "./email";

/**
 * Gera um código de ativação legível (ex: EXP-7K2M-9QZR).
 * Não usa caracteres ambíguos (0/O, 1/I) para reduzir erro de digitação.
 */
export function generateActivationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () => alphabet[randomBytes(1)[0] % alphabet.length]).join("");
  return `EXP-${block()}-${block()}`;
}

/**
 * Chamado quando a Cakto confirma um novo pagamento (webhook: subscription.paid
 * ou equivalente). Cria o usuário em estado PENDING_ACTIVATION, gera a licença
 * e dispara o e-mail com o link + código de ativação.
 *
 * Idempotente: se já existe uma licença para esse caktoSubscriptionId, apenas
 * retorna a existente (evita duplicar em caso de reentrega do webhook).
 */
export async function createLicenseFromPayment(params: {
  customerEmail: string;
  caktoSubscriptionId: string;
  currentPeriodEnd: Date;
}) {
  const existing = await prisma.license.findUnique({
    where: { caktoSubscriptionId: params.caktoSubscriptionId },
  });
  if (existing) return existing;

  const user = await prisma.user.upsert({
    where: { email: params.customerEmail },
    update: {},
    create: { email: params.customerEmail, status: "PENDING_ACTIVATION" },
  });

  const license = await prisma.license.create({
    data: {
      userId: user.id,
      activationCode: generateActivationCode(),
      caktoCustomerEmail: params.customerEmail,
      caktoSubscriptionId: params.caktoSubscriptionId,
      status: "ACTIVE",
      currentPeriodEnd: params.currentPeriodEnd,
    },
  });

  await sendActivationEmail({
    to: params.customerEmail,
    activationCode: license.activationCode,
    loginUrl: `${process.env.NEXTAUTH_URL}/ativar`,
  });

  return license;
}

/** Chamado quando a Cakto informa cancelamento, atraso ou expiração. */
export async function suspendLicense(caktoSubscriptionId: string, reason: "CANCELED" | "PAST_DUE" | "EXPIRED") {
  const license = await prisma.license.update({
    where: { caktoSubscriptionId },
    data: { status: reason },
  });
  await prisma.user.update({
    where: { id: license.userId },
    data: { status: "BLOCKED" },
  });
  return license;
}

/** Chamado quando a Cakto confirma um novo ciclo de pagamento de um usuário já existente. */
export async function reactivateLicense(caktoSubscriptionId: string, currentPeriodEnd: Date) {
  const license = await prisma.license.update({
    where: { caktoSubscriptionId },
    data: { status: "ACTIVE", currentPeriodEnd },
  });
  await prisma.user.update({
    where: { id: license.userId },
    data: { status: "ACTIVE" }, // dados do usuário já existiam — nada é perdido
  });
  return license;
}

/**
 * Primeiro acesso: usuário informa e-mail + código, e cria a própria senha.
 * O código expira (uso único) após validado com sucesso.
 */
export async function activateAccount(params: { email: string; code: string; password: string }) {
  const license = await prisma.license.findFirst({
    where: { caktoCustomerEmail: params.email, activationCode: params.code, activationCodeUsed: false },
    include: { user: true },
  });
  if (!license) throw new Error("Código de ativação inválido ou já utilizado.");

  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.hash(params.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: license.userId },
      data: { passwordHash, status: "ACTIVE" },
    }),
    prisma.license.update({
      where: { id: license.id },
      data: { activationCodeUsed: true },
    }),
  ]);
}
