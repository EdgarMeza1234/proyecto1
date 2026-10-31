# Documentacion del proyecto

Indice de lo que hay en esta carpeta.

| Carpeta | Contenido |
|---|---|
| `01-requerimientos` | Que debe hacer el sistema, segun el area de ATT. |
| `02-diseno-arquitectura` | Modelo de datos, flujos, decisiones tecnicas. |
| `03-despliegue-servidor` | Script de instalacion, compose de monitoring y documentacion del servidor. **Excluido de git** porque fija credenciales en claro. |
| `04-datos-papeletas` | Papeletas de ejemplo en PDF. **Excluido de git** por datos de clientes. |
| `05-pruebas` | Cases de prueba y resultados. |
| `06-bitacora.md` | Decisiones y cambios relevantes, en orden de fecha. |

Los `.docx` de esta carpeta llevan credenciales en texto plano, por eso estan fuera del repo.
Para regenerar la documentacion del servidor usar `03-despliegue-servidor/generar-documentacion.py`.

El codigo vive en `backend\`, `frontend\` y `database\`, al mismo nivel que esta carpeta.
