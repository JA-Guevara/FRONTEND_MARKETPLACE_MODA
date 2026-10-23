import { validatePlanDraft, featureMatrix, Plan } from './plan.models';
describe('Reglas de planes', () => {
  it('rechaza código minúscula', () =>
    expect(validatePlanDraft({ code: 'basico' })['code']).toBeTruthy());
  it('duración debe ser positiva', () =>
    expect(validatePlanDraft({ duration_days: 0 })['duration_days']).toBeTruthy());
  it('límite obligatorio entero positivo', () => {
    expect(
      validatePlanDraft({ limits: { max_active_branches: 0 } })['max_active_branches'],
    ).toBeTruthy();
    expect(
      validatePlanDraft({ limits: { max_active_branches: 1.5 } })['max_active_branches'],
    ).toBeTruthy();
  });
  it('matriz una fila por catálogo', () => {
    const p = {
      id: 'p',
      code: 'BASICO',
      name: 'Básico',
      reference_price: 20,
      duration_days: 30,
      is_active: true,
      tenants_count: 1,
      features: { sales: true },
      limits: { max_active_branches: 2 },
    } as Plan;
    expect(
      featureMatrix(
        [p, p],
        [
          { code: 'sales', label: 'Ventas', kind: 'feature' },
          { code: 'max_active_branches', label: 'Sucursales', kind: 'limit' },
        ],
      ),
    ).toEqual([
      { code: 'sales', label: 'Ventas', values: [true, true] },
      { code: 'max_active_branches', label: 'Sucursales', values: [2, 2] },
    ]);
  });
});
