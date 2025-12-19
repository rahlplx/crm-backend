import { Socket } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";
import envVars from "../config/env";

// Extend Socket interface to include user data
export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    username: string;
    roles: string[];
  };
}

/**
 * Socket.IO authentication middleware
 * Verifies JWT token from either:
 * 1. Handshake auth object (preferred for Socket.IO client)
 * 2. Cookies (for httpOnly cookie authentication)
 * 3. Query parameters (fallback)
 */
export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  try {
    // Get token from handshake auth, cookies, or query params
    let token = socket.handshake.auth?.token || socket.handshake.query?.token;

    // If no token in auth/query, try to extract from cookies
    if (!token) {
      const cookies = socket.handshake.headers.cookie;
      if (cookies) {
        const tokenMatch = cookies.match(/token=([^;]+)/);
        token = tokenMatch ? tokenMatch[1] : null;
      }
    }

    if (!token || typeof token !== "string") {
      console.log("❌ Socket auth failed: No token found", {
        hasAuth: !!socket.handshake.auth?.token,
        hasQuery: !!socket.handshake.query?.token,
        hasCookies: !!socket.handshake.headers.cookie,
      });
      return next(new Error("Authentication error: Token required"));
    }

    console.log("🔐 Socket auth: Token found, verifying...");

    // Verify JWT token
    const decoded = jwt.verify(token, envVars.JWT_SECRET) as JwtPayload & {
      id: string;
      username: string;
      roles: string[];
    };

    // Attach user data to socket
    socket.user = {
      id: decoded.id,
      username: decoded.username,
      roles: decoded.roles,
    };

    next();
  } catch (err: any) {
    if (err.name === "JsonWebTokenError") {
      next(new Error("Authentication error: Invalid token"));
    } else if (err.name === "TokenExpiredError") {
      next(new Error("Authentication error: Token expired"));
    } else {
      next(new Error("Authentication error"));
    }
  }
};
