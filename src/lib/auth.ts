import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "./prisma";

/**
 * Login com Google (Auth.js / NextAuth v5).
 *
 * Importante: isso autentica o LOGIN do usuário na ExPost AI — é diferente
 * das "Redes conectadas" (TikTok, Instagram etc.), que usam OAuth separado
 * só para permissão de publicação. Um usuário pode logar com Google e, em
 * outra tela, conectar o TikTok/Instagram para publicar — são dois fluxos
 * de OAuth independentes.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    /**
     * Quando alguém loga com Google pela primeira vez, vincula (ou cria) o
     * registro correspondente na tabela User — usando o e-mail como chave.
     * Isso é o que faz a conta bater com a licença criada pelo webhook da
     * Cakto (que também usa o e-mail como chave).
     */
    async signIn({ user }) {
      if (!user.email) return false;

      const existing = await prisma.user.findUnique({ where: { email: user.email } });

      if (!existing) {
        // Login com Google sem uma licença/assinatura ativa associada a
        // esse e-mail — bloqueia o acesso e explica o motivo.
        return "/erro-login?motivo=sem-assinatura";
      }

      if (existing.status === "BLOCKED" || existing.status === "ADMIN_BLOCKED") {
        return "/erro-login?motivo=conta-bloqueada";
      }

      return true;
    },

    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (dbUser) {
          (session.user as any).id = dbUser.id;
          (session.user as any).role = dbUser.role;
          (session.user as any).status = dbUser.status;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/entrar",
  },
});
