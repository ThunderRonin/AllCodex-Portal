const PRIVATE_RANGES = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
];

export function validateAllKnowerUrl(rawUrl: string): string {
    const url = new URL(rawUrl);

    const isProd = process.env.NODE_ENV === "production";
    if (isProd && url.protocol !== "https:") {
        throw new Error("AllKnower URL must use HTTPS in production");
    }
    if (!isProd && url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("AllKnower URL must use HTTP or HTTPS");
    }

    const hostname = url.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

    if (isProd && isLocalhost) {
        throw new Error("AllKnower URL must not target localhost in production");
    }

    if (!isLocalhost) {
        for (const range of PRIVATE_RANGES) {
            if (range.test(hostname)) {
                throw new Error("AllKnower URL must not target private network ranges");
            }
        }
        if (hostname.startsWith("fe80:")) {
            throw new Error("AllKnower URL must not target link-local addresses");
        }
    }

    return url.origin;
}
