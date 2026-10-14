export type PasswordStrength = "weak" | "good" | "secure";

export type PasswordEvaluation = {
  hasMinimumLength: boolean;
  hasUppercase: boolean;
  hasDigit: boolean;
  hasSpecialCharacter: boolean;
  hasRepeatedPattern: boolean;
  isValid: boolean;
  strength: PasswordStrength;
  score: number;
};

const repeatedPattern = /(.{1,3})\1{2,}/;

export function evaluatePassword(password: string): PasswordEvaluation {
  const hasMinimumLength = password.length >= 10;
  const hasUppercase = /[A-ZÀ-ÖØ-Þ]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-zÀ-ÖØ-öø-ÿ0-9\s]/.test(password);
  const hasRepeatedPattern = repeatedPattern.test(password);
  const score = [hasMinimumLength, hasUppercase, hasDigit, hasSpecialCharacter, !hasRepeatedPattern].filter(Boolean).length;
  const isValid = score === 5;
  const strength: PasswordStrength = isValid && password.length >= 14 ? "secure" : isValid ? "good" : "weak";
  return { hasMinimumLength, hasUppercase, hasDigit, hasSpecialCharacter, hasRepeatedPattern, isValid, strength, score };
}

export function isPasswordValid(password: string) {
  return evaluatePassword(password).isValid;
}
