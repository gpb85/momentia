import crypto from "crypto";

export const generateAccessToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};
