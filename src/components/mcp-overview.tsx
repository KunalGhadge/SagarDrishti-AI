"use client";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MCPIcon } from "ui/mcp-icon";
import { Button } from "ui/button";

export const RECOMMENDED_MCPS = [
  {
    name: "isro-mosdac-ocean",
    label: "ISRO MOSDAC (Oceansat-3 / INSAT-3DR)",
    icon: "🛰️",
    config: {
      url: "https://mosdac.isro.gov.in/mcp/v1/sse",
      headers: {
        "X-Agency": "ISRO-DOS",
      },
    },
  },
  {
    name: "imd-cyclone-warning",
    label: "IMD Marine Cyclone & Gale Warning",
    icon: "🌪️",
    config: {
      url: "https://mausam.imd.gov.in/mcp/marine-bulletins",
      headers: {
        "X-Service": "IMD-MoES",
      },
    },
  },
  {
    name: "incois-pfz-advisory",
    label: "INCOIS Potential Fishing Zone (PFZ)",
    icon: "🌊",
    config: {
      url: "https://incois.gov.in/mcp/pfz-advisory",
      headers: {
        "X-Source": "INCOIS-MoES",
      },
    },
  },
  {
    name: "ais-vessel-tracking",
    label: "AIS Real-Time Vessel Traffic & IMBL",
    icon: "🚢",
    config: {
      url: "https://ais.sagardrishti.in/mcp/vessel-feed",
      headers: {
        Authorization: "Bearer ${input:ais_feed_pat}",
      },
    },
  },
  {
    name: "open-meteo-marine",
    label: "Open-Meteo Ocean Waves & Sea State",
    icon: "🌐",
    config: {
      url: "https://marine-api.open-meteo.com/v1/marine?current=wave_height,ocean_current_velocity",
    },
  },
  {
    name: "imo-fsa-safety",
    label: "IMO Formal Safety Assessment (FSA)",
    icon: "⚓",
    config: {
      url: "https://safety.sagardrishti.in/mcp/imo-fsa",
      headers: {
        "X-Standard": "MSC-MEPC.2-Circ.12",
      },
    },
  },
  {
    name: "coastguard-fisheries",
    label: "Indian Coast Guard & Fisheries Policy",
    icon: "📰",
    config: {
      url: "https://dof.gov.in/mcp/gazette-feed",
      headers: {
        "X-Region": "Indian-EEZ",
      },
    },
  },
  {
    name: "gebco-bathymetry",
    label: "GEBCO Coastal Bathymetry & Depth",
    icon: "🗺️",
    config: {
      url: "https://gebco.net/mcp/bathymetry-grid",
    },
  },
];

export function MCPOverview() {
  const t = useTranslations("MCP");

  const handleMcpClick = (
    e: React.MouseEvent,
    mcp: (typeof RECOMMENDED_MCPS)[number],
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const params = new URLSearchParams();
    params.set("name", mcp.name);
    params.set("config", JSON.stringify(mcp.config, null, 2));

    window.location.href = `/mcp/create?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/mcp/create"
        className="rounded-lg overflow-hidden cursor-pointer p-12 text-center relative group transition-all duration-300 "
      >
        <div className="flex flex-col items-center justify-center space-y-4 my-20">
          <h3 className="text-2xl md:text-4xl font-semibold flex items-center gap-3">
            <MCPIcon className="fill-foreground size-6 hidden sm:block" />
            {t("overviewTitle")}
          </h3>

          <p className="text-muted-foreground max-w-md">
            {t("overviewDescription")}
          </p>

          <div className="flex items-center gap-2 text-xl font-bold">
            {t("addMcpServer")}
            <ArrowUpRight className="size-6" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          {RECOMMENDED_MCPS.map((mcp) => (
            <Button
              key={mcp.name}
              variant={"secondary"}
              className="hover:translate-y-[-2px] transition-all duration-300 flex items-center gap-2"
              onClick={(e) => handleMcpClick(e, mcp)}
            >
              <span className="text-base">{mcp.icon}</span>
              <span>{mcp.label}</span>
            </Button>
          ))}
        </div>
      </Link>
    </div>
  );
}
