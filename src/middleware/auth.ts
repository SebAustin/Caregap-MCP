import type { Request, Response, NextFunction } from "express";
import { getApiKeys } from "../config.js";
import { logger } from "../util/logger.js";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const validKeys = getApiKeys();

  if (validKeys.length === 0) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.warn("Missing Authorization header");
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing Authorization header. Use: Bearer <api-key>",
    });
    return;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match?.[1]) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Malformed Authorization header. Use: Bearer <api-key>",
    });
    return;
  }

  const token = match[1];

  if (!validKeys.includes(token)) {
    logger.warn("Invalid API key presented");
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key",
    });
    return;
  }

  next();
}
