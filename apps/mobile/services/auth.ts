/** Phone-OTP authentication client (delivery agents). */
import api from './api';
import type { AgentUser } from '../store/authStore';

type Envelope<T> = { success: boolean; data: T; message?: string };

export const authApi = {
  sendOtp: (phone: string) =>
    api.post<Envelope<{ message: string }>>('/auth/send-otp', { phone }).then((r) => r.data.data),

  verifyOtp: (phone: string, otp: string) =>
    api
      .post<Envelope<{ accessToken: string; user: AgentUser }>>('/auth/verify-otp', { phone, otp })
      .then((r) => r.data.data),

  logout: () => api.delete('/auth/logout').catch(() => undefined),
};
