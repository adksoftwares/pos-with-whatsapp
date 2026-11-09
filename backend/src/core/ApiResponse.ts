import { Response } from 'express';

export class ApiResponse {
  static success<T>(res: Response, data: T, message: string = 'Success', statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(res: Response, message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500, details?: any) {
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
    });
  }
}
