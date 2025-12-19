import { Server } from "socket.io";

/**
 * Socket.IO instance singleton
 * This allows us to emit events from anywhere in the application
 */
class SocketInstance {
  private io: Server | null = null;

  /**
   * Initialize the Socket.IO instance
   */
  public setIO(io: Server): void {
    this.io = io;
    console.log("✅ Socket.IO instance initialized");
  }

  /**
   * Get the Socket.IO instance
   */
  public getIO(): Server {
    if (!this.io) {
      throw new Error("Socket.IO instance not initialized. Call setIO first.");
    }
    return this.io;
  }

  /**
   * Check if Socket.IO is initialized
   */
  public isInitialized(): boolean {
    return this.io !== null;
  }

  /**
   * Emit event to specific user
   */
  public emitToUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  /**
   * Emit event to multiple users
   */
  public emitToUsers(userIds: string[], event: string, data: any): void {
    if (this.io) {
      userIds.forEach((userId) => {
        this.io!.to(`user:${userId}`).emit(event, data);
      });
    }
  }

  /**
   * Emit event to specific role
   */
  public emitToRole(role: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`role:${role}`).emit(event, data);
    }
  }

  /**
   * Emit event to specific business
   */
  public emitToBusiness(businessId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`business:${businessId}`).emit(event, data);
    }
  }

  /**
   * Broadcast event to all connected users
   */
  public broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }
}

// Export singleton instance
export const socketInstance = new SocketInstance();
