# API errors

Every non-2xx response from the API is `application/problem+json` ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)):

```json
{
  "type": "https://github.com/alihdrndm/roomlist-kit/blob/main/docs/ERRORS.md#VALIDATION_FAILED",
  "title": "Validation failed",
  "status": 422,
  "detail": "The request has 1 invalid field.",
  "code": "VALIDATION_FAILED",
  "instance": "01a111a0-1d42-7339-8667-ab81169207a1",
  "errors": [{ "path": "block.startDate", "code": "invalid_format", "message": "Invalid ISO date" }]
}
```

- `code` is the stable machine-readable name; this page has one section per code.
- `instance` is the request id. It is also returned in the `x-request-id` header and written to every log line, so quote it when you report a problem.
- Responses never contain stack traces or internal messages.

| Code | HTTP status |
|------|-------------|
| [`VALIDATION_FAILED`](#VALIDATION_FAILED) | 422 |
| [`FILE_REQUIRED`](#FILE_REQUIRED) | 400 |
| [`FILE_TOO_LARGE`](#FILE_TOO_LARGE) | 413 |
| [`LIST_INVALID`](#LIST_INVALID) | 422 |
| [`EXPORT_PRECONDITION_FAILED`](#EXPORT_PRECONDITION_FAILED) | 422 |
| [`UNAUTHORIZED`](#UNAUTHORIZED) | 401 |
| [`NOT_FOUND`](#NOT_FOUND) | 404 |
| [`RATE_LIMITED`](#RATE_LIMITED) | 429 |
| [`INTERNAL`](#INTERNAL) | 500 |

<a id="VALIDATION_FAILED"></a>
## VALIDATION_FAILED (422)

The request itself is wrong: an unknown multipart part, a JSON part that is not valid JSON, a value outside its allowed range, an unknown `target`, or invalid `targetOptions`. The body has an `errors` list with one entry per problem: `path` (the part name, then the field inside it, for example `block.shoulderDays` or `targetOptions.dateFormat`), `code` (the validation rule that failed), and `message`.

Also used for other malformed requests the framework rejects, for example a JSON part sent as a file upload (`curl -F 'block=@file.json'` instead of `-F 'block=<file.json'`). **Fix:** correct the field named in `errors[].path`.

<a id="FILE_REQUIRED"></a>
## FILE_REQUIRED (400)

A required file part is missing: `file` for `validate` and `convert`, `before` and `after` for `diff`. Send the request as `multipart/form-data`. **Fix:** attach the file(s).

<a id="FILE_TOO_LARGE"></a>
## FILE_TOO_LARGE (413)

The uploaded file is larger than `MAX_UPLOAD_BYTES` (default 5,242,880 bytes, 5 MB). **Fix:** split the rooming list into smaller files.

<a id="LIST_INVALID"></a>
## LIST_INVALID (422)

Returned by `convert` and `diff` when a rooming list has at least one error-severity issue. The body has an extra member `issues`: every issue found (errors and warnings), each with `severity`, `ruleId`, `code`, `message` and, where known, `row`, `line`, `field` and `value`. For `diff`, each issue also has `side`: `"before"` or `"after"`.

`validate` never returns this: its 200 response is the report, with `ok: false` when there are errors. **Fix:** correct the errors listed in `issues` and send the file again.

<a id="EXPORT_PRECONDITION_FAILED"></a>
## EXPORT_PRECONDITION_FAILED (422)

The list is valid, but the chosen target needs something it does not have (for example Maestro needs `block.groupReservationNumber` and a first name and room type on every guest). The body has an extra member `issues` with rule `X001` (`EXPORT_FIELD_REQUIRED`) entries naming each missing field. **Fix:** add the missing data or choose another target.

<a id="UNAUTHORIZED"></a>
## UNAUTHORIZED (401)

The `x-api-key` header is missing or wrong on a `/v1` endpoint. The same message is returned in both cases. `/healthz`, `/readyz`, `/docs` and `/docs-json` never need the key. **Fix:** send the correct key.

<a id="NOT_FOUND"></a>
## NOT_FOUND (404)

No route matches the method and path. **Fix:** check the URL against `/docs`.

<a id="RATE_LIMITED"></a>
## RATE_LIMITED (429)

More than 120 requests per minute from the same IP address. The `x-ratelimit-*` and `retry-after` headers say when to retry. **Fix:** slow down.

<a id="INTERNAL"></a>
## INTERNAL (500)

An unexpected error on the server. The response carries no details on purpose. The server log records the error class and where it happened under the same request id (`instance`), but not the error message, because a library message can contain guest data. **Fix:** retry once; if it persists, report the `instance` value.

## Web app only

The web app (`apps/web`) forwards `/api/*` to the API and passes its problem+json answers through unchanged. It adds one code of its own, and answers two checks itself, before the upload reaches the API:

- An upload with no `Content-Length` gets `VALIDATION_FAILED` (422), with one `errors` entry whose `path` is `content-length`. An upload whose `Content-Length` is over 6 MB (11 MB for compare, which carries two files) gets `FILE_TOO_LARGE` (413) without being read.

| Code | HTTP status |
|------|-------------|
| [`API_UNAVAILABLE`](#API_UNAVAILABLE) | 502 |

<a id="API_UNAVAILABLE"></a>
## API_UNAVAILABLE (502)

The web app could not reach the API (it is down, restarting, or `API_BASE_URL` is wrong). **Fix:** retry in a moment; if it persists, check that the API is running and that `API_BASE_URL` points at it.
