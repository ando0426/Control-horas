# Control de horas trabajadas

Página web sencilla para registrar las horas de trabajo y calcular el pago con el salario mínimo colombiano 2026.
Los datos se guardan en una hoja de Google (Google Sheets).

- Funciona en el celular. Se puede agregar a la pantalla de inicio como si fuera una app.
- Calcula horas diurnas, nocturnas (desde las 7:00 p.m.), domingos y festivos, y horas extra (más de 8 horas al día).
- Muestra el total por quincena o por mes.
- Tiene un PIN para que solo su mamá pueda ver y escribir los datos.

## Cómo funciona

```
Celular de mamá  ──►  Página en GitHub Pages  ──►  Apps Script  ──►  Hoja de Google
                       (index.html, app.js…)       (Codigo.gs)       (Registro)
```

La página es pública, pero los datos no: viven en la hoja de Google de usted y solo se leen o escriben con el PIN.

---

## Paso 1. Crear la hoja de Google

1. Entre a <https://sheets.google.com> con su cuenta de Google y cree una hoja en blanco.
2. Póngale un nombre, por ejemplo **Control de horas mamá**.

## Paso 2. Pegar el código de Apps Script

1. En la hoja, vaya a **Extensiones › Apps Script**.
2. Borre lo que aparece y pegue todo el contenido del archivo `apps-script/Codigo.gs`.
3. En la línea `const PIN_INICIAL = '1234';`, cambie `1234` por el PIN que usará su mamá.
4. Guarde (ícono de disquete).
5. Arriba, en la lista de funciones, elija **configurar** y presione **▶ Ejecutar**.
6. Google pedirá permisos: **Revisar permisos › su cuenta › Configuración avanzada › Ir a … (no seguro) › Permitir**.
   El aviso de "no seguro" aparece porque el código lo escribió usted y no Google. Es normal.
7. Vuelva a la hoja. Verá tres pestañas nuevas: **Registro**, **Configuracion** y **Festivos**.

## Paso 3. Publicar el Apps Script como aplicación web

1. En Apps Script, presione **Implementar › Nueva implementación**.
2. En el engranaje ⚙ elija **Aplicación web**.
3. Llene así:
   - **Ejecutar como:** Yo (su correo)
   - **Quién tiene acceso:** Cualquier usuario
4. Presione **Implementar** y copie la **URL de la aplicación web**. Termina en `/exec`.

> Si después cambia el código de `Codigo.gs`, use **Implementar › Gestionar implementaciones › ✏ Editar › Versión: Nueva versión**.
> Así la URL no cambia.

## Paso 4. Poner la URL en la página

Abra `config.js` y pegue la URL entre las comillas:

```js
window.APP_CONFIG = {
  URL_SCRIPT: 'https://script.google.com/macros/s/AKfy.../exec',
  TITULO: 'Mis horas de trabajo'
};
```

## Paso 5. Subir a GitHub y activar GitHub Pages

### Opción A: desde la página de GitHub (más fácil)

1. Entre a <https://github.com/new> y cree un repositorio, por ejemplo `control-horas`, de tipo **Public**.
2. Presione **uploading an existing file** y arrastre estos archivos:
   `index.html`, `styles.css`, `app.js`, `calculo.js`, `config.js`, `README.md` y la carpeta `apps-script`.
3. Presione **Commit changes**.
4. Vaya a **Settings › Pages**. En **Branch** elija `main` y `/ (root)`, y presione **Save**.
5. En 1 o 2 minutos la página quedará en `https://SU-USUARIO.github.io/control-horas/`.

### Opción B: desde el Símbolo del sistema (cmd)

Necesita tener instalado Git (<https://git-scm.com/download/win>). Abra **cmd** dentro de la carpeta `control-horas`:

```bat
git init
git add .
git commit -m "Página de control de horas"
git branch -M main
git remote add origin https://github.com/SU-USUARIO/control-horas.git
git push -u origin main
```

Después active GitHub Pages como en el punto 4 de la opción A.

## Paso 6. Instalar en el celular de su mamá

1. Abra el enlace `https://SU-USUARIO.github.io/control-horas/` en el celular.
2. Escriba el PIN. El teléfono lo recuerda.
3. Agréguelo a la pantalla de inicio:
   - **Android (Chrome):** menú ⋮ › **Agregar a pantalla principal**.
   - **iPhone (Safari):** botón Compartir › **Agregar a inicio**.

---

## Uso diario

1. Elegir la fecha, la hora de entrada, la hora de salida y el tiempo de almuerzo.
2. Revisar el valor que aparece abajo y presionar **Guardar**.
3. Para corregir o borrar un día, tocarlo en la lista **Días trabajados**.

Cada registro aparece también en la pestaña **Registro** de la hoja de Google, con las horas y el pago ya calculados.

## Cambiar valores (salario, recargos, festivos)

En la hoja de Google, pestaña **Configuracion**, cambie el número de la columna **Valor**. La página toma el cambio al actualizar con ⟳.

| Clave | Valor 2026 | Qué es |
|---|---|---|
| salario | 1.750.905 | Salario mínimo mensual |
| horasMes | 210 | Horas ordinarias al mes (42 h por semana) |
| jornadaDiaria | 8 | Lo que pase de aquí en un día es hora extra (9 si pactaron jornada flexible) |
| recargoNocturno | 35% | De 7:00 p.m. a 6:00 a.m. |
| recargoDominical | 90% | Domingos y festivos. **Cambiar a 100% el 1 de julio de 2027** |
| extraDiurna | 25% | Hora extra de día |
| extraNocturna | 75% | Hora extra de noche |

Para un año nuevo, agregue los festivos en la pestaña **Festivos** con el formato `AAAA-MM-DD`.

> Los días que ya están guardados conservan el valor con que se calcularon en la hoja. En la página se recalculan con los valores actuales.

## Cambiar el PIN

En Apps Script, cambie `PIN_INICIAL`, guarde y vuelva a ejecutar **configurar** (no borra datos).
En el celular, toque **Cerrar sesión en este teléfono** al final de la página y escriba el PIN nuevo.

## Modo de prueba

Si `URL_SCRIPT` está vacío en `config.js`, la página funciona en **modo de prueba**: guarda los datos solo en ese navegador.
Sirve para probarla antes de conectar Google.

## Qué no incluye el cálculo

- Auxilio de transporte ni prestaciones (prima, cesantías, vacaciones).
- Un turno que empieza un domingo y termina el lunes se cuenta todo como domingo.
- Las horas de más de 42 en la semana solo se avisan en rojo; no se recalculan como extra.

Base legal: salario mínimo 2026 (Decreto 1469 de 2025), jornada de 42 h (Ley 2101 de 2021),
recargo nocturno desde las 7 p.m. y recargo dominical del 90% (Ley 2466 de 2025), horas extra (art. 168 CST).
