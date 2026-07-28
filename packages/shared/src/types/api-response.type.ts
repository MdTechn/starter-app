export type ApiResponse<T> = {
  data: T;
  message?: string;
};

export type ApiErrorResponse = {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
};
