import { createPieChartTool } from "./visualization/create-pie-chart";
import { createBarChartTool } from "./visualization/create-bar-chart";
import { createLineChartTool } from "./visualization/create-line-chart";
import { createTableTool } from "./visualization/create-table";
import { createMapViewTool } from "./visualization/create-map-view";
import { exaSearchTool, exaContentsTool } from "./web/web-search";
import { AppDefaultToolkit, DefaultToolName } from ".";
import { Tool } from "ai";
import { httpFetchTool } from "./http/fetch";
import { jsExecutionTool } from "./code/js-run-tool";
import { pythonExecutionTool } from "./code/python-run-tool";
import { imdWeatherTool } from "./marine/imd-weather-tool";
import { cycloneTool } from "./marine/cyclone-tool";
import { marinePhysicsTool } from "./marine/marine-physics-tool";
import { noaaChlorophyllTool } from "./marine/noaa-chlorophyll-tool";

export const APP_DEFAULT_TOOL_KIT: Record<
  AppDefaultToolkit,
  Record<string, Tool>
> = {
  [AppDefaultToolkit.Visualization]: {
    [DefaultToolName.CreatePieChart]: createPieChartTool,
    [DefaultToolName.CreateBarChart]: createBarChartTool,
    [DefaultToolName.CreateLineChart]: createLineChartTool,
    [DefaultToolName.CreateTable]: createTableTool,
    [DefaultToolName.CreateMapView]: createMapViewTool,
  },
  [AppDefaultToolkit.WebSearch]: {
    [DefaultToolName.WebSearch]: exaSearchTool,
    [DefaultToolName.WebContent]: exaContentsTool,
  },
  [AppDefaultToolkit.Http]: {
    [DefaultToolName.Http]: httpFetchTool,
  },
  [AppDefaultToolkit.Code]: {
    [DefaultToolName.JavascriptExecution]: jsExecutionTool,
    [DefaultToolName.PythonExecution]: pythonExecutionTool,
  },
  [AppDefaultToolkit.Marine]: {
    [DefaultToolName.ImdWeather]: imdWeatherTool,
    [DefaultToolName.CycloneTracking]: cycloneTool,
    [DefaultToolName.MarinePhysics]: marinePhysicsTool,
    [DefaultToolName.NoaaChlorophyll]: noaaChlorophyllTool,
  },
};

export function getFlatToolRegistry(extraTools?: Record<string, Tool>): Record<string, Tool> {
  const flat: Record<string, Tool> = {};
  for (const kit of Object.values(APP_DEFAULT_TOOL_KIT)) {
    Object.assign(flat, kit);
  }
  if (extraTools) {
    Object.assign(flat, extraTools);
  }
  return flat;
}

export function resolveToolsForAgent(
  mentions?: any[],
  extraTools?: Record<string, Tool>
): {
  mountedTools: Record<string, Tool>;
  mountedToolNames: string[];
  unmountedConfiguredTools: string[];
  configuredToolNames: string[];
} {
  const allAvailableTools = getFlatToolRegistry(extraTools);
  const mountedTools: Record<string, Tool> = {};
  const mountedToolNames: string[] = [];
  const unmountedConfiguredTools: string[] = [];
  const configuredToolNames: string[] = [];

  if (!mentions || mentions.length === 0) {
    return {
      mountedTools: allAvailableTools,
      mountedToolNames: Object.keys(allAvailableTools),
      unmountedConfiguredTools: [],
      configuredToolNames: [],
    };
  }

  for (const mention of mentions) {
    const toolKey = mention.name;
    if (mention.type === "defaultTool") {
      configuredToolNames.push(toolKey);
      if (allAvailableTools[toolKey]) {
        mountedTools[toolKey] = allAvailableTools[toolKey];
        mountedToolNames.push(toolKey);
      } else {
        unmountedConfiguredTools.push(toolKey);
      }
    } else if (mention.type === "mcpTool" && extraTools?.[toolKey]) {
      configuredToolNames.push(toolKey);
      mountedTools[toolKey] = extraTools[toolKey];
      mountedToolNames.push(toolKey);
    } else if (mention.type === "workflow" && extraTools?.[toolKey]) {
      configuredToolNames.push(toolKey);
      mountedTools[toolKey] = extraTools[toolKey];
      mountedToolNames.push(toolKey);
    }
  }

  return {
    mountedTools,
    mountedToolNames,
    unmountedConfiguredTools,
    configuredToolNames,
  };
}

