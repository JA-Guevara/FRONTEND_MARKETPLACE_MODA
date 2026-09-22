import { passwordError } from './password';
describe('Política de contraseña', () => {
  it.each([
    'Corta!1',
    'solominusculas123!',
    'SOLOMAYUSCULAS123!',
    'SinNumerosLargos!',
    'SinSimbolos2026',
  ])('rechaza %s', (password) => expect(passwordError(password)).not.toBeNull());
  it('rechaza el nombre del correo', () =>
    expect(passwordError('AnaClaveSegura!2026', 'ana@example.com')).not.toBeNull());
  it('acepta una contraseña que cumple los requisitos', () =>
    expect(passwordError('RopaSegura!2026', 'cliente@example.com')).toBeNull());
});
