import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email, token, password } = await req.json();

    if (token && password) {
      const resetRecord = await prisma.passwordReset.findUnique({
        where: { token },
      });

      if (!resetRecord || resetRecord.expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      await prisma.user.update({
        where: { email: resetRecord.email },
        data: {
          password: hashedPassword,
          passwordSetup: true,
        },
      });

      await prisma.passwordReset.delete({
        where: { id: resetRecord.id },
      });

      return NextResponse.json({ success: true });
    }

    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return NextResponse.json({ success: true });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.passwordReset.create({
        data: {
          email,
          token: resetToken,
          expiresAt,
        },
      });

      await sendPasswordResetEmail(email, resetToken);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
