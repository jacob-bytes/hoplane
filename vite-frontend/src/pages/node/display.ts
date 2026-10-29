export const getConnectionStatusMeta = (
  status: "online" | "offline",
): { color: "success" | "danger"; text: string } => {
  if (status === "online") {
    return { color: "success", text: "在线" };
  }

  return { color: "danger", text: "离线" };
};

export const getRemoteSyncErrorMessage = (syncError: string): string => {
  if (syncError === "provider_share_deleted") {
    return "提供方已删除该分享";
  }

  if (syncError === "provider_share_disabled") {
    return "提供方已禁用该分享";
  }

  if (syncError === "provider_share_expired") {
    return "提供方分享已过期";
  }

  return `远程同步失败: ${syncError}`;
};

const FLAG_RULES: Array<[RegExp, string]> = [
  [/(香港|hong\s*kong|\bhk\b)/i, "🇭🇰"],
  [/(台湾|台北|taiwan|taipei|\btw\b)/i, "🇹🇼"],
  [/(日本|东京|大阪|japan|tokyo|osaka|\bjp\b)/i, "🇯🇵"],
  [/(新加坡|singapore|\bsg\b)/i, "🇸🇬"],
  [/(韩国|首尔|korea|seoul|\bkr\b)/i, "🇰🇷"],
  [
    /(美国|洛杉矶|圣何塞|西雅图|纽约|usa|america|los\s*angeles|san\s*jose|seattle|new\s*york|\bus\b)/i,
    "🇺🇸",
  ],
  [/(加拿大|多伦多|canada|toronto|\bca\b)/i, "🇨🇦"],
  [/(德国|法兰克福|germany|frankfurt|\bde\b)/i, "🇩🇪"],
  [/(英国|伦敦|england|britain|london|\b(uk|gb)\b)/i, "🇬🇧"],
  [/(法国|巴黎|france|paris|\bfr\b)/i, "🇫🇷"],
  [/(荷兰|阿姆斯特丹|netherlands|amsterdam|\bnl\b)/i, "🇳🇱"],
  [/(俄罗斯|莫斯科|russia|moscow|\bru\b)/i, "🇷🇺"],
  [/(澳大利亚|澳洲|悉尼|australia|sydney|\bau\b)/i, "🇦🇺"],
  [/(印度|孟买|india|mumbai|\bin\b)/i, "🇮🇳"],
  [/(巴西|圣保罗|brazil|são\s*paulo|sao\s*paulo|\bbr\b)/i, "🇧🇷"],
  [/(土耳其|turkey|türkiye|\btr\b)/i, "🇹🇷"],
  [
    /(中国|上海|广州|北京|深圳|china|shanghai|guangzhou|beijing|shenzhen|\bcn\b)/i,
    "🇨🇳",
  ],
];

/** A small country/region flag inferred from the node name. */
export const getNodeFlag = (name: string): string =>
  FLAG_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? "🌐";
