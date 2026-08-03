/**
 * 校验 IPv4 地址格式（严格校验每个八位组为 0~255）
 * 例：192.168.1.100 → true；999.1.1.1 → false
 */
export function isValidIpv4(ip: string): boolean {
  const parts = (ip || '').trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(
    (p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255
  );
}
