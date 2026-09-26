const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api/v1";

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
		headers: {
			"Content-Type": "application/json",
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
