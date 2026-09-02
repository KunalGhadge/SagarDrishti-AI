"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { FlipWords } from "ui/flip-words";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { BasicUser } from "app-types/user";
import { fetcher } from "lib/utils";

function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

export const ChatGreeting = () => {
  const { data: user } = useSWR<BasicUser>(`/api/user/details`, fetcher, {
    revalidateOnMount: false,
  });
  const t = useTranslations("Chat.Greeting");

  const word = useMemo(() => {
    if (!user?.name) return "What can I help with?";
    const words = [
      t(getGreetingByTime(), { name: user.name }),
      "What can I help with?",
      t("niceToSeeYouAgain", { name: user.name }),
      t("whatAreYouWorkingOnToday", { name: user.name }),
      t("letMeKnowWhenYoureReadyToBegin"),
      t("whatAreYourThoughtsToday"),
      t("whereWouldYouLikeToStart"),
    ];
    return words[Math.floor(Math.random() * words.length)];
  }, [user?.name]);

  return (
    <motion.div
      key="welcome"
      className="max-w-3xl mx-auto my-6"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="rounded-xl p-4 flex flex-col gap-2 leading-relaxed text-center">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {word ? <FlipWords words={[word]} className="text-foreground" /> : "What can I help with?"}
        </h1>
      </div>
    </motion.div>
  );
};
