import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId =
      session.user.role === "viewer" && session.user.parentId
        ? session.user.parentId
        : session.user.id;

    const servers = await prisma.server.findMany({
      where: { userId },
      include: {
        proxyIps: {
          orderBy: { port: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(servers);
  } catch (error) {
    console.error("Get servers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, mainIp, proxyIps } = await req.json();

    const server = await prisma.server.create({
      data: {
        name,
        mainIp,
        userId: session.user.id,
        proxyIps: {
          create: proxyIps.map((ip: string, index: number) => ({
            ip,
            port: 8080 + index,
          })),
        },
      },
      include: {
        proxyIps: true,
      },
    });

    return NextResponse.json(server);
  } catch (error) {
    console.error("Create server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
