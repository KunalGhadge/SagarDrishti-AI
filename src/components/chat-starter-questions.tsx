"use client";

import { motion } from "framer-motion";
import {
  Waves,
  Compass,
  Fish,
  Activity,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import React from "react";

interface StarterQuestion {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  query: string;
}

const STARTER_QUESTIONS: StarterQuestion[] = [
  {
    id: "sea-state",
    icon: Waves,
    iconColor: "text-cyan-500 dark:text-cyan-400",
    label: "Sea conditions near me",
    query: "Show me the current sea conditions near me",
  },
  {
    id: "pfz-zones",
    icon: Fish,
    iconColor: "text-emerald-500 dark:text-emerald-400",
    label: "Find best fishing zones",
    query: "Find the best fishing zones near me",
  },
  {
    id: "sst-chlorophyll",
    icon: Activity,
    iconColor: "text-blue-500 dark:text-blue-400",
    label: "SST & Chlorophyll data",
    query: "Show SST and chlorophyll near my location",
  },
  {
    id: "geofence-zones",
    icon: ShieldAlert,
    iconColor: "text-amber-500 dark:text-amber-400",
    label: "Restricted maritime zones",
    query: "Are there any restricted maritime zones nearby?",
  },
  {
    id: "safe-harbor",
    icon: Compass,
    iconColor: "text-indigo-500 dark:text-indigo-400",
    label: "Safe route to harbor",
    query: "Show me a safe route to the nearest harbor",
  },
  {
    id: "emergency-sos",
    icon: AlertTriangle,
    iconColor: "text-rose-500 dark:text-rose-400",
    label: "Emergency & vessel in danger",
    query: "What should I do if my vessel is in danger?",
  },
];

interface ChatStarterQuestionsProps {
  onSelect: (query: string) => void;
  disabled?: boolean;
}

export function ChatStarterQuestions({
  onSelect,
  disabled = false,
}: ChatStarterQuestionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-full max-w-3xl mx-auto px-4 mt-3"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        {STARTER_QUESTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(item.query)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-secondary/50 hover:bg-secondary/90 text-foreground/90 hover:text-foreground border border-border/60 hover:border-primary/40 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98]"
              title={item.query}
            >
              <Icon className={`size-3.5 ${item.iconColor} group-hover:scale-110 transition-transform duration-200`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
