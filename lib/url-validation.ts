const PRIVATE_RANGES = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
];

/**
 * Validate an AllKnower service URL and return its origin.
 *
 * @param rawUrl - The input URL string to validate.
 * @returns The origin (scheme, hostname, and optional port) of the validated URL.
 * @throws Error("AllKnower URL must use HTTPS in production") if running in production and the protocol is not `https:`.
 * @throws Error("AllKnower URL must use HTTP or HTTPS") if not running in production and the protocol is neither `http:` nor `https:`.
 * @throws Error("AllKnower URL must not target private network ranges") if the hostname matches a private/reserved IP range.
 * @throws Error("AllKnower URL must not target link-local addresses") if the hostname is an IPv6 loopback or link-local address.
 */
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
