import pino from "pino";

export type Log = Pick<
  ReturnType<typeof pino>,
  "debug" | "error" | "info" | "warn"
>;

const baseOptions = {
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
};

export const log =
  process.env.NODE_ENV === "production"
    ? pino(baseOptions)
    : pino({
        ...baseOptions,
        level: "debug",
        transport: {
          target: "pino-pretty",
        },
      });
