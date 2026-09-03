import { appStore } from "@/app/store";
import { fetcher } from "lib/utils";
import useSWR, { SWRConfiguration } from "swr";

export const useChatModels = (options?: SWRConfiguration) => {
  return useSWR<
    {
      provider: string;
      hasAPIKey: boolean;
      models: {
        name: string;
        label?: string;
        isToolCallUnsupported: boolean;
        isImageInputUnsupported: boolean;
        supportedFileMimeTypes: string[];
      }[];
    }[]
  >("/api/chat/models", fetcher, {
    dedupingInterval: 60_000 * 5,
    revalidateOnFocus: false,
    fallbackData: [],
    onSuccess: (data) => {
      const status = appStore.getState();
      const googleProvider = data.find((p) => p.provider === "google");
      const targetModel =
        googleProvider?.models.find((m) => m.name === "gemini-3.1-flash-lite")?.name ||
        googleProvider?.models.find((m) => m.name === "gemini-3.5-flash")?.name ||
        googleProvider?.models.find((m) => m.name === "gemini-2.5-flash-lite")?.name ||
        googleProvider?.models[0]?.name ||
        data.find((p) => p.hasAPIKey)?.models[0]?.name ||
        data[0]?.models[0]?.name;

      const targetProvider =
        googleProvider?.provider ||
        data.find((p) => p.hasAPIKey)?.provider ||
        data[0]?.provider;

      if (
        !status.chatModel ||
        status.chatModel.model === "gemini-2.5-flash" ||
        status.chatModel.model === "gemini-3.5-flash" ||
        (status.chatModel.provider !== "google" && googleProvider?.hasAPIKey)
      ) {
        if (targetProvider && targetModel) {
          appStore.setState({
            chatModel: { provider: targetProvider, model: targetModel },
          });
        }
      }
    },
    ...options,
  });
};
