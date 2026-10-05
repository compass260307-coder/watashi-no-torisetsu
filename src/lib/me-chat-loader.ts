type ChatModule = typeof import("@/components/result/MeUnmeiChat");
let pending: Promise<ChatModule> | undefined;
export function preloadMeChat(): Promise<ChatModule> {
  return pending ??= import("@/components/result/MeUnmeiChat").then(module => {
    return module;
  }).catch(error => {
    pending = undefined;
    throw error;
  });
}
