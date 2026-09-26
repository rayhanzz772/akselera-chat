import { apiRequest } from "./client";

export interface RegisterPayload {
	name: string;
	email: string;
	password: string;
	public_key: string;
	encrypted_private_key: string;
	key_derivation_salt: string;
}

export interface loginPayload {
  email: string;
  password: string;
}

export interface RegisterResponse {
	message?: string;
	[key: string]: unknown;
}

export interface LoginResponse {
  message?: string;
  [key: string]: unknown;
}

export function registerUser(payload: RegisterPayload) {
	return apiRequest<RegisterResponse>("/auth/register", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export function loginUser(payload: loginPayload) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
