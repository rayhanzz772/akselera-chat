import { apiRequest, clearAuthToken, setAuthToken } from "./client";

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
	access_token?: string;
	token?: string;
	data?: {
		access_token?: string;
		token?: string;
	};
  [key: string]: unknown;
}

export interface CurrentUser {
	id: string | number;
	name: string;
	email: string;
	encrypted_private_key?: string;
	key_derivation_salt?: string;
}

export function registerUser(payload: RegisterPayload) {
	return apiRequest<RegisterResponse>("/auth/register", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function loginUser(payload: loginPayload) {
	const response = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

	const token = response.access_token || response.token || response.data?.access_token || response.data?.token;
	if (token) setAuthToken(token);

	return response;
}

export async function getCurrentUser() {
	const response = await apiRequest<CurrentUser | { data: CurrentUser }>("/auth/me");

	return "data" in response ? response.data : response;
}

export { clearAuthToken };
