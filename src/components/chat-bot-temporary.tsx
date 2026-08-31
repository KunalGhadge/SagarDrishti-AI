"use client";
import { appStore } from "@/app/store";
import { cn } from "lib/utils";
import { useEffect, useState } from "react";
import { Button } from "ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "ui/drawer";
import { ExternalLink, Globe, Maximize2, Minimize2, X } from "lucide-react";
import { Separator } from "ui/separator";
import { useShallow } from "zustand/shallow";
import { isShortcutEvent, Shortcuts } from "lib/keyboard-shortcuts";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

export function ChatBotTemporary() {
  const [temporaryChat, appStoreMutate] = appStore(
    useShallow((state) => [state.temporaryChat, state.mutate]),
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  const setOpen = (bool: boolean) => {
    appStoreMutate({
      temporaryChat: {
        ...temporaryChat,
        isOpen: bool,
      },
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShortcutEvent(e, Shortcuts.toggleTemporaryChat)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        appStoreMutate((prev) => ({
          temporaryChat: {
            ...prev.temporaryChat,
            isOpen: !prev.temporaryChat.isOpen,
          },
        }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [temporaryChat.isOpen]);

  return (
    <Drawer
      handleOnly
      direction="right"
      open={temporaryChat.isOpen}
      onOpenChange={setOpen}
    >
      <DrawerContent
        style={{
          userSelect: "text",
        }}
        className={cn(
          "px-4 flex flex-col transition-all duration-300 z-50",
          isFullscreen
            ? "w-screen max-w-none h-full rounded-none inset-0"
            : "w-full md:w-[750px] lg:w-[850px] h-full",
        )}
      >
        <DrawerHeader className="px-0 py-3 border-b border-border/40 mb-3">
          <DrawerTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Globe className="size-4" />
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm sm:text-base">
                    Copernicus Marine Satellite & Ocean GIS
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                    LIVE GIS
                  </span>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Real-time Global SST, Wave Dynamics & Ocean Currents
                </span>
              </div>
            </div>

            <div className="flex-1" />

            {/* Fullscreen Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={"secondary"}
                  size="icon"
                  className="rounded-full h-8 w-8"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="size-4" />
                  ) : (
                    <Maximize2 className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
              </TooltipContent>
            </Tooltip>

            {/* Open in New Tab */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={"secondary"}
                  size="icon"
                  className="rounded-full h-8 w-8"
                  asChild
                >
                  <a
                    href="https://data.marine.copernicus.eu/-/mhal4xhrnv"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open in Copernicus Portal
              </TooltipContent>
            </Tooltip>

            {/* Close Drawer */}
            <DrawerClose asChild>
              <Button
                variant={"secondary"}
                className="flex items-center gap-1 rounded-full h-8 px-3"
              >
                <X className="size-4" />
                <Separator orientation="vertical" className="h-3" />
                <span className="text-[10px] text-muted-foreground font-mono">
                  ESC
                </span>
              </Button>
            </DrawerClose>
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Interactive Copernicus Marine Ocean Data and Satellite GIS
            Visualization
          </DrawerDescription>
        </DrawerHeader>

        {/* Live Copernicus Marine Map Iframe */}
        <div className="flex-1 w-full h-full min-h-[400px] mb-4 relative rounded-xl overflow-hidden border border-border/60 bg-muted/20 shadow-inner">
          <iframe
            src="https://data.marine.copernicus.eu/-/mhal4xhrnv"
            width="100%"
            height={isFullscreen ? "100%" : "350px"}
            className="w-full h-full border-0 min-h-[350px] rounded-lg"
            allow="geolocation; fullscreen; cross-origin-isolated"
            title="Copernicus Marine Satellite & Ocean GIS Map"
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
