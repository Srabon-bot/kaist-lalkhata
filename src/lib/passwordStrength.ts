export interface PasswordRequirements {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

export type PasswordStrengthLabel = "weak" | "fair" | "good" | "strong";

export interface PasswordStrength {
  /** 0 (empty) through 4 (strong). */
  score: number;
  label: PasswordStrengthLabel;
  requirements: PasswordRequirements;
  /** Minimum bar to allow signup: 8+ chars and at least 3 of the 4 character classes. */
  isAcceptable: boolean;
}

const LABELS: PasswordStrengthLabel[] = ["weak", "weak", "fair", "good", "strong"];

export function evaluatePassword(password: string): PasswordStrength {
  const requirements: PasswordRequirements = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };

  const classCount = [requirements.hasUpper, requirements.hasLower, requirements.hasNumber, requirements.hasSymbol]
    .filter(Boolean).length;

  let score = 0;
  if (password.length > 0) {
    if (!requirements.minLength || classCount <= 1) score = 1;
    else if (classCount === 2) score = 2;
    else if (classCount === 3) score = 3;
    else score = 4;
  }

  return {
    score,
    label: LABELS[score],
    requirements,
    isAcceptable: requirements.minLength && classCount >= 3,
  };
}
