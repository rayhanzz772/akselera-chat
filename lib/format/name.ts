/**
 * Inisial dari sebuah nama, maksimal dua huruf.
 * Satu implementasi untuk semua tempat: daftar percakapan, daftar user, dan header.
 */
export function initialsFrom(name: string) {
	return name
		.split(" ")
		.filter((part) => part.length > 0)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}
