// Reading a 5 MB upload is synchronous work. Giving the event loop a turn every
// so often lets a server keep answering other requests (and health checks) while
// one large file is read. setTimeout exists in browsers and Node alike.

/** How much input (characters or bytes) to process between turns: about 10–50 ms of work. */
export const YIELD_EVERY = 256 * 1024;

export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
