import { customModelProvider } from "lib/ai/models";

export const GET = async () => {
  return Response.json(
    customModelProvider.modelsInfo.sort((a, b) => {
      if (a.provider === "google" && b.provider !== "google") return -1;
      if (b.provider === "google" && a.provider !== "google") return 1;
      if (a.hasAPIKey && !b.hasAPIKey) return -1;
      if (!a.hasAPIKey && b.hasAPIKey) return 1;
      return 0;
    }),
  );
};
