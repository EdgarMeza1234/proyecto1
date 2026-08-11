const { getPool, getSql, getFacilidadesTable, safeSqlName } = require('../db/pool');

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

        await request.query(`
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

          IF @ExistingID IS NOT NULL
          BEGIN
            UPDATE ${table}
            SET Dn = @Dn, ParSec = @ParSec,
                ParSecCentral = @ParSecCentral, ParSecBloq = @ParSecBloq, ParSecPar = @ParSecPar,
                Obs = @Obs
            WHERE ID = @ExistingID
          END
          ELSE
          BEGIN
            INSERT INTO ${table} (Dn, Central, ParPriBloq, ParPriPar, ParSec, ParSecCentral, ParSecBloq, ParSecPar, Obs)
            VALUES (@Dn, @Central, @ParPriBloq, @ParPriPar, @ParSec, @ParSecCentral, @ParSecBloq, @ParSecPar, @Obs)
          END
        `);
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

module.exports = { lookupDn, lookupBlock, updateBlock, getObservations, addObservation };
