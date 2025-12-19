import { Server } from "socket.io";
import { AuthenticatedSocket } from "./socketAuth";

/**
 * Set up Socket.IO event handlers
 * @param io - Socket.IO server instance
 */
export const setupSocketHandlers = (io: Server) => {
  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`✅ User connected: ${socket.user?.username} (${socket.id})`);

    // Join user to their personal room (for targeted notifications)
    const userRoom = `user:${socket.user?.id}`;
    socket.join(userRoom);
    console.log(`👤 User ${socket.user?.username} joined room: ${userRoom}`);

    // Optional: Join role-based rooms
    socket.user?.roles.forEach((role) => {
      const roleRoom = `role:${role}`;
      socket.join(roleRoom);
      console.log(`🎭 User ${socket.user?.username} joined role room: ${roleRoom}`);
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(
        `❌ User disconnected: ${socket.user?.username} (${socket.id}) - Reason: ${reason}`
      );
    });

    // Optional: Handle custom events
    socket.on("ping", () => {
      socket.emit("pong");
    });

    // Optional: Client can request to join specific business rooms
    socket.on("join:business", (businessId: string) => {
      if (businessId) {
        socket.join(`business:${businessId}`);
        console.log(`🏢 User ${socket.user?.username} joined business room: ${businessId}`);
      }
    });

    socket.on("leave:business", (businessId: string) => {
      if (businessId) {
        socket.leave(`business:${businessId}`);
        console.log(`🏢 User ${socket.user?.username} left business room: ${businessId}`);
      }
    });
  });
};
