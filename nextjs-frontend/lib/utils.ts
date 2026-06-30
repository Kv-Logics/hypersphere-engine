export function parseUTCDateTime(dateStr: string) {
    if (!dateStr) return new Date();
    // If it doesn't end with Z or a timezone offset, append Z to force UTC parsing
    if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !dateStr.match(/-\d{2}:\d{2}$/)) {
        return new Date(dateStr + "Z");
    }
    return new Date(dateStr);
}
