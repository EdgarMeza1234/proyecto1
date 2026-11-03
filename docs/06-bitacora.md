# Bitacora del proyecto

Registro cronologico de decisiones y work. Cada entrada dice que se hizo y por que.

## 2026-10-30 - Reorganizacion de carpetas

**Problema:** el codigo vivia en `E:\proyecto1` y su documentacion en `E:\VPN\setup-servidor`.
`E:\VPN` ademas mezclaba documentacion de redes con una aplicacion completa e independiente.

**Que se hizo:**

| Antes | Ahora |
|---|---|
| `E:\proyecto1` | `E:\Proyectos\proyecto1-reparacion-att` (repo git intacto) |
| `E:\VPN\setup-servidor\scripts` | `docs\03-despliegue-servidor\scripts` |
| `E:\VPN\setup-servidor\docker` (excepto copia de proyecto1) | `docs\03-despliegue-servidor\docker` |
| `E:\VPN\setup-servidor\docs\*.docx` + `generar-documentacion.py` | `docs\03-despliegue-servidor` |
| `E:\proyecto1\*.pdf` (9 papeletas sueltas) | `docs\04-datos-papeletas` |
| `E:\VPN\sm\tt-cotap` | `E:\Proyectos\tt-cotap` (proyecto aparte) |
| `E:\VPN\VPNDocument.*`, `OmniLeads-CallCenter-Integracion.md` | `E:\Documentacion\VPN-redes` |
| `E:\VPN\setup-servidor\docker\proyecto1\*` | `E:\_Legacy\VPN-setup-servidor-duplicado-20261030` |

**Regla que queda:** un proyecto = una carpeta con su codigo, sus datos y su documentacion.
Un documento describe como se construye o despliega ese codigo, vive en `docs\` de ese proyecto.
Si describe la red o el servicio en general, vive en `E:\Documentacion`.

**Decidido:** documentacion dentro del repo, en `docs\`, versionada junto al codigo.

## 2026-10-30 - Bug: el modulo Reclamos dejaba de mostrar lo registrado

**Sintoma:** tras `c0fe559` (rango de 5 dias + export Excel) dejaron de aparecer los reclamos
nuevos y el export tampoco los incluia.

**Diagnostico inicial (erroneo):** se supuso que `FechaRegistro` quedaba NULL porque el INSERT
no la escribia. Descartado con datos de produccion: la columna tiene `(sysdatetime())` de default,
0 de 50 filas en NULL y los 3 reclamos del dia (RC-2026-0048/49/50) tienen fecha valida.
La migracion 003 que se habia preparado no se ejecuto y se elimino.

**Causa real:** el `<input type="date">` escribe valores parciales (`desde=112026-01-30`,
`0001-01-30`, visibles como `400` en los logs del backend). `validateRange()` solo comparaba
orden, y `'112026-01-30' < '2026-10-30'` pasa, asi que la basura llegaba al store. Como el
polling de 30 s y los refetch por socket usan `fetchReclamos().catch(() => {})`, cada intento
fallaba en silencio con el mismo 400 y **la lista quedaba congelada**: nada de lo que se
registraba volvia a aparecer hasta corregir la fecha a mano. Guardar si guardaba.

**Arreglo:**
- `views/ReclamosView.vue`: los inputs se enlazan a `desdeInput`/`hastaInput` locales y al store
  solo se copia un rango que cumpla `^\d{4}-\d{2}-\d{2}$` y `desde <= hasta`.
- `stores/reclamos.js`: `activeRange` ignora valores mal formados y cae al ventana de 5 dias,
  asi el polling se autocicatriza en vez de congelarse. Lo usan `fetchReclamos` y `exportReclamos`.

**Segundo defecto encontrado:** el contenedor del backend no tenia `TZ`, correra en UTC,
mientras la BD guarda hora boliviana y `pool.js` usa `useUTC: false`. El cliente recibia el
instante 4 h atras, asi que un reclamo de 20 h se mostraba con pulso rojo de >24 h.

**Regresion causada al intentar arreglarlo (`b11a20b` -> revertido en `9a09852`):** se agrego
`TZ=America/La_Paz` al compose y eso rompio el filtro de fechas. `@Desde`/`@Hasta` se bindeaban
como `sql.Date` a partir de una cadena `YYYY-MM-DD`: JS la parsea como medianoche UTC, tedious la
lee en la zona local del contenedor y en Bolivia (-04:00) eso resulta en el dia anterior. El rango
se corrio un dia entero y los reclamos del dia en curso dejaron de aparecer (19 filas pasaron a 16,
primera RC-2026-0050 -> RC-2026-0047). Mismo patron fragil existe en el bind `sql.Date` de
`nortel.service.js` (`insertarEnBD`) y de `trafico.service.js`, que ademas escriben datos.

**Estado final:** `TZ` revertido. El rango ahora viaja como `VarChar(10)` y SQL lo convierte con
`CAST(... AS date)`, identico en cualquier zona horaria. Verificado en produccion tras el redeploy:
ventana de 5 dias = 19 filas con RC-2026-0050 primero y las 3 del dia incluidas; ventana de hoy =
3 filas.

## 2026-10-30 - Baja de RC-2026-0048 y RC-2026-0049

Los tres reclamos del dia del DN 23832 no eran repetidos (descripciones y tipos de falla
distintos), pero se pidio eliminar 0048 y 0049 conservando 0050.

El modulo no tiene ruta `DELETE`, asi que se hizo por SQL directo con respaldo previo en las
tablas `ReclamosTelefonia_baja_20261030` y `ReclamoSeguimiento_baja_20261030`, conservando la
identidad (`SET IDENTITY_INSERT`, que solo funciona como sentencia estatica: dentro de `EXEC()`
se pierde al terminar el batch). Todo en una transaccion con comprobaciones antes del commit:
2 eventos + 2 reclamos respaldados, 0 restantes de los objetivo y RC-2026-0050 intacto.

Resultado: total de la tabla 50 -> 48. Ventana de hoy = 1 fila (RC-2026-0050), ultimos 5 dias = 17.
Para recuperar: `INSERT INTO ReclamosTelefonia SELECT ... FROM ReclamosTelefonia_baja_20261030`
con IDENTITY_INSERT encendido.

## 2026-10-30 - Modulo Nortel: consolidar, separar y descargar

Reportado como "el boton de listar archivos no funciona, y Consolidar/Separar todo no dejan ver el
resultado". Los endpoints respondian 200: lo que no existia era el feedback. Al inspeccionar la carpeta
`/app/trafico-data/NORTEL/OCT2026` del servidor aparecio el problema de fondo.

**Bug real (datos corruptos, no UI):** el crudo Nortel es un log de consola donde cada registro ocupa dos
lineas (la segunda empieza con el destino rellenado con `F`) y entre registros hay lineas en blanco y
`>>>BLOCK NO: n`. `consolidar` unia la linea AA con la siguiente **sin comprobar nada**, asi que cuando un
registro venia sin continuation el registro vecino quedaba pegado en la misma linea. El `.emc` de octubre
salio con 41818 registros en 41820 lineas y el `OCT20261AMA.EMC` generado a partir de el pesaba 8.7 MB
(83635 registros, 41817 lineas con dos registros): insertar eso en la BD desalineaba todas las columnas.

**Segundo bug:** `listAllFiles` devolvia TODO lo de la carpeta, incluidos los `.emc` recien generados, y la
tabla "Archivos crudos" les pintaba su boton "Consolidar". Presionarlo sobre un `.emc` volvia a entrar por
`consolidar`, que leia ese `.emc` y escribia sobre si mismo (`baseName + '.emc'`) pegando pares de registros.
Eso explica que el AMA de octubre duplicara su tamano.

**Tercero:** la seccion "1. Archivos crudos" estaba condicionada a `v-if="archivos.length"`, con lo que al
listar una carpeta vacia o inexistente el boton no hacia visible nada (de ahi el "medio que no funciona").
Y `conversionResult` se asignaba pero nunca se renderizaba, asi que la consolidacion no mostraba resultado.

**Separar todo** funcionaba con el marcador correcto (`FFFFFFFFFFF2001`, 11 `F` + numero en el campo de
destino de 15 posiciones; verificado contra `E:\AMAS\NORTEL\JUN2026`, donde separo 2843 registros). Fallaba
por otras dos cosas: si el mes aun no estaba consolidado devolvia un 500 con "No hay archivos .emc" sin
decir que hacer, y contaba la linea final de total como si fuera un registro. El archivo de octubre
realmente no tiene trafico 2001 (`2001.EMC` de 2 bytes = vacio).

**Arreglo (`772928c`):** cada archivo se clasifica en `crudo` / `consolidado` / `ama` / `dosmil` / `error`;
`consolidar` rechaza lo que no sea crudo y solo empareja cuando la linea siguiente no inicia registro;
`split` exige `.emc` y avisa cuando falta consolidar; el total del `.emc` ya no cuenta como registro. Nuevos
`GET /api/nortel/generados` y `GET /api/nortel/descargar` (nombre validado con `path.basename`, rechaza
rutas relatives) replicando el patron de Trafico, y en la vista hay estado vacio al listar, mensaje de
consolidacion visible y panel de generados con boton Descargar por archivo.

**Verificado con el codigo desplegado** sobre una copia del crudo en `/tmp/nortel-test` (la carpeta real no
se toco): 41818 registros, `.emc` y `AMA.EMC` con 0 lineas duplicadas, AMA de 4 394 912 bytes (antes
8 706 106), categorias correctas, y rechazados `../../etc/passwd`, `../SEP2026/SEP2026.txt` y consolidar un
`.emc`. Contra la referencia hecha a mano en junio: 45749 registros, 0 diferencias de linea contra linea.

## 2026-10-31 - Nortel: dos registros de llamada en una sola linea del .EMC

Segundo reporte del modulo: "al hacer el parseo para formar el .EMC se estan juntando dos registros,
cada registro inicia con AA y en el consolidado estan dos juntos". Medido en el servidor, el
`OCT20261.emc` de la carpeta estaba limpio (41 818 lineas, 0 con dos registros); lo que se reviso era
el `OCT20261AMA.EMC` de las 22:53, generado antes del arreglo (83 635 registros en 41 819 lineas). El
log de nginx confirma que ese archivo, no el `.emc`, se descargo a las 23:32.

Aun asi el parser dejo de depender de que el crudo venga bien partido (`5464310`): `extraerRegistros`
corta en cada `AA` seguido de digito, el detonante de registro paso de `includes('AA')` a
`startsWith('AA')` (una continuacion con el registro pegado tambien lleva `AA` y contarla como registro
la duplicaria), `Separar` aplica el mismo corte -asi que un `.emc` ya duplicado se recupera al
separarlo- y `Consolidar` devuelve cuantas lineas venian pegadas para mostrarlo en el aviso.

**Verificacion (13 chequeos, codigo real del servicio):** contra `E:\AMAS\NORTEL\JUN2026` el `.emc`
sale identico linea por linea (45 749 registros, 229 omitidos) y el split coincide (42 906 AMA + 2 843
de 2001; la referencia de AMA trae ademas la linea de total, que aca se omite porque `insertarEnBD` ya
la descarta). Sobre un crudo sintetico con dos registros pegados, un registro sin continuacion,
separadores y basura de cabecera: 6 registros, 0 lineas duplicadas y el registro hueso no se come al
vecino. Sobre un `.emc` duplicado a mano: las 12 registros pegados se recuperan por separado.

**Regenerado en produccion:** `OCT20261.emc` 41 818 registros (0 pegados, 59 627 de otros meses
omitidos), `OCT20261AMA.EMC` 4 394 912 bytes antes 8 706 106, `OCT202612001.EMC` vacio (octubre no
tiene trafico al 2001). Los artefactos anteriores a la regeneracion quedaron respaldados en
`NORTEL/_backup_20261031/`.

**Datos del crudo, por si vuelve el bicho:** de 101 445 registros, 45 096 son de septiembre, 13 096 de
agosto y 41 818 de octubre; 1 435 traen el digito de anio en `0` (fechas `00904`/`00905` en tipos
`00500`/`40500`) y 2 registros `AA09000` traen 7 digitos en esa posicion. Todos se descartan por mes,
no por el parser. En este crudo no hubo ninguna linea con dos registros pegados.

**`CDROCT2026N` no existe**, o sea que el AMA corrupto nunca llego a la BD: no hay filas que limpiar.
Cargar el mes desde el modulo usa ya el AMA regenerado.

## 2026-11-03 - Reclamos: la busqueda manda sobre el rango

Reportado: "las fechas estan bien para definir que se muestra y que se exporta, pero cuando busco
por telefono, nombre o reclamo deberia aparecer el registro encontrado, no importa la fecha".

**Por que no aparecia:** el buscador de `ReclamosView` filtraba en el navegador sobre `store.reclamos`,
que es solo la ventana cargada (5 dias por defecto), y `GET /api/reclamos` ni siquiera leia `q`: el
unico lugar donde el termino llegaba al backend era la exportacion, y ahi el rango se le aplicaba
encima. Un reclamo del 29/10 era invisible desde el 31/10 en adelante.

**Arreglo (`66e380c`):** `listReclamos` arma el `WHERE` segun el caso y omite las dos condiciones de
fecha cuando hay termino (los binds `@Desde`/`@Hasta` ni se declaran); `rangoDeBusqueda` en el
controlador decide si aplicar o saltear `getDateRange`, de modo que una fecha mal escrita no devuelva
400 a quien esta buscando. El frontend pide la busqueda al servidor con debounce de 350 ms, avisa en
pantalla que el rango no se aplica y titula el panel "N encontrados"; **Buscar** y **Ultimos 5 dias**
vacan el buscador para volver al rango. Exportar comparte el criterio y el archivo sale como
`reclamos_busqueda_<termino>.xlsx` (termino saneado a `A-Za-z0-9._-`). La busqueda activa necesita 2
caracteres o mas, para que una letra suelta no devuelva la tabla entera.

**Medido contra la BD de produccion** con este codigo: ventana `2026-10-30..2026-11-03` = 3 reclamos;
buscar `RC-2026` sin fechas = 50, de los cuales 47 quedan fuera de la ventana; `RC-2026-0047` (del 29/10)
aparece buscando por codigo, por su DN y por las 4 primeras letras del nombre. Sin `q` el rango sigue
recortando y una fecha invalida sigue rechazandose como antes.

**No verificado:** el click-through en el navegador. La pantalla de login rechazo las credenciales que
estan en el historial del repo ("Usuario o contrasena incorrectos"), asi que quedo probado a nivel de
servicio/controlador y en que el bundle desplegado lleva la vista nueva, pero falta que un usuario con
sesion busque un reclamo viejo y lo vea aparecer.

## Pendientes abiertos

- Pendiente el desfase de 4 h en las horas mostradas (el backend en UTC y la BD en hora boliviana).
  No se corrijo con `TZ` por la regresion descripta arriba. Para aplicarlo hace falta primero
  pasar los binds de fecha de `nortel.service.js` y `trafico.service.js` a texto + `CAST`,
  y verificar importaciones en un entorno aparte.
- Desplegado: `b11a20b` (validacion de fechas en el cliente + `activeRange`), `9a09852` (revert de `TZ`
  + rango independiente de la zona), `772928c` (Nortel: categorias, emparejamiento y descarga) y
  `5464310` (Nortel: cortar los registros pegados). Contenedores reconstruidos, sin errores en logs.
- El push desde la estacion de trabajo exige `git -c http.sslBackend=schannel push`, porque Avast
  intercepta TLS y el paquete de CA de Git no confia en su certificado raiz.
- Verificado en produccion: el SQL Server esta en hora de Bolivia (offset 240 min contra UTC),
  asi que el rango `America/La_Paz` calculado en el backend coincide con `sysdatetime()`.

- El compose de monitoring y el script de instalacion de `docs\03-despliegue-servidor` fijan la clave de
  admin de Grafana y las de los usuarios Linux dentro del archivo. Pendiente pasarlas a `.env` y rotarlas;
  mientras tanto esa carpeta esta excluida de git, junto con los `.docx` exportados por
  `generar-documentacion.py`.
- **Rotar la clave de administrador de la app.** El login llevaba el usuario y la clave de administrador como
  `placeholder`, o sea que la pantalla regalaba las credenciales; se quitaron en `067ccfa`, pero el repo es
  publico y el literal sigue en el historial desde `b2e25bc`. Quitarlo del tip no alcanza: hace falta cambiar
  la clave, y si se quiere borrar el rastro, reescribir el historial.
- `E:\Proyectos\tt-cotap` no tiene repo git. Inicializar uno si el proyecto sigue activo.
- Faltan `docs\01-requerimientos`, `02-diseno-arquitectura` y `05-pruebas`: estan vacios,
  hay que llenarlos con lo que ya se sabe del sistema.
