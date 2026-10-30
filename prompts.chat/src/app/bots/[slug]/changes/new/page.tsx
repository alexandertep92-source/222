import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ChangeRequestForm } from "@/components/prompts/change-request-form";
import { extractBotId, getBotById } from "@/lib/bots";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { getBotUrl } from "@/lib/urls";

// Signed-in or workflow page with no search value
export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

interface NewBotChangeRequestPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewBotChangeRequestPage({ params }: NewBotChangeRequestPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { slug } = await params;
  const bot = await getBotById(extractBotId(slug));
  // Same rules as prompts: no change requests on private bots
  if (!bot || bot.isPrivate) {
    notFound();
  }

  const botPath = getBotUrl(bot.id, bot.slug);
  if (bot.authorId === session.user.id) {
    redirect(botPath);
  }

  const t = await getTranslations("changeRequests");

  return (
    <div className="container max-w-3xl py-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href={botPath}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {t("backToBot")}
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{t("create")}</h1>
        <p className="text-sm text-muted-foreground mt-1 wrap-anywhere">{bot.title}</p>
      </div>

      <ChangeRequestForm
        promptId={bot.id}
        currentContent={bot.instructions}
        currentTitle={bot.title}
        promptType="BOT"
        basePath={botPath}
      />
    </div>
  );
}
