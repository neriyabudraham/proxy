import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Only admin can setup initial password" },
        { status: 403 }
      );
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user?.passwordSetup) {
      return NextResponse.json(
        { error: "Password already set" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    if (user) {
      await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          passwordSetup: true,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: "admin",
          passwordSetup: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Setup password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: process.env.ADMIN_EMAIL! },
    });

    return NextResponse.json({
      needsSetup: !user || !user.passwordSetup,
    });
  } catch (error) {
    console.error("Check setup error:", error);
    return NextResponse.json({ needsSetup: true });
  }
}
