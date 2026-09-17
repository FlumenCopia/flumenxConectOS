import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  errors?: any;
}

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message: string = 'Operation successful',
  statusCode: number = 200
): Response => {
  const payload: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(payload);
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: { total: number; page: number; limit: number },
  message: string = 'Data retrieved successfully',
  statusCode: number = 200
): Response => {
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const payload: ApiResponse<T[]> = {
    success: true,
    message,
    data,
    pagination: {
      ...pagination,
      totalPages,
    },
  };
  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 500,
  errors?: any
): Response => {
  const payload: ApiResponse = {
    success: false,
    message,
    errors,
  };
  return res.status(statusCode).json(payload);
};
