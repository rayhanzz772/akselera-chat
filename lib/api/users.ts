import { apiRequest } from "./client";
import type { UsersResponse } from "@/types/chat";

export function getUsers() {
	return apiRequest<UsersResponse>("/users");
}