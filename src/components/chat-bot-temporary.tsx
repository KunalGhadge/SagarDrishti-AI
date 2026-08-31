"use client";
import { appStore } from "@/app/store";
import { cn } from "lib/utils";
import { useEffect, useRef, useState } from "react";
import { Button } from "ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "ui/drawer";
import {
  ExternalLink,
  Globe,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Waves,
  X,
} from "lucide-react";
import { Separator } from "ui/separator";
import { useShallow } from "zustand/shallow";
import { isShortcutEvent, Shortcuts } from "lib/keyboard-shortcuts";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

export function ChatBotTemporary() {
  const [temporaryChat, appStoreMutate] = appStore(
    useShallow((state) => [state.temporaryChat, state.mutate]),
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const setOpen = (bool: boolean) => {
    if (bool) setHasOpenedOnce(true);
    appStoreMutate({
      temporaryChat: {
        ...temporaryChat,
        isOpen: bool,
      },
    });
  };

  useEffect(() => {
    if (temporaryChat.isOpen) {
      setHasOpenedOnce(true);
    }
  }, [temporaryChat.isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShortcutEvent(e, Shortcuts.toggleTemporaryChat)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        appStoreMutate((prev) => {
          const nextState = !prev.temporaryChat.isOpen;
          if (nextState) setHasOpenedOnce(true);
          return {
            temporaryChat: {
              ...prev.temporaryChat,
              isOpen: nextState,
            },
          };
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [temporaryChat.isOpen]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoaded(false);
      iframeRef.current.src = "https://data.marine.copernicus.eu/-/mhal4xhrnv";
    }
  };

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
          "px-4 flex flex-col transition-all duration-300 z-50 bg-background/95 backdrop-blur-xl border-l border-border/50",
          isFullscreen
            ? "w-screen max-w-none h-full rounded-none inset-0"
            : "w-full md:w-[780px] lg:w-[900px] h-full",
        )}
      >
        <DrawerHeader className="px-0 py-3 border-b border-border/40 mb-3">
          <DrawerTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <Globe className="size-4 animate-pulse" />
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm sm:text-base tracking-tight">
                    Copernicus Marine Satellite GIS Map
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE 60 FPS
                  </span>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  GPU-Accelerated Global Ocean Waves, SST & Surface Currents
                </span>
              </div>
            </div>

            <div className="flex-1" />

            {/* Refresh / Reload */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={"secondary"}
                  size="icon"
                  className="rounded-full h-8 w-8 hover:bg-secondary transition-colors"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="size-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Reload Map Feed</TooltipContent>
            </Tooltip>

            {/* Fullscreen Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={"secondary"}
                  size="icon"
                  className="rounded-full h-8 w-8 hover:bg-secondary transition-colors"
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
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen GIS Map"}
              </TooltipContent>
            </Tooltip>

            {/* Open in New Tab */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={"secondary"}
                  size="icon"
                  className="rounded-full h-8 w-8 hover:bg-secondary transition-colors"
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
                className="flex items-center gap-1 rounded-full h-8 px-3 hover:bg-secondary transition-colors"
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

        {/* Live Copernicus Marine Map Container with Hardware Acceleration */}
        <div className="flex-1 w-full h-full min-h-[400px] mb-4 relative rounded-xl overflow-hidden border border-border/60 bg-muted/20 shadow-inner">
          {/* High-Tech Loading Overlay */}
          {!isLoaded && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-md gap-3">
              <div className="relative">
                <Loader2 className="size-8 animate-spin text-primary" />
                <Waves className="size-4 text-primary absolute inset-0 m-auto" />
              </div>
              <div className="flex flex-col items-center text-center gap-1">
                <p className="text-xs font-semibold text-foreground">
                  Initializing Copernicus Marine WebGL Engine...
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Streaming satellite bathymetry & ocean physics layers
                </p>
              </div>
            </div>
          )}

          {/* Iframe with GPU acceleration and keep-alive */}
          {hasOpenedOnce && (
            <iframe
              ref={iframeRef}
              src="https://data.marine.copernicus.eu/-/mhal4xhrnv"
              width="100%"
              height="100%"
              className={cn(
                "w-full h-full border-0 min-h-[350px] rounded-lg transition-opacity duration-500",
                isLoaded ? "opacity-100" : "opacity-0",
              )}
              style={{
                transform: "translateZ(0)",
                willChange: "transform",
              }}
              allow="geolocation; fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              title="Copernicus Marine Satellite & Ocean GIS Map"
              loading="eager"
              onLoad={() => setIsLoaded(true)}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
