# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Sniff, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email **adam@integralayer.com** with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

You will receive a response within 48 hours. We will work with you to understand
and address the issue before any public disclosure.

## Scope

Sniff runs locally on your machine. Security concerns include:

- **Path traversal** in CLI arguments or config
- **Code injection** via malformed config files
- **Unsafe browser operations** in the exploration module
- **Dependency vulnerabilities** in the supply chain

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
