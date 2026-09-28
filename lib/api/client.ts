const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api/v1";

if (typeof window !== "undefined" && !/^https?:\/\//.test(API_BASE_URL)) {
	console.error(
		`[api] NEXT_PUBLIC_API_URL is missing a protocol (got "${API_BASE_URL}"). ` +
			`It must start with http:// or https:// — otherwise fetch() will treat it as a relative path.`,
	);
}
const AUTH_TOKEN_KEY = "akselera_access_token";

export function getAuthToken() {
	if (typeof window === "undefined") return null;

	return window.sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
	window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
	if (typeof window !== "undefined") {
		window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
	}
}

export class ApiError extends Error {
	constructor(message: string, public readonly status: number) {
		super(message);
		this.name = "ApiError";
	}
}

export async function apiRequest<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		...options,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(getAuthToken()
				? { Authorization: `Bearer ${getAuthToken()}` }
				: {}),
			...options.headers,
		},
	});

	if (!response.ok) {
		const responseBody = await response.json().catch(() => null);
		const message =
			responseBody?.message || "The request could not be completed.";

		throw new ApiError(message, response.status);
	}

	return response.json() as Promise<T>;
}
