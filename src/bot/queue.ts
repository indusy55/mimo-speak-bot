export type ChatQueue = {
  run: <T>(chatId: number, task: () => Promise<T>) => Promise<T>;
};

export function createChatQueue(): ChatQueue {
  const lanes = new Map<number, Promise<unknown>>();

  return {
    run: async (chatId, task) => {
      const previous = lanes.get(chatId) ?? Promise.resolve();
      const current = previous.catch(() => undefined).then(task);

      lanes.set(chatId, current);

      try {
        return await current;
      } finally {
        if (lanes.get(chatId) === current) {
          lanes.delete(chatId);
        }
      }
    },
  };
}
