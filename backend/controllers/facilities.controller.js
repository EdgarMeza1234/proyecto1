const { getPool, getSql, getFacilidadesTable, safeSqlName } = require('../db/pool');
const { registrarAuditoria } = require('../services/facilities-audit.service');

const CAMPOS_COMPARABLES = ['Dn', 'ParSec', 'ParSecCentral', 'ParSecBloq', 'ParSecPar', 'Obs'];

function normalizar(v) {
  return String(v || '').trim();
}

function snapshotsSonIguales(a, b) {
  for (const campo of CAMPOS_COMPARABLES) {
    if (normalizar(a[campo]) !== normalizar(b[campo])) return false;
  }
  return true;
}

function construirDetalle(antes, despues) {
  const cambios = [];
  for (const campo of CAMPOS_COMPARABLES) {
    const vAntes = normalizar(antes[campo]);
    const vDespues = normalizar(despues[campo]);
    if (vAntes !== vDespues) {
      cambios.push(`${campo}: '${vAntes || '—'}' -> '${vDespues || '—'}'`);
    }
  }
  return cambios.join(' | ');
}

async function lookupDn(req, res, next) {
  try {
    const dn = decodeURIComponent(req.params.dn || '').trim();
    if (!dn) return res.status(400).json({ message: 'Debe enviar el DN o numero telefonico.' });

    const pool = await getPool();
    const table = safeSqlName(getFacilidadesTable());
    const result = await pool.request()
      .input('dn', (await getSql()).VarChar(20), dn)
      .query(`
        WITH FacilidadesNumeradas AS (
          SELECT
            ID, Dn, Central, ParPriBloq, ParPriPar, ParSec, ParSecCentral, ParSecBloq, ParSecPar, Obs,
            ROW_NUMBER() OVER (
              PARTITION BY
                COALESCE(NULLIF(LTRIM(RTRIM(Central)), ''), LTRIM(RTRIM(ParPriBloq))),
                CASE
                  WHEN Central IS NULL OR LTRIM(RTRIM(Central)) = '' THEN LTRIM(RTRIM(ParPriPar))
                  ELSE LTRIM(RTRIM(ParPriBloq))
                END
              ORDER BY ID
            ) AS NumeroParCalculado
          FROM ${table}
        )
        SELECT TOP (1)
          ID, Dn, Central, ParPriBloq, ParPriPar, ParSec, ParSecCentral, ParSecBloq, ParSecPar, Obs, NumeroParCalculado
        FROM FacilidadesNumeradas
        WHERE Dn = @dn
        ORDER BY ID DESC
      `);

    res.json(result.recordset[0] || null);
  } catch (error) {
    next(error);
  }
}

async function lookupBlock(req, res, next) {
  try {
    const bloque = decodeURIComponent(req.params.bloque || '').trim();
    const central = String(req.query.central || '').trim().slice(0, 50);

    if (!central || !bloque) {
      return res.status(400).json({ message: 'Debe enviar la central y el bloque primario.' });
    }

    const pool = await getPool();
    const table = safeSqlName(getFacilidadesTable());
    const result = await pool.request()
      .input('central', (await getSql()).VarChar(50), central)
      .input('bloque', (await getSql()).VarChar(10), bloque)
      .query(`
        SELECT TOP (100)
          ID, Dn, Central, ParPriBloq, ParPriPar, ParSec, ParSecCentral, ParSecBloq, ParSecPar, Obs
        FROM ${table}
        WHERE (LTRIM(RTRIM(Central)) = @central
            AND LTRIM(RTRIM(ParPriBloq)) = @bloque)
           OR ((Central IS NULL OR LTRIM(RTRIM(Central)) = '')
            AND LTRIM(RTRIM(ParPriBloq)) = @central
            AND LTRIM(RTRIM(ParPriPar)) = @bloque)
        ORDER BY TRY_CONVERT(INT, ParPriPar), ParPriPar, ID
      `);

    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
}

async function updateBlock(req, res, next) {
  try {
    const bloque = decodeURIComponent(req.params.bloque || '').trim();
    const central = String(req.query.central || '').trim().slice(0, 50);

    if (!central || !bloque) {
      return res.status(400).json({ message: 'Debe enviar la central y el bloque primario.' });
    }

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) {
      return res.status(400).json({ message: 'No hay pares para actualizar.' });
    }

    const pool = await getPool();
    const sql = await getSql();
    const table = safeSqlName(getFacilidadesTable());
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const usuario = req.user?.username || '';
    const nombreCompleto = req.user?.name || '';

    try {
      for (const row of rows.slice(0, 100)) {
        const request = new sql.Request(transaction);
        request.input('ID', sql.Int, Number(row.ID) || null);
        request.input('Dn', sql.VarChar(20), String(row.Dn || '').trim().slice(0, 20));
        request.input('Central', sql.VarChar(50), central);
        request.input('ParPriBloq', sql.VarChar(10), bloque);
        request.input('ParPriPar', sql.VarChar(10), String(row.ParPriPar || '').trim().slice(0, 10));
        request.input('ParSec', sql.VarChar(10), String(row.ParSec || '').trim().slice(0, 10));
        request.input('ParSecCentral', sql.VarChar(50), String(row.ParSecCentral || '').trim().slice(0, 50));
        request.input('ParSecBloq', sql.VarChar(10), String(row.ParSecBloq || '').trim().slice(0, 10));
        request.input('ParSecPar', sql.VarChar(10), String(row.ParSecPar || '').trim().slice(0, 10));
        request.input('Obs', sql.VarChar(50), String(row.Obs || '').trim().slice(0, 50));

        const result = await request.query(`
          DECLARE @ExistingID INT = NULL;

          IF @ID IS NOT NULL AND EXISTS (SELECT 1 FROM ${table} WHERE ID = @ID)
          BEGIN
            SET @ExistingID = @ID;
          END
          ELSE
          BEGIN
            SELECT @ExistingID = ID FROM ${table}
            WHERE Central = @Central AND ParPriBloq = @ParPriBloq AND ParPriPar = @ParPriPar;
          END

          SELECT
            @ExistingID AS ExistingID,
            CASE WHEN @ExistingID IS NOT NULL THEN 1 ELSE 0 END AS Existe
        `);

        const existe = result.recordset[0]?.Existe === 1;
        const idExistente = result.recordset[0]?.ExistingID || null;

        if (existe) {
          const antesReq = new sql.Request(transaction);
          antesReq.input('ExistingID', sql.Int, idExistente);
          const antesResult = await antesReq.query(`
            SELECT TOP (1) Dn, Central, ParPriBloq, ParPriPar, ParSec, ParSecCentral, ParSecBloq, ParSecPar, Obs
            FROM ${table}
            WHERE ID = @ExistingID
          `);
          const antes = antesResult.recordset[0] || {};

          if (snapshotsSonIguales(antes, row)) {
            continue;
          }

          const updateReq = new sql.Request(transaction);
          updateReq.input('ExistingID', sql.Int, idExistente);
          updateReq.input('Dn', sql.VarChar(20), String(row.Dn || '').trim().slice(0, 20));
          updateReq.input('ParSec', sql.VarChar(10), String(row.ParSec || '').trim().slice(0, 10));
          updateReq.input('ParSecCentral', sql.VarChar(50), String(row.ParSecCentral || '').trim().slice(0, 50));
          updateReq.input('ParSecBloq', sql.VarChar(10), String(row.ParSecBloq || '').trim().slice(0, 10));
          updateReq.input('ParSecPar', sql.VarChar(10), String(row.ParSecPar || '').trim().slice(0, 10));
          updateReq.input('Obs', sql.VarChar(50), String(row.Obs || '').trim().slice(0, 50));
          await updateReq.query(`
            UPDATE ${table}
            SET Dn = @Dn, ParSec = @ParSec,
                ParSecCentral = @ParSecCentral, ParSecBloq = @ParSecBloq, ParSecPar = @ParSecPar,
                Obs = @Obs
            WHERE ID = @ExistingID
          `);

          await registrarAuditoria({
            accion: 'MODIFICAR',
            idRegistro: idExistente,
            central,
            parPriBloq: bloque,
            parPriPar: normalizar(row.ParPriPar) || normalizar(antes.ParPriPar),
            dn: normalizar(row.Dn) || normalizar(antes.Dn),
            datosAntes: JSON.stringify(antes),
            datosDespues: JSON.stringify(row),
            detalle: construirDetalle(antes, row),
            usuario,
            nombreCompleto,
            transaction
          });
        } else {
          const insertReq = new sql.Request(transaction);
          insertReq.input('Dn', sql.VarChar(20), String(row.Dn || '').trim().slice(0, 20));
          insertReq.input('Central', sql.VarChar(50), central);
          insertReq.input('ParPriBloq', sql.VarChar(10), bloque);
          insertReq.input('ParPriPar', sql.VarChar(10), String(row.ParPriPar || '').trim().slice(0, 10));
          insertReq.input('ParSec', sql.VarChar(10), String(row.ParSec || '').trim().slice(0, 10));
          insertReq.input('ParSecCentral', sql.VarChar(50), String(row.ParSecCentral || '').trim().slice(0, 50));
          insertReq.input('ParSecBloq', sql.VarChar(10), String(row.ParSecBloq || '').trim().slice(0, 10));
          insertReq.input('ParSecPar', sql.VarChar(10), String(row.ParSecPar || '').trim().slice(0, 10));
          insertReq.input('Obs', sql.VarChar(50), String(row.Obs || '').trim().slice(0, 50));

          const insertResult = await insertReq.query(`
            INSERT INTO ${table} (Dn, Central, ParPriBloq, ParPriPar, ParSec, ParSecCentral, ParSecBloq, ParSecPar, Obs)
            OUTPUT INSERTED.ID
            VALUES (@Dn, @Central, @ParPriBloq, @ParPriPar, @ParSec, @ParSecCentral, @ParSecBloq, @ParSecPar, @Obs)
          `);
          const nuevoId = insertResult.recordset[0]?.ID || null;

          await registrarAuditoria({
            accion: 'CREAR',
            idRegistro: nuevoId,
            central,
            parPriBloq: bloque,
            parPriPar: normalizar(row.ParPriPar),
            dn: normalizar(row.Dn),
            datosAntes: null,
            datosDespues: JSON.stringify(row),
            detalle: 'Se creo el par en la tabla MDF.',
            usuario,
            nombreCompleto,
            transaction
          });
        }
      }

      await transaction.commit();
      res.json({ message: 'Bloque actualizado correctamente.', total: rows.length });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

async function getObservations(req, res, next) {
  try {
    const pool = await getPool();
    const table = safeSqlName(getFacilidadesTable());
    const result = await pool.request().query(`
      SELECT DISTINCT Obs as Observacion
      FROM ${table}
      WHERE Obs IS NOT NULL AND LTRIM(RTRIM(Obs)) != ''
      ORDER BY Obs
    `);

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
}

async function addObservation(req, res, next) {
  try {
    const observation = String(req.body?.observacion || '').trim().slice(0, 50);
    if (!observation) {
      return res.status(400).json({ message: 'Observacion invalida.' });
    }
    res.status(201).json({ message: 'Observacion registrada', observacion: observation });
  } catch (error) {
    next(error);
  }
}

async function getAuditoria(req, res, next) {
  try {
    const { listarAuditoria } = require('../services/facilities-audit.service');
    const registros = await listarAuditoria({ limit: req.query.limit, usuario: req.query.usuario });
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(registros);
  } catch (error) {
    next(error);
  }
}

module.exports = { lookupDn, lookupBlock, updateBlock, getObservations, addObservation, getAuditoria };
