function maskEmail(value: string) {
  const [local, domain = ""] = value.split("@");
  const visible = local.slice(0, 1) || "*";
  return `${visible}***@${domain}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return value;
  const prefixMatch = value.match(/^\+\d{1,3}/);
  return `${prefixMatch?.[0] ?? ""} ******${digits.slice(-4)}`.trim();
}

function maskProfileUrl(value: string) {
  return value.replace(/(github\.com\/|linkedin\.com\/in\/)([^\s/?#)]+)/i, (_match, prefix: string, handle: string) => {
    const safeHandle = handle
      .split(/[._-]/)
      .map((part) => (part.length <= 2 ? "**" : `${part[0]}***${part[part.length - 1]}`))
      .join("-");
    return `${prefix}${safeHandle}`;
  });
}

export function maskSensitiveText(input = "") {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, maskEmail)
    .replace(/\+?\d[\d\s().-]{8,}\d/g, maskPhone)
    .replace(/(?:https?:\/\/)?(?:www\.)?(github\.com\/[^\s,;)]+|linkedin\.com\/in\/[^\s,;)]+)/gi, maskProfileUrl)
    .replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g, "[redacted-github-token]")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1[redacted]")
    .replace(/(GITHUB_TOKEN\s*=\s*)[^\s]+/gi, "$1[redacted]");
}
