import { Server as HTTPServer } from "http";
import { Server, ServerOptions } from "socket.io";
import { socketAuthMiddleware } from "./socketAuth";
import { setupSocketHandlers } from "./socketHandlers";
import { socketInstance } from "./socketInstance";

/**
 * Initialize Socket.IO server
 * @param httpServer - HTTP server instance
 * @returns Socket.IO server instance
 */
export const initializeSocket = (httpServer: HTTPServer): Server => {
  // Socket.IO configuration
  const socketConfig: Partial<ServerOptions> = {
    cors: {
      origin: true, // Allow all origins (configure as needed)
      credentials: true,
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  };

  // Create Socket.IO server
  const io = new Server(httpServer, socketConfig);

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Set up event handlers
  setupSocketHandlers(io);

  // Store instance in singleton for global access
  socketInstance.setIO(io);

  console.log("🔌 Socket.IO server initialized successfully");

  return io;
};

export { socketInstance } from "./socketInstance";
