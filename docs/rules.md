# Rules

These rules are non-negotiable. The architecture and implementation must follow them exactly.

- **Never call GitHub from the frontend.**
- **Never expose tokens or secrets to the client.**
- **Always enforce Row-Level Security (RLS).**
- **Always validate resource ownership.**
- **Always validate GitHub installation access.**
- **Never trust a workspace ID alone for authorization.**
- **All execution must go through the runtime service.**
- **All AI actions must be validated before execution.**
