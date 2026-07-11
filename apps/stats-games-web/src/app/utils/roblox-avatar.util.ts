/** Avatar headshot público de Roblox (Thumbnails API CDN). */
export function robloxAvatarUrl(userId: string, size = 150): string {
  const id = encodeURIComponent(userId.trim());
  return `https://www.roblox.com/headshot-thumbnail/image?userId=${id}&width=${size}&height=${size}&format=png`;
}
