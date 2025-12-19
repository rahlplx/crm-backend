import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AuthServices } from "./auth.service";
import envVars from "../../config/env";

const login = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.login(req.body);

  // Set JWT in httpOnly cookie
  const cookieOptions = {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: envVars.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict" as const, // CSRF protection
    maxAge: envVars.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000, // Convert days to milliseconds
  };

  res.cookie("token", result.token, cookieOptions);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Login successful",
    data: {
      user: result.user,
    },
  });
});

const logout = catchAsync(async (_req: Request, res: Response) => {
  // Clear the cookie
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0), // Expire immediately
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Logout successful",
    data: null,
  });
});

export const AuthControllers = {
  login,
  logout,
};
