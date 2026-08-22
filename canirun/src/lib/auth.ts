import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { getDb } from "./db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const db = getDb();
        const user = db
          .prepare("SELECT * FROM users WHERE email = ?")
          .get(credentials.email) as Record<string, unknown> | undefined;
        if (!user || !user.password) return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password as string
        );
        if (!valid) return null;
        return {
          id: user.id as string,
          name: user.name as string,
          email: user.email as string,
          image: user.image as string | null,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const db = getDb();
        const existing = db
          .prepare("SELECT id FROM users WHERE email = ?")
          .get(user.email!) as { id: string } | undefined;
        if (!existing) {
          const id = uuidv4();
          db.prepare(
            "INSERT INTO users (id, name, email, image, createdAt) VALUES (?, ?, ?, ?, datetime('now'))"
          ).run(id, user.name, user.email, user.image);
          db.prepare(
            "INSERT INTO accounts (id, userId, type, provider, providerAccountId) VALUES (?, ?, ?, ?, ?)"
          ).run(uuidv4(), id, "oauth", "google", account.providerAccountId);
        }
      }
      return true;
    },
  },
});
