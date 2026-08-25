export type AuthMode = "quickLogin" | "employeeIdLogin" | "pinLogin" | "passwordLogin";

// Keep the chooser ready for PIN/password screens without requiring them today.
export const AUTH_MODE: AuthMode = "quickLogin";