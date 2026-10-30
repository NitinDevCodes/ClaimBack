import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ClaimBack' },
});

export function errorMessage(error) {
  if (error.response?.data?.error?.message) return error.response.data.error.message;
  if (error.code === 'ECONNABORTED') return 'The request took too long. Please try again.';
  if (!error.response) return 'We could not reach the server. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

export function fieldErrors(error) {
  return Object.fromEntries((error.response?.data?.error?.details || []).map((detail) => [detail.field, detail.message]));
}
