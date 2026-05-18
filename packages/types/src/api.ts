/** Standard API success response */
export interface ApiResponse<T> {
  success: true;
  data: T;
  message: string;
}

/** Standard API paginated response */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

/** Standard API error response */
export interface ApiError {
  success: false;
  error: string;
  message: string;
}

/** Auth token pair */
export interface TokenPair {
  accessToken: string;
}

/** JWT payload */
export interface JwtPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}
