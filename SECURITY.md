# Security policy

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting instead:

1. Open https://github.com/alihdrndm/roomlist-kit.
2. Go to the **Security** tab.
3. Choose **Report a vulnerability** and describe the problem and how to reproduce it.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## What data the project handles

A rooming list can contain guest names, email addresses, phone numbers, stay dates, and sometimes passport numbers and dates of birth. Treat every uploaded file as personal data.

How the project handles it:

- **In memory only.** Each request is processed in memory and the result is returned. Uploads are never written to disk, and there is no database.
- **Never logged.** Logs hold only the request id, method, path (without the query string), status, and user agent. Request and response bodies and file contents are never logged. An API test checks that a guest name does not appear in the logs.
- **API key.** The API compares the `x-api-key` header with the configured key using SHA-256 hashes and `crypto.timingSafeEqual`. The web app keeps the key on its server side; it is never sent to the browser.
- **Upload limits.** 5 MB per file and 5000 rows, and the XLSX and CSV readers are bounded so a crafted file cannot use unlimited memory.
- **Rate limit.** 120 requests per minute per IP address.

All sample data in this repository is synthetic.
