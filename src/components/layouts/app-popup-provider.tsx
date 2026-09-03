"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { appStore } from "@/app/store";

const KeyboardShortcutsPopup = dynamic(
  () =>
    import("@/components/keyboard-shortcuts-popup").then(
      (mod) => mod.KeyboardShortcutsPopup,
    ),
  {
    ssr: false,
  },
);

const ChatPreferencesPopup = dynamic(
  () =>
    import("@/components/chat-preferences-popup").then(
      (mod) => mod.ChatPreferencesPopup,
    ),
  {
    ssr: false,
  },
);

const ChatBotVoice = dynamic(
  () => import("@/components/chat-bot-voice").then((mod) => mod.ChatBotVoice),
  {
    ssr: false,
  },
);

const ChatBotTemporary = dynamic(
  () =>
    import("@/components/chat-bot-temporary").then(
      (mod) => mod.ChatBotTemporary,
    ),
  {
    ssr: false,
  },
);

const McpCustomizationPopup = dynamic(
  () =>
    import("@/components/mcp-customization-popup").then(
      (mod) => mod.McpCustomizationPopup,
    ),
  {
    ssr: false,
  },
);

const VesselSecurityPanel = dynamic(
  () =>
    import("@/components/vessel-security-panel").then(
      (mod) => mod.VesselSecurityPanel,
    ),
  {
    ssr: false,
  },
);

const UserSettingsPopup = dynamic(
  () =>
    import("@/components/user/user-detail/user-settings-popup").then(
      (mod) => mod.UserSettingsPopup,
    ),
  {
    ssr: false,
  },
);

export function AppPopupProvider({
  userSettingsComponent,
}: {
  userSettingsComponent: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const incidentWorkflow = appStore((state) => state.incidentWorkflow);
  const navigatedBreachIdRef = useRef<string | null>(null);

  // Autonomous Incident Navigation: Bring operator to safety chat immediately upon breach
  useEffect(() => {
    if (
      incidentWorkflow?.isActive &&
      incidentWorkflow.stage === "BREACH_COUNTDOWN" &&
      incidentWorkflow.incidentId &&
      navigatedBreachIdRef.current !== incidentWorkflow.incidentId
    ) {
      navigatedBreachIdRef.current = incidentWorkflow.incidentId;
      if (pathname !== "/" && !pathname.startsWith("/chat/")) {
        router.push("/");
      }
    }
  }, [incidentWorkflow?.isActive, incidentWorkflow?.stage, incidentWorkflow?.incidentId, pathname, router]);

  return (
    <>
      <KeyboardShortcutsPopup />
      <ChatPreferencesPopup />
      <UserSettingsPopup userSettingsComponent={userSettingsComponent} />
      <ChatBotVoice />
      <ChatBotTemporary />
      <VesselSecurityPanel />
      <McpCustomizationPopup />
    </>
  );
}
