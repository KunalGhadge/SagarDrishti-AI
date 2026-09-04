import ChatBot from "@/components/chat-bot";
import { generateUUID } from "lib/utils";
import { getSession } from "auth/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ incident?: string; t?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const resolvedParams = searchParams ? await searchParams : undefined;
  const id = generateUUID();
  const key = resolvedParams?.incident
    ? `incident-${resolvedParams.incident}-${id}`
    : id;
  return <ChatBot initialMessages={[]} threadId={id} key={key} />;
}
