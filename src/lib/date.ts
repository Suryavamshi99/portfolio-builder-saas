export function formatRelativeDate(dateInput: string | number | Date): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (isNaN(diffMs)) {
    return "recently";
  }

  // Handle future dates or just now
  if (diffMs < 30 * 1000) {
    return "just now";
  }

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return `${diffSec} ${diffSec === 1 ? "second" : "seconds"} ago`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? "month" : "months"} ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} ${diffYears === 1 ? "year" : "years"} ago`;
}
