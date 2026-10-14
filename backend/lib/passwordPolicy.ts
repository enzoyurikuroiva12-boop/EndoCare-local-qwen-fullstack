export function isStrongPassword(password: string) {
  const hasMinimumLength = password.length >= 10 && password.length <= 128;
  const hasUppercase = /[A-ZÀ-ÖØ-Þ]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-zÀ-ÖØ-öø-ÿ0-9\s]/.test(password);
  const hasRepeatedPattern = /(.{1,3})\1{2,}/.test(password);
  return hasMinimumLength && hasUppercase && hasDigit && hasSpecialCharacter && !hasRepeatedPattern;
}
