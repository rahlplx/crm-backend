import { StatusCodes } from "http-status-codes";
import AppError from "../../errorHelpers/AppError";
import {
  IRegularContent,
  IRegularContentQueryParams,
  IRegularContentPaginatedResponse,
  ContentType,
} from "./regularContent.interface";
import { RegularContent } from "./regularContent.model";
import { UserRole } from "../user/user.interface";
import { socketInstance } from "../../socket";
import { Business } from "../business/business.model";

/**
 * Helper function to get today's date in MM/DD/YYYY format
 */
const getTodayDateString = (): string => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const year = today.getFullYear();
  return `${month}/${day}/${year}`;
};

/**
 * Helper function to sync tags from content to business
 * Extracts unique hashtags from content tags and appends new ones to business tags
 */
const syncTagsToBusiness = async (
  businessId: string,
  contentTags?: string
): Promise<void> => {
  if (!contentTags || !contentTags.trim()) {
    return; // No tags to sync
  }

  // Find the business
  const business = await Business.findById(businessId);
  if (!business) {
    return; // Business not found, skip sync
  }

  // Extract hashtags from content tags (split by space and filter hashtags)
  const contentHashtags = contentTags
    .trim()
    .split(/\s+/)
    .filter((tag) => tag.startsWith("#") && tag.length > 1)
    .map((tag) => tag.toLowerCase());

  // Extract hashtags from business tags
  const businessTags = business.tags || "";
  const businessHashtags = businessTags
    .trim()
    .split(/\s+/)
    .filter((tag) => tag.startsWith("#") && tag.length > 1)
    .map((tag) => tag.toLowerCase());

  // Find new hashtags that are in content but not in business
  const newHashtags = contentHashtags.filter(
    (tag) => !businessHashtags.includes(tag)
  );

  // If there are new hashtags, append them to business tags
  if (newHashtags.length > 0) {
    const updatedTags = businessTags.trim()
      ? `${businessTags.trim()} ${newHashtags.join(" ")}`
      : newHashtags.join(" ");

    await Business.findByIdAndUpdate(businessId, { tags: updatedTags });

    console.log(
      `✅ Synced ${newHashtags.length} new tag(s) to business ${
        business.businessName
      }: ${newHashtags.join(", ")}`
    );
  }
};

// const createRegularContent = async (
//   payload: Partial<IRegularContent>
// ): Promise<IRegularContent> => {
// Create the content
// const content = await RegularContent.create(payload);

// Sync tags to business if tags are provided
// if (payload.business && payload.tags) {
//   const businessId = typeof payload.business === 'string'
//     ? payload.business
//     : payload.business.toString();
//   await syncTagsToBusiness(businessId, payload.tags);
// }

// Populate references for complete data in notification
// const populatedContent = await RegularContent.findById(content._id)
//   .populate("business", "businessName typeOfBusiness contactPerson")
//   .populate("addedBy", "username roles")
//   .populate("assignedCD", "username roles")
//   .populate("assignedCW", "username roles")
//   .populate("assignedVE", "username roles");

// if (!populatedContent) {
//   return content;
// }

// Emit real-time notifications based on contentType
// if (socketInstance.isInitialized()) {
//   const notificationData = {
//     contentId: populatedContent._id,
//     business: (populatedContent.business as any)?.businessName || "Unknown",
//     date: populatedContent.date,
//     contentType: populatedContent.contentType,
//     addedBy: (populatedContent.addedBy as any)?.username || "Unknown",
//     postMaterial: populatedContent.postMaterial,
//     posterMaterial: populatedContent.posterMaterial,
//     videoMaterial: populatedContent.videoMaterial,
//     vision: populatedContent.vision,
//     tags: populatedContent.tags,
//     createdAt: populatedContent.createdAt,
//   };

//   // Notify Content Designer if contentType is "poster" or "both"
//   if (
//     populatedContent.contentType === ContentType.POSTER ||
//     populatedContent.contentType === ContentType.BOTH
//   ) {
//     const assignedCDId =
//       typeof populatedContent.assignedCD === "object"
//         ? (populatedContent.assignedCD as any)._id.toString()
//         : String(populatedContent.assignedCD);

//     socketInstance.emitToUser(assignedCDId, "new:content", {
//       ...notificationData,
//       message: "New poster content assigned to you",
//       type: "poster",
//     });

//     console.log(
//       `📢 Notification sent to Content Designer (${assignedCDId}) for ${populatedContent.contentType} content`
//     );
//   }

//   // Notify Video Editor if contentType is "video" or "both"
//   if (
//     populatedContent.assignedVE &&
//     (populatedContent.contentType === ContentType.VIDEO ||
//       populatedContent.contentType === ContentType.BOTH)
//   ) {
//     const assignedVEId =
//       typeof populatedContent.assignedVE === "object"
//         ? (populatedContent.assignedVE as any)._id.toString()
//         : String(populatedContent.assignedVE);

//     socketInstance.emitToUser(assignedVEId, "new:content", {
//       ...notificationData,
//       message: "New video content assigned to you",
//       type: "video",
//     });

//     console.log(
//       `📢 Notification sent to Video Editor (${assignedVEId}) for ${populatedContent.contentType} content`
//     );
//   }
// }

//   return populatedContent;
// };
const createRegularContent = async (
  user: any,
  payload: Partial<IRegularContent>
): Promise<IRegularContent> => {
  const business = await Business.findById(payload.business);

  if (!business) {
    throw new AppError(StatusCodes.NOT_FOUND, "Business not found");
  }

  const newPayload = {
    ...payload,
    addedBy: user.id,
    assignedCD: business.assignedCD ? business.assignedCD[0] : undefined, // Take the first user
    assignedCW: business.assignedCW ? business.assignedCW[0] : undefined, // Take the first user
    assignedVE: business.assignedVE ? business.assignedVE[0] : undefined, // Take the first user if it exists
  };

  const content = await RegularContent.create(newPayload);

  // ... (the rest of your service function for notifications is correct)
  // ... (your existing code for notifications)
  const populatedContent = await RegularContent.findById(content._id)
    .populate("business", "businessName typeOfBusiness contactPerson")
    .populate("addedBy", "username roles")
    .populate("assignedCD", "username roles")
    .populate("assignedCW", "username roles")
    .populate("assignedVE", "username roles");

  if (!populatedContent) {
    return content;
  }
  if (socketInstance.isInitialized()) {
    const notificationData = {
      contentId: populatedContent._id,
      business: (populatedContent.business as any)?.businessName || "Unknown",
      date: populatedContent.date,
      contentType: populatedContent.contentType,
      addedBy: (populatedContent.addedBy as any)?.username || "Unknown",
      postMaterial: populatedContent.postMaterial,
      posterMaterial: populatedContent.posterMaterial,
      videoMaterial: populatedContent.videoMaterial,
      vision: populatedContent.vision,
      tags: populatedContent.tags,
      createdAt: populatedContent.createdAt,
    };
    if (
      populatedContent.contentType === ContentType.POSTER ||
      populatedContent.contentType === ContentType.BOTH
    ) {
      const assignedCDId =
        typeof populatedContent.assignedCD === "object"
          ? (populatedContent.assignedCD as any)._id.toString()
          : String(populatedContent.assignedCD);

      socketInstance.emitToUser(assignedCDId, "new:content", {
        ...notificationData,
        message: "New poster content assigned to you",
        type: "poster",
      });

      console.log(
        `📢 Notification sent to Content Designer (${assignedCDId}) for ${populatedContent.contentType} content`
      );
    }
    if (
      populatedContent.assignedVE &&
      (populatedContent.contentType === ContentType.VIDEO ||
        populatedContent.contentType === ContentType.BOTH)
    ) {
      const assignedVEId =
        typeof populatedContent.assignedVE === "object"
          ? (populatedContent.assignedVE as any)._id.toString()
          : String(populatedContent.assignedVE);

      socketInstance.emitToUser(assignedVEId, "new:content", {
        ...notificationData,
        message: "New video content assigned to you",
        type: "video",
      });

      console.log(
        `📢 Notification sent to Video Editor (${assignedVEId}) for ${populatedContent.contentType} content`
      );
    }
  }

  return populatedContent;
};
const getAllRegularContents = async (
  queryParams: IRegularContentQueryParams,
  user: any
): Promise<IRegularContentPaginatedResponse> => {
  // Build the query filter
  const filter: any = {};

  // Date filtering
  if (queryParams.todayOnly === "true") {
    filter.date = getTodayDateString();
  } else if (queryParams.date) {
    filter.date = queryParams.date;
  }

  // Business filtering
  if (queryParams.business) {
    filter.business = queryParams.business;
  }

  // Assignment filtering
  if (queryParams.assignedCD) {
    filter.assignedCD = queryParams.assignedCD;
  }
  if (queryParams.assignedCW) {
    filter.assignedCW = queryParams.assignedCW;
  }
  if (queryParams.assignedVE) {
    filter.assignedVE = queryParams.assignedVE;
  }
  if (queryParams.addedBy) {
    filter.addedBy = queryParams.addedBy;
  }

  // Status filtering (optional - shows all content by default)
  if (queryParams.status !== undefined) {
    filter.status = queryParams.status === "true";
  }

  // ContentType filtering (optional query param)
  if (queryParams.contentType) {
    filter.contentType = queryParams.contentType;
  }

  // Role-based filtering with contentType visibility
  if (
    user &&
    !user.roles.includes(UserRole.SUPER_ADMIN) &&
    !user.roles.includes(UserRole.ADMIN) &&
    !user.roles.includes(UserRole.CONTENT_WRITER)
  ) {
    // Content Designers: see only poster/both content assigned to them
    if (user.roles.includes(UserRole.CONTENT_DESIGNER)) {
      filter.assignedCD = user.id;
      filter.contentType = { $in: ["poster", "both"] };
    }
    // Video Editors: see only video/both content assigned to them
    else if (user.roles.includes(UserRole.VIDEO_EDITOR)) {
      filter.assignedVE = user.id;
      filter.contentType = { $in: ["video", "both"] };
    }
  }

  // Pagination
  const page = parseInt(queryParams.page || "1");
  const limit = parseInt(queryParams.limit || "20");
  const skip = (page - 1) * limit;

  // Sorting
  const sortBy = queryParams.sortBy || "date";
  const sortOrder = queryParams.sortOrder === "asc" ? 1 : -1;
  const sortOptions: any = { [sortBy]: sortOrder };

  // Add secondary sort by createdAt for consistency
  if (sortBy !== "createdAt") {
    sortOptions.createdAt = -1;
  }

  // Execute query with population
  const [contents, total] = await Promise.all([
    RegularContent.find(filter)
      .populate("business", "businessName typeOfBusiness contactPerson")
      .populate("addedBy", "username roles")
      .populate("assignedCD", "username roles")
      .populate("assignedCW", "username roles")
      .populate("assignedVE", "username roles")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean() as Promise<any[]>,
    RegularContent.countDocuments(filter),
  ]);

  return {
    contents: contents as IRegularContent[],
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getRegularContentById = async (
  id: string
): Promise<IRegularContent | null> => {
  const content = await RegularContent.findById(id)
    .populate("business", "businessName typeOfBusiness contactPerson")
    .populate("addedBy", "username roles")
    .populate("assignedCD", "username roles")
    .populate("assignedCW", "username roles")
    .populate("assignedVE", "username roles");

  if (!content) {
    throw new AppError(StatusCodes.NOT_FOUND, "Regular content not found");
  }

  return content;
};

const updateRegularContent = async (
  id: string,
  payload: Partial<IRegularContent>,
  user: any
): Promise<IRegularContent | null> => {
  // Get the existing content to access business ID
  const existingContent = await RegularContent.findById(id);

  if (!existingContent) {
    throw new AppError(StatusCodes.NOT_FOUND, "Regular content not found");
  }

  // Check authorization: Only users assigned to the business can update
  // Super Admin and Admin can update any content
  if (!user.roles.includes(UserRole.SUPER_ADMIN) && !user.roles.includes(UserRole.ADMIN)) {
    // Get the business to check assignments
    const businessId = typeof existingContent.business === "string"
      ? existingContent.business
      : existingContent.business.toString();

    const business = await Business.findById(businessId);

    if (!business) {
      throw new AppError(StatusCodes.NOT_FOUND, "Business not found");
    }

    // Check if user is assigned to this business
    const isAssignedCW = business.assignedCW?.some((id) => id.toString() === user.id);
    const isAssignedCD = business.assignedCD?.some((id) => id.toString() === user.id);
    const isAssignedVE = business.assignedVE?.some((id) => id.toString() === user.id);

    if (!isAssignedCW && !isAssignedCD && !isAssignedVE) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        "You are not authorized to update content for this business"
      );
    }
  }

  // Update the content
  const content = await RegularContent.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  })
    .populate("business", "businessName typeOfBusiness contactPerson")
    .populate("addedBy", "username roles")
    .populate("assignedCD", "username roles")
    .populate("assignedCW", "username roles")
    .populate("assignedVE", "username roles");

  if (!content) {
    throw new AppError(StatusCodes.NOT_FOUND, "Regular content not found");
  }

  // Sync tags to business if tags are being updated
  if (payload.tags) {
    const businessId = payload.business
      ? typeof payload.business === "string"
        ? payload.business
        : payload.business.toString()
      : typeof existingContent.business === "string"
      ? existingContent.business
      : existingContent.business.toString();

    await syncTagsToBusiness(businessId, payload.tags);
  }

  // Emit Socket.IO notification for content update (bi-directional)
  if (socketInstance.isInitialized()) {
    const notificationData = {
      contentId: content._id,
      business: (content.business as any)?.businessName || "Unknown",
      date: content.date,
      contentType: content.contentType,
      addedBy: (content.addedBy as any)?.username || "Unknown",
      updatedBy: user.username || "Unknown",
      postMaterial: content.postMaterial,
      posterMaterial: content.posterMaterial,
      videoMaterial: content.videoMaterial,
      vision: content.vision,
      tags: content.tags,
      updatedAt: content.updatedAt,
    };

    // Collect all users who should be notified
    const notifiedUsers = new Set<string>();

    // 1. Notify Content Designer if contentType is "poster" or "both"
    if (
      content.contentType === ContentType.POSTER ||
      content.contentType === ContentType.BOTH
    ) {
      const assignedCDId =
        typeof content.assignedCD === "object"
          ? (content.assignedCD as any)._id.toString()
          : String(content.assignedCD);

      if (assignedCDId && assignedCDId !== user.id) {
        socketInstance.emitToUser(assignedCDId, "update:content", {
          ...notificationData,
          message: "Content assigned to you has been updated",
          type: "poster",
        });
        notifiedUsers.add(assignedCDId);
        console.log(
          `📢 Update notification sent to Content Designer (${assignedCDId})`
        );
      }
    }

    // 2. Notify Video Editor if contentType is "video" or "both"
    if (
      content.assignedVE &&
      (content.contentType === ContentType.VIDEO ||
        content.contentType === ContentType.BOTH)
    ) {
      const assignedVEId =
        typeof content.assignedVE === "object"
          ? (content.assignedVE as any)._id.toString()
          : String(content.assignedVE);

      if (assignedVEId && assignedVEId !== user.id) {
        socketInstance.emitToUser(assignedVEId, "update:content", {
          ...notificationData,
          message: "Video content assigned to you has been updated",
          type: "video",
        });
        notifiedUsers.add(assignedVEId);
        console.log(
          `📢 Update notification sent to Video Editor (${assignedVEId})`
        );
      }
    }

    // 3. Notify Content Writer (the creator) if they didn't make the update
    const addedById =
      typeof content.addedBy === "object"
        ? (content.addedBy as any)._id.toString()
        : String(content.addedBy);

    if (addedById && addedById !== user.id && !notifiedUsers.has(addedById)) {
      socketInstance.emitToUser(addedById, "update:content", {
        ...notificationData,
        message: "Content you created has been updated",
        type: "content-writer",
      });
      notifiedUsers.add(addedById);
      console.log(
        `📢 Update notification sent to Content Writer (${addedById})`
      );
    }

    // 4. Notify Content Writer assigned to the business (if different from creator)
    if (content.assignedCW) {
      const assignedCWId =
        typeof content.assignedCW === "object"
          ? (content.assignedCW as any)._id.toString()
          : String(content.assignedCW);

      if (assignedCWId && assignedCWId !== user.id && !notifiedUsers.has(assignedCWId)) {
        socketInstance.emitToUser(assignedCWId, "update:content", {
          ...notificationData,
          message: "Content for your assigned business has been updated",
          type: "content-writer",
        });
        notifiedUsers.add(assignedCWId);
        console.log(
          `📢 Update notification sent to assigned Content Writer (${assignedCWId})`
        );
      }
    }
  }

  return content;
};

const deleteRegularContent = async (id: string, user: any): Promise<void> => {
  // First, get the content with populated fields before deleting
  const content = await RegularContent.findById(id)
    .populate("business", "businessName typeOfBusiness contactPerson")
    .populate("addedBy", "username roles")
    .populate("assignedCD", "username roles")
    .populate("assignedCW", "username roles")
    .populate("assignedVE", "username roles");

  if (!content) {
    throw new AppError(StatusCodes.NOT_FOUND, "Regular content not found");
  }

  // Check authorization: Only users assigned to the business can delete
  // Super Admin and Admin can delete any content
  if (!user.roles.includes(UserRole.SUPER_ADMIN) && !user.roles.includes(UserRole.ADMIN)) {
    // Get the business to check assignments
    const businessId = typeof content.business === "string"
      ? content.business
      : (content.business as any)._id
      ? (content.business as any)._id.toString()
      : content.business.toString();

    const business = await Business.findById(businessId);

    if (!business) {
      throw new AppError(StatusCodes.NOT_FOUND, "Business not found");
    }

    // Check if user is assigned to this business
    const isAssignedCW = business.assignedCW?.some((id) => id.toString() === user.id);
    const isAssignedCD = business.assignedCD?.some((id) => id.toString() === user.id);
    const isAssignedVE = business.assignedVE?.some((id) => id.toString() === user.id);

    if (!isAssignedCW && !isAssignedCD && !isAssignedVE) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        "You are not authorized to delete content for this business"
      );
    }
  }

  // Delete the content
  const result = await RegularContent.findByIdAndDelete(id);

  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, "Regular content not found");
  }

  // Emit Socket.IO notification for content deletion (bi-directional)
  if (socketInstance.isInitialized()) {
    const notificationData = {
      contentId: content._id,
      business: (content.business as any)?.businessName || "Unknown",
      date: content.date,
      contentType: content.contentType,
      addedBy: (content.addedBy as any)?.username || "Unknown",
      deletedBy: user.username || "Unknown",
    };

    // Collect all users who should be notified
    const notifiedUsers = new Set<string>();

    // 1. Notify Content Designer if contentType is "poster" or "both"
    if (
      content.contentType === ContentType.POSTER ||
      content.contentType === ContentType.BOTH
    ) {
      const assignedCDId =
        typeof content.assignedCD === "object"
          ? (content.assignedCD as any)._id.toString()
          : String(content.assignedCD);

      if (assignedCDId && assignedCDId !== user.id) {
        socketInstance.emitToUser(assignedCDId, "delete:content", {
          ...notificationData,
          message: "Content assigned to you has been deleted",
          type: "poster",
        });
        notifiedUsers.add(assignedCDId);
        console.log(
          `📢 Delete notification sent to Content Designer (${assignedCDId})`
        );
      }
    }

    // 2. Notify Video Editor if contentType is "video" or "both"
    if (
      content.assignedVE &&
      (content.contentType === ContentType.VIDEO ||
        content.contentType === ContentType.BOTH)
    ) {
      const assignedVEId =
        typeof content.assignedVE === "object"
          ? (content.assignedVE as any)._id.toString()
          : String(content.assignedVE);

      if (assignedVEId && assignedVEId !== user.id) {
        socketInstance.emitToUser(assignedVEId, "delete:content", {
          ...notificationData,
          message: "Video content assigned to you has been deleted",
          type: "video",
        });
        notifiedUsers.add(assignedVEId);
        console.log(
          `📢 Delete notification sent to Video Editor (${assignedVEId})`
        );
      }
    }

    // 3. Notify Content Writer (the creator) if they didn't delete it
    const addedById =
      typeof content.addedBy === "object"
        ? (content.addedBy as any)._id.toString()
        : String(content.addedBy);

    if (addedById && addedById !== user.id && !notifiedUsers.has(addedById)) {
      socketInstance.emitToUser(addedById, "delete:content", {
        ...notificationData,
        message: "Content you created has been deleted",
        type: "content-writer",
      });
      notifiedUsers.add(addedById);
      console.log(
        `📢 Delete notification sent to Content Writer (${addedById})`
      );
    }

    // 4. Notify Content Writer assigned to the business (if different from creator)
    if (content.assignedCW) {
      const assignedCWId =
        typeof content.assignedCW === "object"
          ? (content.assignedCW as any)._id.toString()
          : String(content.assignedCW);

      if (assignedCWId && assignedCWId !== user.id && !notifiedUsers.has(assignedCWId)) {
        socketInstance.emitToUser(assignedCWId, "delete:content", {
          ...notificationData,
          message: "Content for your assigned business has been deleted",
          type: "content-writer",
        });
        notifiedUsers.add(assignedCWId);
        console.log(
          `📢 Delete notification sent to assigned Content Writer (${assignedCWId})`
        );
      }
    }
  }
};

export const RegularContentServices = {
  createRegularContent,
  getAllRegularContents,
  getRegularContentById,
  updateRegularContent,
  deleteRegularContent,
};
