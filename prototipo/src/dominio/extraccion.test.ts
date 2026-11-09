import { describe, expect, it } from 'vitest';
import { extraerDeCronica, extraerFecha, extraerLugar, extraerTipo, extraerVictimas } from './extraccion';

const SABATTINI =
  'Un motociclista de 24 años murió en la madrugada del sábado tras chocar contra un automóvil en avenida Amadeo Sabattini al 4700, en barrio Empalme. Según fuentes policiales, el joven circulaba hacia el este cuando el vehículo giró a la izquierda. Fue trasladado al hospital, donde falleció horas más tarde. El conductor del automóvil resultó ileso.';

describe('RF02 · extraerDeCronica', () => {
  it('reproduce la Figura 15: Sabattini al 4700, 12/09/2026, un motociclista, choque en giro', () => {
    const e = extraerDeCronica(SABATTINI, '2026-09-14');
    expect(e.lugar).toMatchObject({ calle: 'Av. Amadeo Sabattini', altura: 4700, barrio: 'Empalme' });
    expect(e.lugar?.texto).toBe('avenida Amadeo Sabattini al 4700');
    expect(e.fechaHecho).toBe('2026-09-12');
    expect(e.fallecidos).toBe(1);
    expect(e.victimas).toEqual([{ tipoUsuario: 'motociclista', gravedad: 'fallecido' }]);
    expect(e.tipo).toBe('choque en giro');
  });

  it('marca la posición del fragmento del lugar para resaltarlo', () => {
    const e = extraerDeCronica(SABATTINI, '2026-09-14');
    expect(SABATTINI.slice(e.lugar!.inicio, e.lugar!.fin)).toBe(e.lugar!.texto);
  });
});

describe('RF02 · lugar', () => {
  it('ruta nacional con progresiva: "ruta nacional 9, a la altura del kilómetro 694"', () => {
    expect(extraerLugar('Ocurrió sobre la ruta nacional 9, a la altura del kilómetro 694, cerca de Jesús María.')).toMatchObject({
      ruta: 'RN 9',
      km: 694,
      localidad: 'Jesús María',
    });
  });

  it('progresiva con decimales y antes de la ruta', () => {
    expect(extraerLugar('En el kilómetro 312,4 de la ruta 19 chocaron dos autos.')).toMatchObject({ ruta: 'RN 19', km: 312.4 });
  });

  it('ruta provincial abreviada', () => {
    expect(extraerLugar('Sobre la RP 5, km 30, volcó una camioneta.')).toMatchObject({ ruta: 'RP 5', km: 30 });
  });

  it('cuadra con avenida: "Av. Colón al 5300"', () => {
    expect(extraerLugar('El hecho ocurrió en Av. Colón al 5300 durante la noche.')).toMatchObject({ calle: 'Av. Colón', altura: 5300 });
  });

  it('cuadra sin prefijo de vía: "Agustín Piaggio al 1000"', () => {
    expect(extraerLugar('Vecinos de Agustín Piaggio al 1000 reclaman por un pozo.')).toMatchObject({ calle: 'Agustín Piaggio', altura: 1000 });
  });

  it('nombres con inicial y apóstrofo', () => {
    expect(extraerLugar('en avenida Juan B. Justo al 4000')).toMatchObject({ calle: 'Av. Juan B. Justo', altura: 4000 });
    expect(extraerLugar("en avenida O'Higgins al 5000")).toMatchObject({ calle: "Av. O'Higgins", altura: 5000 });
  });

  it('intersección: "en la intersección de X y Y"', () => {
    expect(extraerLugar('Un ciclista murió en la intersección de avenida Colón y avenida Sagrada Familia, en barrio Urca.')).toMatchObject({
      calle: 'Av. Colón',
      calle2: 'Av. Sagrada Familia',
    });
  });

  it('corredor: avenida sin altura con referencia de barrio (Figura 16)', () => {
    const l = extraerLugar(
      'Un peatón murió atropellado anoche en avenida Circunvalación a la altura de barrio Los Boulevares, cuando intentaba cruzar la calzada.',
    );
    expect(l).toMatchObject({ calle: 'Av. Circunvalación', barrio: 'Los Boulevares' });
    expect(l?.altura).toBeUndefined();
  });

  it('barrio sin calle', () => {
    expect(extraerLugar('Un ciclista murió en barrio Villa El Libertador tras ser embestido.')).toMatchObject({ barrio: 'Villa El Libertador' });
  });

  it('sin lugar reconocible devuelve null (CU01 3.a)', () => {
    expect(extraerLugar('Un hombre murió en un accidente de tránsito, informaron fuentes policiales.')).toBeNull();
  });
});

describe('RF02 · fecha del hecho', () => {
  it('relativa a la publicación', () => {
    expect(extraerFecha('murió anoche', '2026-09-03')).toBe('2026-09-02');
    expect(extraerFecha('ayer por la tarde', '2026-09-03')).toBe('2026-09-02');
    expect(extraerFecha('anteayer', '2026-09-03')).toBe('2026-09-01');
    expect(extraerFecha('esta mañana', '2026-09-03')).toBe('2026-09-03');
  });

  it('por día de la semana: el último anterior o igual a la publicación', () => {
    // 2026-09-14 es lunes; el sábado anterior es el 12.
    expect(extraerFecha('en la madrugada del sábado', '2026-09-14')).toBe('2026-09-12');
    expect(extraerFecha('el pasado viernes', '2026-09-14')).toBe('2026-09-11');
  });

  it('explícita, con y sin año', () => {
    expect(extraerFecha('ocurrió el 2 de agosto', '2026-08-04')).toBe('2026-08-02');
    expect(extraerFecha('ocurrió el 28 de diciembre', '2026-01-03')).toBe('2025-12-28');
    expect(extraerFecha('el 03/05/2024 a la noche', '2024-05-06')).toBe('2024-05-03');
  });
});

describe('RF02 · víctimas y tipo de usuario', () => {
  it('dos motociclistas', () => {
    const { victimas } = extraerVictimas('Dos motociclistas murieron tras despistarse en la ruta.');
    expect(victimas).toHaveLength(2);
    expect(victimas.every((v) => v.tipoUsuario === 'motociclista' && v.gravedad === 'fallecido')).toBe(true);
  });

  it('conductor y acompañante en la misma oración', () => {
    const { victimas } = extraerVictimas('En el choque frontal murieron el conductor y su acompañante.');
    expect(victimas.map((v) => v.tipoUsuario)).toEqual(['conductor', 'acompanante']);
  });

  it('separa fallecidos, heridos graves e ilesos', () => {
    const { victimas } = extraerVictimas(
      'Un peatón murió atropellado. Un ciclista resultó herido de gravedad. El conductor del colectivo resultó ileso.',
    );
    expect(victimas).toEqual([
      { tipoUsuario: 'peaton', gravedad: 'fallecido' },
      { tipoUsuario: 'ciclista', gravedad: 'herido-grave' },
    ]);
  });

  it('automovilista se registra como conductor y pasajero como acompañante', () => {
    const { victimas } = extraerVictimas('Murieron un automovilista y una pasajera.');
    expect(victimas.map((v) => v.tipoUsuario)).toEqual(['conductor', 'acompanante']);
  });

  it('una muerte sin tipo de usuario se cuenta aparte', () => {
    const e = extraerDeCronica('Un hombre murió en la ruta nacional 9, km 650.', '2026-01-02');
    expect(e.victimas).toHaveLength(0);
    expect(e.fallecidos).toBe(1);
    expect(e.fallecidosSinTipo).toBe(1);
  });
});

describe('RF02 · tipo de siniestro', () => {
  it.each([
    ['Un peatón murió atropellado por un colectivo.', 'atropello de peatón'],
    ['Dos autos chocaron de frente en la ruta.', 'choque frontal'],
    ['El motociclista se despistó y terminó en la banquina.', 'salida de calzada'],
    ['El auto giró a la izquierda y lo embistió.', 'choque en giro'],
    ['Lo chocaron desde atrás mientras esperaba el semáforo.', 'choque por alcance'],
    ['El motociclista cayó sobre el pavimento.', 'caída de motociclista'],
    ['Dos autos colisionaron en la esquina.', 'choque lateral'],
  ])('%s → %s', (texto, tipo) => {
    expect(extraerTipo(texto)).toBe(tipo);
  });
});
