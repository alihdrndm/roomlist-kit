import { type Problem, readProblem } from "./problem";

// One way for the pages to call the web app's own /api/* route handlers, so every
// failure (an API problem, a proxy page, no connection) becomes a Problem.

export type Outcome<T> =
  | { ok: true; value: T; response: Response }
  | { ok: false; problem: Problem };

export const NO_CONNECTION: Problem = {
  status: 0,
  code: "NETWORK",
  title: "No connection",
  detail:
    "The request did not reach the server. Check your connection and try again.",
};

/** POSTs a form and reads the body with `read` when the answer is 2xx. */
export async function postForm<T>(
  path: string,
  form: FormData,
  read: (response: Response) => Promise<T>,
): Promise<Outcome<T>> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", body: form });
  } catch {
    return { ok: false, problem: NO_CONNECTION };
  }
  if (!response.ok) return { ok: false, problem: await readProblem(response) };
  try {
    return { ok: true, value: await read(response), response };
  } catch {
    return { ok: false, problem: NO_CONNECTION };
  }
}

/** GETs JSON from a route handler. */
export async function getJson<T>(path: string): Promise<Outcome<T>> {
  let response: Response;
  try {
    response = await fetch(path);
  } catch {
    return { ok: false, problem: NO_CONNECTION };
  }
  if (!response.ok) return { ok: false, problem: await readProblem(response) };
  return { ok: true, value: (await response.json()) as T, response };
}
