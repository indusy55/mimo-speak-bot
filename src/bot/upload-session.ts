import type { Context } from "grammy";

export type UploadSession = {
  commandMessageId: number;
  promptMessageId?: number;
  voiceName: string;
};

export type UploadSessions = {
  cancel: (chatId: number, userId: number) => UploadSession | undefined;
  finish: (chatId: number, userId: number) => void;
  read: (
    chatId: number,
    userId: number,
    message: NonNullable<Context["message"]>,
  ) => UploadSession | undefined;
  start: (chatId: number, userId: number, session: UploadSession) => void;
};

export function createUploadSessions(): UploadSessions {
  const sessions = new Map<string, UploadSession>();

  return {
    cancel: (chatId, userId) => {
      const key = readKey(chatId, userId);
      const session = sessions.get(key);
      sessions.delete(key);
      return session;
    },
    finish: (chatId, userId) => {
      sessions.delete(readKey(chatId, userId));
    },
    read: (chatId, userId, message) => {
      const session = sessions.get(readKey(chatId, userId));

      if (!session) {
        return undefined;
      }

      const replyToId = message.reply_to_message?.message_id;

      if (
        replyToId !== undefined &&
        replyToId !== session.commandMessageId &&
        replyToId !== session.promptMessageId
      ) {
        return undefined;
      }

      return session;
    },
    start: (chatId, userId, session) => {
      sessions.set(readKey(chatId, userId), session);
    },
  };
}

function readKey(chatId: number, userId: number) {
  return `${chatId}:${userId}`;
}
