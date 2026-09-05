export function passwordError(password: string, email = ''): string | null {
  if (password.length < 12 || password.length > 128) return 'Usá entre 12 y 128 caracteres.';
  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^a-zA-Z0-9\s]/.test(password)
  )
    return 'Incluí mayúscula, minúscula, número y símbolo.';
  const local = email.split('@')[0].toLowerCase();
  if (local && password.toLowerCase().includes(local))
    return 'La contraseña no debe contener el nombre de tu correo.';
  return null;
}
