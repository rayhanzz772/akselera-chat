export type Room = {
	id: string;
	initials: string;
	name: string;
	preview: string;
	time: string;
	publicKey?: JsonWebKey | string;
	opponentId: string;
};

export type Conversation = {
	id: string;
	created_at: string;
	opponent: {
		id: string;
		name: string;
		email: string;
		public_key?: JsonWebKey | string;
	};
	last_message: {
		id: string;
		sender_id: string;
		ciphertext: string;
		iv: string;
		auth_tag: string;
		created_at: string;
	} | null;
};

export type ConversationsResponse = {
	success: boolean;
	message: string;
	metadata: {
		per_page: number;
		current_page: number;
		total_row: number;
		total_page: number;
	};
	data: Conversation[];
};

export type EncryptedMessage = {
	id: string;
	conversation_id: string;
	sender_id: string;
	ciphertext: string;
	iv: string;
	auth_tag: string;
	created_at: string;
};

export type DecryptedMessage = EncryptedMessage & {
	text: string;
};

export type UserSummary = {
	id: string;
	name: string;
	email: string;
};

export type UsersResponse = {
	success: boolean;
	message: string;
	metadata: {
		per_page: number;
		current_page: number;
		total_row: number;
		total_page: number;
	};
	data: UserSummary[];
};